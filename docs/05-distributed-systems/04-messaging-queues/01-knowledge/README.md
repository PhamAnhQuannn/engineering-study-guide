# Messaging & Queues — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Kafka, RabbitMQ, pub/sub, event-driven, streams.

Message queues and logs decouple producers from consumers in time, space, and rate. They are the backbone of asynchronous, event-driven architectures. The senior skill is knowing *which* broker model (queue vs log) fits a workload, and reasoning about ordering, durability, and backpressure.

---

## 1. Two fundamental models

### Message queue (broker-managed, e.g. RabbitMQ, SQS, ActiveMQ)
- A message is delivered to **one** consumer (competing consumers / work queue) and then **removed/acked**.
- The broker tracks per-message state (delivered, acked, redelivered). This is "smart broker, dumb consumer."
- Great for **task distribution / job processing**: many workers pull from one queue, each job done once.
- Routing is rich: exchanges, bindings, routing keys, topic/fanout/direct exchanges (RabbitMQ/AMQP).

### Log / stream (consumer-managed offset, e.g. Kafka, Pulsar, Kinesis, Redpanda)
- An **append-only, partitioned, ordered log**. Messages are *retained* (by time/size) and **not deleted on consumption** — consumers track their own **offset**.
- Multiple independent consumer groups can read the *same* log at their own pace; you can **replay** by rewinding offsets.
- "Dumb broker, smart consumer." Optimized for high-throughput streaming and event sourcing.
- Order is guaranteed **within a partition**, not across partitions.

**One-line distinction:** a queue is a *to-do list* the broker hands out and crosses off; a log is a *durable transcript* consumers read at their own pace and can re-read.

---

## 2. Pub/Sub vs point-to-point

- **Point-to-point (work queue):** one message → one consumer. Used for load-balanced task processing.
- **Publish/subscribe:** one message → *all* interested subscribers. Fan-out. In Kafka, each **consumer group** is an independent subscriber; within a group, partitions are divided among members (so it's pub/sub *across* groups, competing-consumers *within* a group).

---

## 3. Kafka internals (the common interview target)

- **Topic → partitions:** a topic is split into partitions; each partition is an ordered, immutable log on disk. Partitions are the unit of parallelism *and* ordering.
- **Partition key:** producer hashes a key to choose a partition → all messages for a key land in one partition (per-key ordering). No key → round-robin.
- **Offsets:** monotonically increasing per-partition message position. Consumers commit offsets to mark progress.
- **Consumer groups & rebalancing:** members of a group split partitions; if a member joins/leaves, a **rebalance** reassigns partitions (a brief pause; can cause redeliveries).
- **Replication:** each partition has a **leader** and **followers** (replicas). Producers write to the leader; followers replicate. **ISR** (in-sync replicas) are followers caught up to the leader.
- **acks:** `acks=0` (fire-and-forget), `acks=1` (leader only — data loss if leader dies before replication), `acks=all` (leader + all ISR — durable). `min.insync.replicas` sets how many ISR must ack.
- **Retention:** time-based or size-based; or **log compaction** (keep only the latest value per key — for changelog/state topics).
- **Throughput tricks:** sequential disk I/O, zero-copy, batching, page cache — why Kafka is fast despite using disk.

---

## 4. Core concepts every senior should hold

- **Decoupling:** producers and consumers don't need to be up at the same time, run at the same rate, or know about each other. Buys resilience and independent scaling.
- **Backpressure & buffering:** the queue absorbs bursts (within retention/depth limits). But a persistently slow consumer just grows lag — the queue is a shock absorber, not infinite capacity.
- **Consumer lag:** the gap between the latest offset and the consumer's committed offset. The #1 health metric for streaming — rising lag = consumers can't keep up.
- **Ordering:** total ordering is expensive; partition/key ordering is the practical norm. Choose keys so that things that must be ordered share a partition.
- **Delivery semantics:** brokers are typically **at-least-once** by default (see Delivery Semantics topic). Exactly-once exists within Kafka (transactions) but external sinks still need idempotency.
- **Dead-letter queue (DLQ):** where messages go after exceeding retry limits (poison messages), so they don't block the stream.
- **Fan-out / fan-in:** one event to many consumers (fan-out); many sources into one consumer (fan-in).
- **Push vs pull:** RabbitMQ pushes to consumers (with prefetch limits for flow control); Kafka consumers **pull** (consumer controls rate — natural backpressure).

---

## 5. Common patterns

- **Work queue / competing consumers:** scale consumers horizontally to drain a queue faster.
- **Event-driven / choreography:** services emit events; others react. Loose coupling, but harder to trace end-to-end (vs **orchestration**, where a central coordinator directs the flow).
- **Event sourcing:** store the *log of events* as the source of truth; rebuild state by replaying. Pairs naturally with a log broker + compaction.
- **CQRS:** separate write model (commands → events) from read models (projections built by consuming events).
- **Outbox + CDC:** publish events reliably from a DB via an outbox table or change-data-capture (Debezium) instead of dual writes.
- **Saga:** long-running multi-service workflow coordinated via messages, with compensating actions on failure.

---

## 6. Key terms

| Term | Definition |
|---|---|
| Partition | An ordered, independent log within a topic; unit of parallelism and ordering. |
| Offset | A consumer's position within a partition. |
| Consumer group | Set of consumers sharing a subscription; partitions are divided among members. |
| Consumer lag | Latest offset minus committed offset; how far behind a consumer is. |
| ISR | In-sync replicas; followers caught up enough to ack for `acks=all`. |
| Log compaction | Retention mode keeping only the latest message per key. |
| Prefetch / QoS | RabbitMQ limit on unacked messages per consumer (flow control). |
| DLQ | Dead-letter queue for messages that exhausted retries. |
| Fan-out | Delivering one message to many subscribers. |
| Rebalance | Reassigning partitions when group membership changes. |

---

## 7. Tradeoffs

- **Queue (RabbitMQ/SQS) vs Log (Kafka):** queues give rich routing, per-message ack, easy priority/TTL/delay, and simple "do each job once"; logs give replay, high throughput, multiple independent readers, and ordered retention — at the cost of consumer-managed offsets and coarser per-message control.
- **More partitions:** more parallelism and throughput, but more open files/connections, longer rebalances, and metadata overhead. You can add partitions but (usually) not remove them, and adding them changes key→partition mapping (breaks ordering for existing keys).
- **acks/durability vs latency:** `acks=all` + `min.insync.replicas≥2` is durable but slower; `acks=1` is faster but risks loss on leader failure.
- **Push vs pull:** push gives low latency but needs prefetch to avoid overwhelming consumers; pull gives natural backpressure but slightly higher latency.
- **Retention long vs short:** long retention enables replay/recovery but costs storage.

---

## 8. Common pitfalls & misconceptions

- **"Kafka is a queue."** It's a *log*; messages aren't deleted on read, ordering is per-partition, and consumers manage offsets. Treating it like RabbitMQ leads to surprises (e.g. expecting per-message ack/redelivery).
- **Too many or too few partitions.** Too few caps parallelism (one consumer per partition max per group); too many slows rebalances and adds overhead.
- **Ignoring consumer lag.** The producer side looks healthy while consumers silently fall behind until the backlog is unrecoverable within retention.
- **Assuming global ordering.** Only per-partition order is guaranteed; cross-partition is not.
- **Unbounded queue depth as a "feature."** A persistently slow consumer makes the queue grow forever (or hit retention and drop). Queues defer, not eliminate, the throughput problem.
- **No DLQ.** Poison messages loop forever or block partitions.
- **Rebalance storms.** Frequent membership changes (slow consumers timing out) cause repeated rebalances and redeliveries; tune session/heartbeat timeouts and use cooperative rebalancing.
- **Dual writes.** Publishing after a DB commit without an outbox loses events on crash.

---

## 9. What interviewers probe

- *"Kafka vs RabbitMQ — when would you choose each?"*
- *"How does Kafka guarantee ordering? What breaks it?"* (Per-partition; multiple partitions, retries, repartitioning.)
- *"Your consumer lag is climbing — walk me through diagnosing and fixing it."*
- *"How do you scale consumers? What's the limit?"* (One consumer per partition per group → partitions cap parallelism.)
- *"acks=1 vs acks=all — what's the data-loss scenario?"*
- *"How would you publish events reliably from a service that also writes to a DB?"* (Outbox / CDC, not dual writes.)
- *"Design a DLQ + retry strategy."*

---

## 10. Quick-reference summary

- **Queue (RabbitMQ/SQS):** smart broker, per-message ack, one-consumer-per-message, rich routing, deletes on ack. Best for task distribution.
- **Log (Kafka/Pulsar/Kinesis):** append-only partitioned log, consumer-managed offsets, retention + replay, per-partition ordering, multiple consumer groups. Best for streaming/event sourcing.
- **Partitions** = parallelism + ordering unit; **key** decides partition; one consumer per partition per group caps parallelism.
- **Durability:** `acks=all` + `min.insync.replicas` ≥ 2; replication via leader/followers/ISR.
- **Watch consumer lag** as the primary streaming health signal.
- **At-least-once by default** → make consumers idempotent; **DLQ** poison messages.
- **Reliable publishing** via **outbox/CDC**, not dual writes. **Event-driven** = loose coupling but trace with care.
