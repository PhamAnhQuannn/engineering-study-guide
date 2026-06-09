# Messaging & Queues — System Design Questions

[← Topic overview](../README.md)

> Topic: Kafka, RabbitMQ, pub/sub, event-driven, streams.

Each prompt: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## D1. Design an event backbone for an e-commerce platform (order lifecycle)

**Requirements / Scale**
- ~10k orders/s peak; many consumers (inventory, payments, search index, analytics, email).
- Each consumer must see every relevant event; ability to replay/rebuild read models.
- Per-order ordering (events for one order must apply in order).

**High-level design**
- **Kafka** as the log backbone. Topics per domain: `orders`, `payments`, `inventory`. Partition key = `order_id` → per-order ordering.
- Each downstream service is its **own consumer group** (fan-out: all see every event, independent offsets, independent replay).
- Producers use the **transactional outbox**: order service writes order + outbox row in one DB tx; a relay (or Debezium CDC) publishes to Kafka.
- Read models (search index, analytics) are projections built by consuming the log; rebuildable by resetting offsets.
- DLQ topic per consumer for poison messages.

**Data model (topic/event)**
```
orders topic: key=order_id, value={ event_type: Created|Paid|Shipped|..., order_id, version, payload }
```

**Scaling & bottlenecks**
- Partition count sets max consumer parallelism per group — size for peak/order-key skew (a "celebrity" SKU shouldn't hot-spot one partition; key by order_id, not product_id, to spread).
- Relay/CDC throughput; analytics consumer may lag — isolate slow consumers in their own group so they don't affect others.
- Storage for retention/replay; tune retention vs cost; compact state topics.

**Tradeoffs & failure modes**
- *Failure:* dual-write loss → solved by outbox/CDC.
- *Failure:* consumer lag on analytics during a spike → acceptable (eventual), but alert on lag trend.
- Tradeoff: choreography (event-driven) is loosely coupled but harder to trace end-to-end; add correlation ids + tracing.

---

## D2. Design a job-processing system (image/video transcoding)

**Requirements / Scale**
- Users upload media; jobs are CPU-heavy and variable-length (seconds to minutes).
- ~1k jobs/s submitted; must autoscale workers; each job done **once**; retries on failure; priority tiers.

**High-level design**
- A **work queue** fits better than a log here (each job done once, per-message ack, priority/TTL): **RabbitMQ** or **SQS**.
- Producers enqueue job messages; a pool of **competing-consumer** workers pulls jobs (prefetch=1 for long jobs so a slow worker doesn't hoard).
- **Visibility timeout / ack-on-completion:** a job is re-queued if a worker dies mid-process (at-least-once) → workers must be **idempotent** (key on job_id; check if output already exists).
- **Priority:** separate high/normal/low queues (or RabbitMQ priorities); workers drain high first.
- **DLQ** after N failed attempts + alert.
- Autoscale workers on **queue depth / age of oldest message**.

**Data model**
```
job message: { job_id, input_url, params, attempt, priority }
job_status table: job_id PK, state, output_url, attempts
```

**Scaling & bottlenecks**
- Worker pool vs queue depth — autoscale on backlog; cap to avoid thundering the storage/output sink.
- Long jobs + visibility timeout: timeout must exceed worst-case job time or you get spurious re-queues (duplicate work).

**Tradeoffs & failure modes**
- *Failure:* worker dies mid-job → re-queued; idempotency prevents duplicate output.
- *Failure:* poison job (corrupt media) loops → DLQ.
- Tradeoff: queue (one-time delivery, easy priority) over log here; we don't need replay/fan-out, so a log's complexity isn't worth it.

---

## D3. Design a notification fan-out service (push/email/SMS) from a single event

**Requirements / Scale**
- One business event (e.g. `PriceDropped`) may notify millions of subscribed users across channels.
- Must not double-notify; respect per-user channel preferences and rate limits.

**High-level design**
- Event lands on a Kafka topic. A **fan-out service** consumes it, expands to the subscriber list, and produces per-recipient `notification` messages (partition key = `user_id` for per-user ordering and dedup locality).
- Channel workers (push, email, SMS) are separate consumer groups; each does the actual send with **idempotency keyed on (event_id, user_id, channel)** (external sends are irreversible → durable dedup).
- **Rate limiting / load shedding** per channel provider (token bucket) and per user (don't spam).
- DLQ per channel; retry with backoff for transient provider failures.

**Data model**
```
notification: { event_id, user_id, channel, payload }
sent_log: (event_id, user_id, channel) PK, sent_at   -- durable dedup
```

**Scaling & bottlenecks**
- The fan-out step is the amplification point (1 event → millions of messages); parallelize the expansion (chunk the subscriber list, partition by user_id range) so one partition doesn't carry the whole expansion.
- Provider rate limits become the real bottleneck — buffer and pace.

**Tradeoffs & failure modes**
- *Failure:* fan-out service crashes mid-expansion → make expansion resumable (checkpoint progress) or idempotent so re-running doesn't double-enqueue.
- *Failure:* provider outage → backoff + DLQ; degrade gracefully (skip a down channel, still send others).
- Tradeoff: precompute subscriber lists vs query at fan-out time — precompute scales the hot path but needs maintenance; query is simpler but can be slow for huge audiences.
