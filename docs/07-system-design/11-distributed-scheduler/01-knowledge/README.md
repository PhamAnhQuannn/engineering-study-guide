# Distributed Scheduler Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Exactly-once execution, leader election, clock skew, partition tolerance.

A distributed task scheduler (cron at scale) is the purest **distributed systems design** question. It tests every hard primitive: [consensus](../../../09-distributed-systems/05-consensus-replication/01-knowledge/README.md), [failure detection](../../../09-distributed-systems/01-failure-handling/01-knowledge/README.md), [delivery semantics](../../../09-distributed-systems/03-delivery-semantics/01-knowledge/README.md), partitioning, and clock coordination. Unlike user-facing systems, correctness here means "every task runs exactly once at the right time" — and achieving that across unreliable nodes is genuinely hard.

> **🛒 Where we are in building ShopFast** — The [Collaborative Editor](../../10-collaborative-editor/01-knowledge/README.md) dealt with real-time user-facing coordination. This topic moves to backend infrastructure: ShopFast needs scheduled jobs — daily inventory reconciliation, hourly price sync with suppliers, per-minute stock-level checks, and one-shot delayed tasks (send review reminder 7 days after delivery). A single-node cron breaks at scale. **Next:** [Multi-Vendor Marketplace](../../12-multi-vendor-marketplace/01-knowledge/README.md) applies these infrastructure patterns to a multi-tenant e-commerce system.

---

## Why it matters

This question surfaces when interviewing for infrastructure or platform roles. It tests:
1. **Distributed coordination** — [leader election](../../../09-distributed-systems/05-consensus-replication/01-knowledge/README.md), partition assignment, lease management
2. **Exactly-once semantics** — or pragmatically, [at-least-once + idempotency](../../../09-distributed-systems/03-delivery-semantics/01-knowledge/README.md)
3. **Failure handling** — node crash, network partition, clock skew
4. **Scaling patterns** — partitioning work, [queue-based decoupling](../../../09-distributed-systems/04-messaging-queues/01-knowledge/README.md)

---

## Architecture: separate scheduling from execution

The key insight: **deciding what fires** is a different problem from **running it**.

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Scheduler    │────▶│  Execution   │────▶│   Worker     │
│  Fleet        │     │  Queue       │     │   Fleet      │
│  (partitioned)│     │  (Kafka/SQS) │     │  (stateless) │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                                         │
       │          ┌──────────────┐               │
       └──────────│   etcd /     │               ▼
                  │   ZooKeeper  │         ┌──────────────┐
                  │  (partition  │         │  Result      │
                  │   registry)  │         │  Store       │
                  └──────────────┘         └──────────────┘
```

**Scheduler fleet:** N nodes, each owning a partition of the task space (by hash of task_id). Each node runs a time-wheel or priority queue, scanning `WHERE next_fire_at <= now()`. When a task fires, it enqueues an execution message with an idempotency key.

**Execution queue:** Kafka or SQS. Decouples scheduling from execution. Absorbs bursts.

**Worker fleet:** stateless pods that pull from the queue, acquire a lease (distributed lock with TTL), execute the handler, write the result, release the lease. If a worker dies mid-execution, the lease expires and another worker retries — the handler must be idempotent.

---

## The hard problems

### 1. Exactly-once execution
True exactly-once across external systems is impractical (the task calls an API — the call succeeds but the ACK is lost). **Pragmatic solution:** at-least-once delivery + idempotent handlers. Each execution carries an `idempotency_key = task_id + scheduled_fire_time`. The handler checks this key before acting.

### 2. Partition ownership
Each scheduler node owns a shard of tasks. Partition assignment via etcd/ZooKeeper — a node claims a partition by creating an ephemeral key with a lease. If the node dies, the lease expires, and another node claims the partition. Consistent hashing minimizes reassignment churn when nodes join/leave.

### 3. Failure detection
Heartbeats: each scheduler node renews its etcd lease every N seconds. If renewal misses (2× TTL), the node is considered dead. Its partitions become unowned and are claimed by surviving nodes. Tasks that should have fired during the gap (next_fire_at < now) are detected on the new owner's first scan.

### 4. Clock skew
Different nodes disagree on "now" by up to hundreds of milliseconds (NTP drift). For second-precision scheduling, this is tolerable. For sub-second precision, use a single time source or accept ±1s variance. The idempotency key prevents double-firing even if two nodes briefly overlap during a partition handoff.

### 5. Midnight thundering herd
Many cron jobs fire at `0 0 * * *` (midnight). Without mitigation: 6M tasks in ~1 second. **Fix:** add per-task jitter (random delay 0–60s). Stagger partition scans across scheduler nodes. Result: 6M tasks spread over 60 seconds = 100k/sec burst instead of 6M/sec spike.

---

## ShopFast case: scheduled operations

> **Scenario:** ShopFast needs: daily inventory reconciliation with suppliers (6k sellers), hourly price sync, per-minute stock-level checks for popular items, one-shot delayed tasks (review reminders, abandoned cart emails).

**Decision:** scheduler fleet of 3 nodes, each owning 1/3 of task partitions. Kafka as the execution queue. Stateless worker pods autoscale on queue depth (baseline 10, burst to 100). All handlers are idempotent — inventory reconciliation uses upsert, email tasks check `sent_at IS NULL` before sending.

**Why not a single-node cron?** Single point of failure. At 6k+ sellers with multiple schedules each, a single cron process can't scan fast enough, and a crash means missed jobs.

**Rejected:** database-based polling (each worker polls `WHERE status = pending ORDER BY fire_at LIMIT 1` — hot row contention, no partition isolation). Also rejected: exactly-once via 2PC (Two-Phase Commit) — too expensive and fragile for this workload.

---

## Lessons and pitfalls

1. **Separate scheduling from execution.** This is the #1 architectural insight. Mixing them makes scaling and failure handling much harder.

2. **Idempotency is your safety net.** Don't fight for exactly-once — design handlers to be safe to re-run. This is where [delivery semantics](../../../09-distributed-systems/03-delivery-semantics/01-knowledge/README.md) knowledge pays off.

3. **Long-running tasks need lease renewal.** A 2-hour ETL job outlives any reasonable fixed timeout. Workers must heartbeat/renew their lease. If no heartbeat for 2× lease TTL → consider the worker dead and reassign.

4. **DAG dependencies are a scope decision.** Task B depends on Task A completing — do you support this? If yes, you're building a workflow engine (Airflow/Temporal territory). In an interview, it's OK to explicitly scope this out: "I'd handle independent tasks; for DAGs, I'd integrate with a workflow orchestrator."

5. **The thundering herd is the design constraint.** Average load is manageable. The midnight spike is what breaks you. Always mention jitter.
