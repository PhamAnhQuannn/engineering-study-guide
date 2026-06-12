# Distributed Scheduler Design — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Exactly-once execution, leader election, clock skew, partition tolerance.

---

## DC1. Task scheduler — leader-based vs consistent-hashing partition assignment

**Answer**

**Leader-based (one coordinator assigns partitions):**
- Pro: simple logic — leader has global view, makes all assignment decisions. Easy to implement fair distribution.
- Con: leader is a SPOF. If it fails, all assignments freeze until a new leader is elected (seconds). Leader election adds complexity (ZooKeeper/etcd).
- Suitable for: smaller deployments (<10 scheduler nodes).

**Consistent hashing (each node independently determines ownership):**
- Pro: no single coordinator. Adding/removing nodes redistributes minimal partitions. No SPOF for assignment.
- Con: rebalancing churn when nodes join/leave. Split-brain risk if nodes have stale membership views. Harder to guarantee even distribution.
- Suitable for: large-scale schedulers (100+ nodes) where leader failover latency is unacceptable.

**Decision:** for most systems, use a hybrid — etcd/ZooKeeper stores the partition map (small data, strong consistency), and a simple leader process updates the map. The leader is replaceable in seconds via existing leader election. Pure consistent hashing adds complexity that's rarely needed below 50 nodes.

---

## DC2. Task execution — at-least-once + idempotency vs exactly-once coordination

**Answer**

**At-least-once + idempotent handlers:**
- Pro: simple infrastructure — queue delivers at-least-once (standard guarantee), handlers are written to be safe to re-execute (idempotency key, upsert instead of insert, check-before-act).
- Con: requires discipline — every task handler must be idempotent. Not all operations are naturally idempotent (sending an email, charging a credit card).

**Exactly-once coordination:**
- Pro: no duplicate execution, period. Handlers can be non-idempotent.
- Con: requires two-phase commit or transactional outbox between the queue and the execution. Expensive, complex, fragile under partition. Very few systems truly achieve this (Kafka transactions come close within Kafka, but not across external systems).

**Decision:** at-least-once + idempotency is the industry standard for task schedulers (Celery, Sidekiq, Airflow all use this model). True exactly-once across external systems is impractical — the task may call an external API that succeeded but the ACK was lost. Design handlers to be idempotent: use idempotency keys, make operations commutative where possible, and use the "check-then-act" pattern for non-idempotent operations (check if the email was already sent before sending).
