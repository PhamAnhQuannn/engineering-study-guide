# Distributed Scheduler Design — System Design Questions

[← Topic overview](../README.md)

> Topic: Exactly-once execution, leader election, clock skew, partition tolerance.

---

## D1. Design a distributed task scheduler (cron at scale)

**Requirements / Scale**
- Functional: create/update/delete scheduled tasks (cron expressions + one-shot), view task history, retry policies, DAG dependencies (task B waits for task A), priority levels, pause/resume.
- Non-functional: 10M registered tasks, 100k executions/minute at peak, sub-second scheduling accuracy, exactly-once execution guarantee (or at-least-once + idempotency), survive node failures without missed or double executions.

**High-level design**
- **API service:** CRUD for task definitions. Stores tasks in Postgres.
- **Scheduler fleet:** N scheduler nodes. Each owns a **partition** of the task space (by hash of task_id). Each node runs a time-wheel or priority queue, evaluating "what fires in the next tick."
- **Partition assignment:** etcd/ZooKeeper tracks which scheduler node owns which partition. On node failure, partitions are reassigned to surviving nodes (rebalance). Consistent hashing minimizes churn.
- **Execution queue:** when a task fires, scheduler enqueues an execution message to Kafka/SQS with an **idempotency key** (task_id + scheduled_fire_time).
- **Worker fleet:** stateless workers pull from the execution queue, acquire a **lease** (distributed lock in Redis/etcd with TTL), execute the task handler, write the result, release the lease. If a worker dies mid-execution, the lease expires and another worker retries (idempotent handler required).
- **Result store:** `executions` table in Postgres — task_id, execution_id, status, started_at, completed_at, result/error.
- **DAG engine:** for dependent tasks, the scheduler checks preconditions (all parent tasks completed) before enqueuing. Simple in-memory DAG per workflow; complex DAGs may warrant a separate orchestrator (Temporal/Airflow pattern).

**Data model**
- `tasks(id PK, cron_expr, handler, params JSONB, retry_policy JSONB, priority INT, partition_key INT, status ENUM(active,paused,deleted), next_fire_at TIMESTAMP, created_at)` — Postgres. Index on `(partition_key, next_fire_at)` for the scheduler's scan.
- `executions(id PK, task_id FK, idempotency_key UNIQUE, status ENUM(pending,running,succeeded,failed,retrying), lock_owner VARCHAR, lock_expiry TIMESTAMP, started_at, completed_at, result JSONB, attempt INT)` — Postgres.
- `partitions(partition_id, owner_node_id, last_heartbeat)` — etcd/ZooKeeper.

**Scaling & bottlenecks**
- **Midnight thundering herd:** many cron jobs fire at `0 0 * * *`. Mitigation: add jitter (random delay 0–60s) per task; stagger partition scans.
- **Partition rebalancing:** when a scheduler node dies, its partitions must be claimed by others. During rebalance, tasks may be momentarily unowned → brief delay, not loss (idempotency key prevents duplication once re-enqueued).
- **Execution queue depth at burst:** peak 100k/min. Kafka partitions scale consumers; SQS scales automatically. Workers autoscale on queue depth.
- **Long-running tasks:** a 2-hour ETL job vs a 5ms webhook. Workers renew their lease periodically (heartbeat). If no heartbeat for 2× lease TTL → consider the worker dead, retry.

**Tradeoffs & failure modes**
- **At-least-once + idempotent handlers (practical)** vs exactly-once (expensive two-phase coordination). Recommendation: at-least-once with idempotency keys — simpler, battle-tested.
- **Pull-based workers** (workers poll the queue — simple, slight latency) vs **push-based** (scheduler pushes to workers — faster, complex load balancing). Pull is the standard for job systems.
- **Leader-based assignment** (one leader assigns all partitions — simpler, leader is SPOF) vs **consistent hashing** (each node independently determines ownership — no leader, but rebalance churn). Consistent hashing + etcd watches is the robust choice.
- **Clock skew:** nodes disagree on "now" by up to hundreds of milliseconds (NTP). For second-precision scheduling, this is acceptable. For sub-second precision, use a single time source or accept ±1s variance.
- **Scheduler node crash:** its partitions go unowned. etcd detects via missed heartbeat (e.g., 10s TTL). Rebalance takes seconds. Tasks that should have fired during the gap are detected (next_fire_at < now) and enqueued on the new owner's first scan.
- **Worker crash mid-execution:** lease expires → execution status remains "running" past lock_expiry → another worker claims it → re-executes (idempotent). The failed worker's partial work is discarded (handler must be safe to re-run).

**Checklist**
- [ ] Explains exactly-once execution strategy (or at-least-once + idempotency)
- [ ] Describes partition/shard assignment for the task space
- [ ] Handles node failure detection and task reassignment (leases + heartbeats)
- [ ] Discusses clock skew and its impact on scheduling precision
- [ ] Plans for the midnight thundering herd (jitter/stagger)
- [ ] Separates scheduling (deciding what fires) from execution (running it)
- [ ] Addresses long-running task detection (heartbeat renewal vs timeout)
- [ ] Mentions DAG dependencies or explicitly scopes them out
- [ ] Provides failure modes: scheduler crash, worker crash mid-execution, partition rebalance
