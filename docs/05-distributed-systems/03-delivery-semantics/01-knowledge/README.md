# Delivery Semantics — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Idempotency, at-least/exactly-once, dedup.

Delivery semantics describe how many times a message/effect can be observed when networks drop packets and processes crash. The senior insight: **"exactly-once delivery" is essentially impossible at the network level; what you actually engineer is at-least-once delivery + idempotent processing, which yields exactly-once *effects*.**

---

## 1. The three semantics

- **At-most-once:** each message delivered zero or one time. The sender fires and forgets; on uncertainty, it does *not* retry. Fast, simple, but loses messages on failure. Acceptable for non-critical telemetry, metrics, "best-effort" notifications.
- **At-least-once:** each message delivered one or more times. The sender retries until it gets an ack; if the ack is lost, it retries an already-processed message → **duplicates**. This is the default for reliable messaging because it never loses data — at the cost of possible duplication.
- **Exactly-once:** each message's *effect* occurs once and only once. The holy grail. True exactly-once *delivery* over an unreliable network is impossible (the Two Generals problem); what systems deliver is **exactly-once processing/effects**, achieved by at-least-once delivery + dedup/idempotency, or by transactional coupling of consumption and effect.

**Why exactly-once delivery is impossible:** the sender can't know if a lost ack means "not delivered" or "delivered, ack lost." It must choose: retry (risk duplicate → at-least-once) or not (risk loss → at-most-once). There is no third option at the delivery layer.

---

## 2. Idempotency — the workhorse

**Definition:** an operation is idempotent if applying it N times has the same effect as applying it once. `SET x = 5` is idempotent; `x = x + 1` is not; `DELETE /user/42` is idempotent; `POST /charge` is not (by default).

How to make non-idempotent operations idempotent:
- **Idempotency keys:** caller attaches a unique key per *logical* operation (same key on every retry of that operation). The server records processed keys and returns the prior result on duplicates (insert-if-absent / upsert). This is how Stripe and most payment APIs work.
- **Natural idempotency via state checks:** "set status to SHIPPED if currently PACKED" — a no-op if already shipped.
- **Conditional writes / compare-and-set:** use a version/ETag so a stale retry is rejected.
- **Deduplication on a unique business key:** e.g. unique constraint on `(order_id, line_no)` so a duplicate insert fails harmlessly.

Idempotency turns the unavoidable duplicates of at-least-once delivery into harmless no-ops → **exactly-once effects**.

---

## 3. Deduplication mechanisms

- **Dedup store / table:** keyed by message-id or idempotency-key, with a TTL. Check-and-set before processing. Must be atomic with the effect (or at least durable) to be reliable.
- **Sequence numbers / offsets:** a consumer tracks the highest processed sequence per producer/partition; anything ≤ that is a duplicate (works when ordering is preserved per partition — Kafka's model).
- **Bloom filters / probabilistic dedup:** space-efficient for huge ID spaces, with a tunable false-positive rate (may wrongly drop a *new* message → use only when occasional loss is tolerable, or as a pre-filter).
- **Broker-side dedup windows:** e.g. Kafka's idempotent producer dedups retries within a producer session using a producer-id + sequence number; SQS FIFO dedups within a 5-minute window by message dedup-id.

**Dedup is always bounded** (by TTL/window/retention). True "forever" dedup is impractical; you size the window to cover the maximum realistic retry/replay horizon.

---

## 4. Exactly-once *effects* patterns

### Transactional outbox
To atomically "update my DB and publish an event," you can't span two systems with one transaction reliably. Instead: in the *same* DB transaction, write the business change **and** an `outbox` row. A separate relay reads the outbox and publishes to the broker (at-least-once), marking rows sent. Consumers dedup. This avoids "wrote to DB but crashed before publishing" and "published but DB rolled back."

### Inbox / consumer-side dedup
The consumer records processed message-ids in an `inbox` table *in the same transaction* as the side effect. A redelivered message finds its id already present and skips. Atomicity of (record-id + do-effect) is what makes it exactly-once.

### Kafka transactions / read-process-write
Kafka offers exactly-once *within Kafka*: consume → process → produce + commit offsets in one transaction (transactional producer + `read_committed`). The boundary matters — it's exactly-once for Kafka-to-Kafka pipelines, *not* automatically for external side effects (a DB write or an email still needs idempotency).

### Two-phase commit (2PC)
A coordinator drives prepare→commit across participants for true distributed atomicity. Gives strong guarantees but is **blocking** (coordinator failure stalls participants holding locks) and doesn't scale well — usually avoided in favor of sagas + idempotency for cross-service work.

---

## 5. Ordering (closely tied to dedup)

- **Total order** is expensive at scale; most systems offer **partition/key ordering** (Kafka: order guaranteed *within* a partition). Choosing a partition key (e.g. `account_id`) gives per-entity ordering, which is usually what you need.
- Out-of-order + duplicates together mean consumers should be **idempotent and order-tolerant** (or use sequence numbers to reorder/dedup).
- Retries can *reorder* messages; if order matters, you need per-key sequencing or a single in-flight request per key.

---

## 6. Key terms

| Term | Definition |
|---|---|
| At-most-once | 0 or 1 delivery; may lose, never duplicates. |
| At-least-once | ≥1 delivery; never loses, may duplicate. |
| Exactly-once (effects) | The observable effect happens once; achieved via at-least-once + idempotency/dedup. |
| Idempotency key | Client-supplied unique id per logical op; server dedups on it. |
| Transactional outbox | Write business change + event in one DB tx; relay publishes later. |
| Inbox pattern | Consumer records processed ids atomically with the effect to skip duplicates. |
| Poison message | A message that repeatedly fails processing; routed to a DLQ. |
| DLQ (dead-letter queue) | Holding queue for messages that exceeded retry limits. |
| Dedup window | Bounded time/offset range over which duplicates are detected. |

---

## 7. Tradeoffs

- **At-most-once vs at-least-once:** lose data vs duplicate data. Almost always pick at-least-once + idempotency (duplicates are recoverable; lost data often isn't).
- **Idempotency cost:** the dedup store is extra state on the hot path (latency, storage, TTL management) — but far cheaper than the alternative bugs.
- **Exactly-once via Kafka transactions:** real throughput cost and only covers Kafka boundaries; outbox/inbox are more portable but add a relay/table.
- **2PC vs saga:** 2PC = strong atomicity but blocking and low-scale; saga = scalable, non-blocking, but eventual consistency with compensations.

---

## 8. Common pitfalls & misconceptions

- **"My broker guarantees exactly-once, so I don't need idempotency."** The guarantee usually applies only *within* the broker; your external side effects (DB, payments, emails) still need idempotency.
- **Deduping in memory only.** A consumer restart loses the dedup state → duplicates slip through. Dedup state must be durable (or the effect itself idempotent).
- **Dedup not atomic with the effect.** "Check dedup table, then do effect" with a crash in between either double-processes or drops. Make record-and-effect one transaction.
- **Assuming order.** Retries and multi-partition consumption break ordering; design consumers to be order-tolerant or use per-key sequencing.
- **Unbounded dedup expectations.** Every dedup mechanism has a window; a replay older than the window will re-deliver.
- **Idempotency key reuse with different payloads.** Must detect and reject (409), or you return a stale cached result for a different request.

---

## 9. What interviewers probe

- *"Why is exactly-once delivery impossible, and what do we do instead?"*
- *"Design an idempotent payment endpoint."* (Idempotency key + insert-if-absent + store result.)
- *"You consume from a queue and write to a DB and send an email. A redelivery happens. How do you avoid double effects?"* (Inbox pattern; email is externally-visible → needs its own idempotency/dedup.)
- *"What's the transactional outbox and what problem does it solve?"*
- *"Kafka says exactly-once — is your pipeline actually exactly-once end-to-end?"* (Only within Kafka; external sinks need idempotency.)
- *"How do you handle a poison message?"* (Retry with backoff, cap, then DLQ + alert.)

---

## 10. Quick-reference summary

- **Three semantics:** at-most-once (may lose), at-least-once (may duplicate), exactly-once (effect-once).
- **Exactly-once *delivery* is impossible** over an unreliable network → engineer **at-least-once + idempotency = exactly-once effects.**
- **Idempotency:** idempotency keys, conditional/CAS writes, unique business keys, state checks.
- **Dedup:** dedup table (atomic with effect), sequence numbers/offsets, bounded windows; durable, never in-memory-only.
- **Cross-system exactly-once:** **transactional outbox** (producer side) + **inbox** (consumer side); Kafka transactions cover Kafka-to-Kafka only.
- **Ordering:** prefer per-key/partition order; make consumers order-tolerant.
- **Poison messages → DLQ** after bounded retries; alert and inspect.
