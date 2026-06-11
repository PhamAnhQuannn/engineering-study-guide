# Messaging & Queues — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Kafka, RabbitMQ, pub/sub, event-driven, streams.

Message queues and logs decouple producers from consumers in time, space, and rate. They are the backbone of asynchronous, event-driven architectures. The senior skill is knowing *which* broker model (queue vs log) fits a workload, and reasoning about ordering, durability, and backpressure.

> **🛒 Where we are in building ShopFast** — Last topic we mastered [Delivery Semantics](../../03-delivery-semantics/01-knowledge/README.md): idempotency keys and the transactional outbox make individual operations retry-safe. But ShopFast now needs to wire services together *asynchronously* — the order service must notify the inventory service, the email service, and analytics without waiting for each in sequence. This topic is the infrastructure layer that carries those events. **Next:** once we have multiple services talking over queues, we need them to *agree* on leadership and state — that's [Consensus & Replication](../../05-consensus-replication/01-knowledge/README.md).

---

## Teaching arc: making ShopFast async and event-driven

### What it is

A **message broker** is an intermediary that lets one part of your system send work to another without waiting for the response. The producer drops a message into the broker and immediately continues. The consumer picks it up whenever it's ready.

Analogy: think of a restaurant kitchen with a pass-through window. The waiter (producer) pins the order ticket to the rail and walks away to serve other tables. The chef (consumer) processes tickets at their own pace. If there's a rush, tickets pile up on the rail — the kitchen doesn't crash, it just has a longer queue. The waiter and chef work independently; neither has to know what the other is doing.

**ShopFast's canonical async work** (from the system facts): *"Slow work (emails, analytics, payment settlement) pushed to a queue + workers."* When an order is placed, the order service publishes an `order.confirmed` event. Independent workers handle inventory decrement, confirmation email, and analytics ingestion — all without blocking the checkout response.

### What it looks like

```
ShopFast event flow after order confirmation:

POST /v1/orders → [OrderService]
                        │
                        ├── INSERT orders (Postgres primary)
                        └── INSERT outbox row (same tx)
                                │
                          [Outbox relay / CDC]
                                │ publishes order.confirmed event
                                ↓
                         [Kafka topic: order-events]
                        ┌───────┴───────────┐──────────────────┐
                        ↓                   ↓                  ↓
               [InventoryWorker]   [EmailWorker]      [AnalyticsWorker]
               decrement stock     send email          write to warehouse
               (inbox dedup)       (dedup by order_id) (append-only, no dedup needed)

Each consumer group reads independently at its own offset.
A slow AnalyticsWorker doesn't delay InventoryWorker.
```

### The code that builds it

Producer side — publishing to the outbox, which the relay forwards to Kafka:

```typescript
// server: place order + write outbox event in one transaction
async function placeOrder(userId: string, productId: string, idempotencyKey: string) {
  return db.primary.transaction(async (tx) => {
    const order = await tx.query(
      "INSERT INTO orders (user_id, product_id, status) VALUES ($1,$2,'confirmed') RETURNING *",
      [userId, productId]
    );

    // Outbox row: written atomically with the order — never lost on crash
    await tx.query(
      "INSERT INTO outbox (topic, key, payload) VALUES ('order-events', $1, $2)",
      [order.rows[0].id, JSON.stringify({ type: "order.confirmed", orderId: order.rows[0].id })]
    );

    return order.rows[0];
  });
}
```

### The code that calls it

Consumer side — inventory worker using the inbox pattern (dedup) from the previous topic:

```typescript
// worker: inventory consumer, idempotent via inbox table
async function handleOrderConfirmed(message: KafkaMessage) {
  const { orderId, productId } = JSON.parse(message.value!.toString());
  const messageId = message.offset.toString(); // Kafka offset as dedup key

  await db.primary.transaction(async (tx) => {
    const already = await tx.query(
      "SELECT 1 FROM inbox WHERE message_id = $1", [messageId]
    );
    if (already.rows.length) return;  // duplicate — skip safely

    await tx.query(
      "UPDATE inventory SET stock = stock - 1 WHERE product_id = $1", [productId]
    );
    // Record as processed atomically with the inventory update
    await tx.query(
      "INSERT INTO inbox (message_id, processed_at) VALUES ($1, NOW())", [messageId]
    );
  });
}
```

### Types & differences

| Broker model | One-line | Reach for it when |
|---|---|---|
| **Message queue** (RabbitMQ, SQS) | Smart broker, per-message ack, deleted on consume | Task distribution: N workers drain one job queue, each job done once |
| **Log / stream** (Kafka, Pulsar, Kinesis) | Append-only partitioned log, consumer-managed offsets, replay | Event sourcing, fan-out to many consumers, audit trail, high throughput |
| **Pub/sub** (fan-out) | One message → all subscriber groups | Notifications, cache invalidation, broadcast |
| **Point-to-point** (work queue) | One message → one consumer | Load-balanced job processing |

**Queue vs Log one-liner:** a queue is a *to-do list* the broker hands out and crosses off; a log is a *durable transcript* consumers read at their own pace and can re-read.

### Build it for real — ShopFast

ShopFast's canonical fact: *"Slow work (emails, analytics, payment settlement) pushed to a queue + workers."* Combined with the delivery-semantics decision: *"inventory updates via async events."*

**Decision — Kafka for `order-events`:** multiple independent consumers (inventory, email, analytics) need to read the same event stream at their own pace and potentially replay on failure. A traditional message queue (RabbitMQ/SQS) deletes the message on first ack — you'd need three separate queues with fan-out routing, and you lose the ability to replay. Kafka's per-consumer-group offsets solve both: each consumer group reads the log independently.

**Decision — partition key = `order_id`:** all events for an order land in the same partition, guaranteeing per-order ordering. `InventoryWorker` always sees `order.confirmed` before `order.cancelled` for the same order.

**Decision — `acks=all` + `min.insync.replicas=2`:** ShopFast's order events are business-critical. We cannot afford to lose an `order.confirmed` event and fail to decrement inventory (oversell). Durability cost is acceptable because event publishing is not on the synchronous checkout response path.

**REJECTED — dual write (Postgres commit + Kafka produce in sequence):** a crash between the DB commit and the Kafka produce loses the event permanently. The inventory worker never runs; stock is never decremented. We use the transactional outbox + relay pattern (see [Delivery Semantics](../../03-delivery-semantics/01-knowledge/README.md)) instead.

> **If you get this wrong:** publishing events via a dual write means roughly 1-in-10,000 order confirmations silently fails to trigger inventory decrement (crash window). In a business doing 10,000 orders/day that's one silent oversell daily. By the time you notice — customer complaints, inventory audits — you've already shipped items you didn't have. Worse: the bug is non-deterministic and hard to reproduce in testing.

### Scaling story

- **Now (monolith, ~60 orders/minute peak):** a single Kafka topic with 3 partitions is overkill but free to operate. At this scale, even a simple Postgres-backed job queue (e.g. pg-boss, BullMQ) would work fine. But Kafka is a clean placeholder: consumer groups are already the right mental model, and switching from a simple queue to Kafka later without changing consumer code is hard.
- **Growth signal:** consumer lag on `order-events` rises above 30 s (email delivery delays); `InventoryWorker` is the bottleneck (single-threaded); analytics team wants to replay last 7 days of events for a new metric.
- **At scale (millions of orders/day):** increase partitions to match desired parallelism (one consumer instance per partition per group); enable log compaction on the `inventory-state` topic (keeps only the latest stock per product_id); dedicate topic-per-domain (order-events, payment-events, catalog-events) with separate retention policies. Consider Pulsar for multi-tenancy. CDC (Change Data Capture) via Debezium replaces the outbox relay for lower latency.

---

## 1. Two fundamental models

### Message queue (broker-managed, e.g. RabbitMQ, SQS, ActiveMQ)
- A message is delivered to **one** consumer (competing consumers / work queue) and then **removed/acked**.
- The broker tracks per-message state (delivered, acked, redelivered). This is "smart broker, dumb consumer."
- Great for **task distribution / job processing**: many workers pull from one queue, each job done once.
- Routing is rich: exchanges, bindings, routing keys, topic/fanout/direct exchanges (RabbitMQ/AMQP (Advanced Message Queuing Protocol)).

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
- **Replication:** each partition has a **leader** and **followers** (replicas). Producers write to the leader; followers replicate. **ISR (in-sync replicas)** are followers caught up to the leader.
- **acks:** `acks=0` (fire-and-forget), `acks=1` (leader only — data loss if leader dies before replication), `acks=all` (leader + all ISR — durable). `min.insync.replicas` sets how many ISR must ack.
- **Retention:** time-based or size-based; or **log compaction** (keep only the latest value per key — for changelog/state topics).
- **Throughput tricks:** sequential disk I/O, zero-copy, batching, page cache — why Kafka is fast despite using disk.

---

## 4. Core concepts every senior should hold

- **Decoupling:** producers and consumers don't need to be up at the same time, run at the same rate, or know about each other. Buys resilience and independent scaling.
- **Backpressure & buffering:** the queue absorbs bursts (within retention/depth limits). But a persistently slow consumer just grows lag — the queue is a shock absorber, not infinite capacity.
- **Consumer lag:** the gap between the latest offset and the consumer's committed offset. The #1 health metric for streaming — rising lag = consumers can't keep up.
- **Ordering:** total ordering is expensive; partition/key ordering is the practical norm. Choose keys so that things that must be ordered share a partition.
- **Delivery semantics:** brokers are typically **at-least-once** by default (see [Delivery Semantics](../../03-delivery-semantics/01-knowledge/README.md)). Exactly-once exists within Kafka (transactions) but external sinks still need idempotency.
- **DLQ (dead-letter queue):** where messages go after exceeding retry limits (poison messages), so they don't block the stream.
- **Fan-out / fan-in:** one event to many consumers (fan-out); many sources into one consumer (fan-in).
- **Push vs pull:** RabbitMQ pushes to consumers (with prefetch limits for flow control); Kafka consumers **pull** (consumer controls rate — natural backpressure).

---

## 5. Common patterns

- **Work queue / competing consumers:** scale consumers horizontally to drain a queue faster.
- **Event-driven / choreography:** services emit events; others react. Loose coupling, but harder to trace end-to-end (vs **orchestration**, where a central coordinator directs the flow).
- **Event sourcing:** store the *log of events* as the source of truth; rebuild state by replaying. Pairs naturally with a log broker + compaction.
- **CQRS (Command Query Responsibility Segregation):** separate write model (commands → events) from read models (projections built by consuming events).
- **Outbox + CDC (Change Data Capture):** publish events reliably from a DB via an outbox table or change-data-capture (Debezium) instead of dual writes.
- **Saga:** long-running multi-service workflow coordinated via messages, with compensating actions on failure.

---

## 6. Key terms

| Term | Definition |
|---|---|
| Partition | An ordered, independent log within a topic; unit of parallelism and ordering. |
| Offset | A consumer's position within a partition. |
| Consumer group | Set of consumers sharing a subscription; partitions are divided among members. |
| Consumer lag | Latest offset minus committed offset; how far behind a consumer is. |
| ISR (in-sync replicas) | Followers caught up enough to ack for `acks=all`. |
| Log compaction | Retention mode keeping only the latest message per key. |
| Prefetch / QoS | RabbitMQ limit on unacked messages per consumer (flow control). |
| DLQ (dead-letter queue) | Queue for messages that exhausted retries. |
| Fan-out | Delivering one message to many subscribers. |
| Rebalance | Reassigning partitions when group membership changes. |
| CDC (Change Data Capture) | Reading DB change stream (e.g. Postgres WAL) to publish events without dual writes. |

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
- **No DLQ (dead-letter queue).** Poison messages loop forever or block partitions.
- **Rebalance storms.** Frequent membership changes (slow consumers timing out) cause repeated rebalances and redeliveries; tune session/heartbeat timeouts and use cooperative rebalancing.
- **Dual writes.** Publishing after a DB commit without an outbox loses events on crash.

---

## 9. What interviewers probe

- *"Kafka vs RabbitMQ — when would you choose each?"*
- *"How does Kafka guarantee ordering? What breaks it?"* (Per-partition; multiple partitions, retries, repartitioning.)
- *"Your consumer lag is climbing — walk me through diagnosing and fixing it."*
- *"How do you scale consumers? What's the limit?"* (One consumer per partition per group → partitions cap parallelism.)
- *"acks=1 vs acks=all — what's the data-loss scenario?"*
- *"How would you publish events reliably from a service that also writes to a DB?"* (Outbox / CDC (Change Data Capture), not dual writes.)
- *"Design a DLQ (dead-letter queue) + retry strategy."*

---

## 10. Quick-reference summary

- **Queue (RabbitMQ/SQS):** smart broker, per-message ack, one-consumer-per-message, rich routing, deletes on ack. Best for task distribution.
- **Log (Kafka/Pulsar/Kinesis):** append-only partitioned log, consumer-managed offsets, retention + replay, per-partition ordering, multiple consumer groups. Best for streaming/event sourcing.
- **Partitions** = parallelism + ordering unit; **key** decides partition; one consumer per partition per group caps parallelism.
- **Durability:** `acks=all` + `min.insync.replicas` ≥ 2; replication via leader/followers/ISR (in-sync replicas).
- **Watch consumer lag** as the primary streaming health signal.
- **At-least-once by default** → make consumers idempotent; **DLQ (dead-letter queue)** poison messages.
- **Reliable publishing** via **outbox/CDC (Change Data Capture)**, not dual writes. **Event-driven** = loose coupling but trace with care.
