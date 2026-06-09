# Messaging & Queues — Practice Questions

[← Topic overview](../README.md)

> Topic: Kafka, RabbitMQ, pub/sub, event-driven, streams.

Recall, "explain to a junior," and MCQs with an answer key.

---

### Q1. Kafka vs RabbitMQ — explain the core difference and when you'd choose each.

**Answer:** RabbitMQ is a **message queue** (AMQP broker): the broker delivers each message to one consumer, tracks per-message acks, and *removes* the message once acked. It's a "smart broker" with rich routing (exchanges, routing keys, priorities, TTL, delays). Best for **task/job distribution** where each job is done once and you want flexible routing.

Kafka is a **distributed log**: an append-only, partitioned, *retained* stream. Messages aren't deleted on consumption; consumers track their own **offset** and can **replay**. Multiple consumer groups read the same data independently. It's a "dumb broker, smart consumer," optimized for **high-throughput streaming, event sourcing, and multiple independent readers**.

Choose RabbitMQ for complex routing and per-message work queues; choose Kafka for high-volume event streams, replay, and many consumers of the same data.

---

### Q2. Explain partitions and offsets to a junior.

**Answer:** A Kafka topic is split into **partitions** — think of each as a separate numbered notebook where messages are appended in order and never reordered. Partitions are why Kafka scales: different partitions can be read by different consumers in parallel. An **offset** is just a message's line number within one partition. Each consumer remembers "I've read up to line 4,217 in partition 2" — that's its committed offset. Because the broker keeps the messages around, a consumer can rewind its offset to re-read old messages (replay). Ordering is guaranteed *within* a partition (one notebook) but **not across** partitions.

---

### Q3. How do you scale consumers, and what's the hard limit?

**Answer:** You scale by adding consumers to a **consumer group**; the group's members split the topic's partitions among themselves, so each partition is processed in parallel. The **hard limit** is one consumer per partition *within a group* — if a topic has 12 partitions, at most 12 consumers in a group do useful work; a 13th sits idle. So your maximum consumer parallelism is bounded by the **partition count**. To go faster you must add partitions (which you should plan up front, since adding them changes key→partition mapping and breaks per-key ordering for existing keys).

---

### Q4. What is consumer lag and why is it the key streaming metric?

**Answer:** Consumer lag is the difference between the **latest offset** produced to a partition and the **committed offset** of the consumer — i.e., how many messages are waiting that the consumer hasn't processed yet. It's the key health metric because the producer side can look perfectly healthy while consumers silently fall behind. Steadily rising lag means consumers can't keep up with the incoming rate; if it grows past the retention window, you start *losing* unprocessed data. Monitoring and alerting on lag (and lag *trend*) is how you catch a struggling pipeline before it becomes data loss.

---

### Q5. Explain `acks=0`, `acks=1`, and `acks=all`, and the data-loss scenario for each.

**Answer:**
- **`acks=0`:** producer doesn't wait for any acknowledgment — fire-and-forget. Highest throughput, but messages are lost if the broker drops them; no delivery guarantee.
- **`acks=1`:** producer waits for the **partition leader** to write the message. If the leader crashes *before* followers replicate it, that message is lost.
- **`acks=all`:** producer waits for the leader **and all in-sync replicas** to ack (governed by `min.insync.replicas`). Durable — survives leader failure as long as an ISR has the data. Slowest of the three.

Production durable setups use `acks=all` with `min.insync.replicas≥2` and replication factor ≥3.

---

### Q6. What's a dead-letter queue and when does a message go there?

**Answer:** A DLQ is a separate queue/topic where messages are routed after they've **exhausted their retry budget** — typically poison messages that fail processing every time (bad schema, missing referenced data, a bug). Without a DLQ, at-least-once retries loop on the bad message forever, blocking the queue/partition behind it. The DLQ quarantines failures so the main stream keeps flowing, alerts engineers, and gives a place to inspect, fix, and optionally re-drive the message after a code fix.

---

### Q7. Why is Kafka fast even though it writes to disk?

**Answer:** Several reasons working together: (1) **sequential disk I/O** — appending to a log is sequential, which is dramatically faster than random I/O and even competitive with memory for streaming workloads; (2) the **OS page cache** serves recent reads from RAM without Kafka managing its own cache; (3) **zero-copy** (`sendfile`) ships data from page cache to the network socket without copying through user space; (4) **batching and compression** amortize per-message overhead. The design embraces the disk's strengths rather than fighting them.

---

### Q8. What is log compaction and when do you use it?

**Answer:** Log compaction is a retention mode where Kafka keeps only the **latest message per key**, garbage-collecting older values for the same key (while preserving order of the surviving records). You use it for **changelog/state topics** where you care about the *current value* of each key, not the full history — e.g. a topic representing "current user profile" or a stream-processing state store / KTable. A new consumer can replay a compacted topic to rebuild the latest state for every key without replaying every historical update.

---

### Q9 (MCQ). A topic has 6 partitions. You add a 9-consumer group. How many consumers actively process messages?

A. 9
B. 6
C. 3
D. 1

**Answer: B.** Each partition is consumed by at most one consumer within a group, so only 6 consumers get a partition; the other 3 stay idle (available for failover). Parallelism is capped by partition count.

---

### Q10 (MCQ). Which statement about Kafka ordering is true?

A. Kafka guarantees total ordering across the whole topic
B. Kafka guarantees ordering within a partition only
C. Kafka guarantees ordering only if there's one consumer
D. Kafka never guarantees ordering

**Answer: B.** Ordering is guaranteed **within a single partition**. Messages with the same key go to the same partition (so per-key order holds), but across partitions there is no global order.

---

### Q11 (MCQ). You need many independent services to each receive *every* event (fan-out) and be able to replay history. Best fit:

A. RabbitMQ work queue (competing consumers)
B. Kafka topic with one consumer group per service
C. A single shared database table polled by all
D. SQS standard queue

**Answer: B.** Kafka retains the log and lets each service use its **own consumer group**, so every service independently reads every event and can replay by resetting offsets. A work queue (A) and a standard SQS queue (D) distribute each message to *one* consumer (no fan-out to all). Polling a table (C) doesn't scale and lacks proper streaming semantics.

---

### Q12. What problem do rebalances cause, and how do you reduce their impact?

**Answer:** A **rebalance** happens when consumer-group membership changes (a consumer joins, leaves, or is deemed dead). During a classic ("stop-the-world") rebalance, partitions are revoked and reassigned, briefly **pausing consumption** and potentially causing **redeliveries** (offsets not committed before revocation get reprocessed). Frequent rebalances ("rebalance storms") — often caused by slow consumers missing heartbeats — tank throughput. Mitigations: tune `session.timeout.ms`/`heartbeat.interval.ms` and `max.poll.interval.ms` so healthy-but-busy consumers aren't evicted; use **cooperative (incremental) rebalancing** so only affected partitions move instead of the whole assignment; keep processing per poll bounded; and make consumers idempotent so the redeliveries are harmless.
