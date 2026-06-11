# Delivery Semantics — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Idempotency, at-least/exactly-once, dedup.

Delivery semantics describe how many times a message/effect can be observed when networks drop packets and processes crash. The senior insight: **"exactly-once delivery" is essentially impossible at the network level; what you actually engineer is at-least-once delivery + idempotent processing, which yields exactly-once *effects*.**

> **🛒 Where we are in building ShopFast** — Last topic we established the [Consistency & CAP](../../02-consistency-cap/01-knowledge/README.md) split: cart is AP (Available, Partition-tolerant)/eventual, order/payment is CP (Consistent, Partition-tolerant)/strong. But "strong consistency on writes" doesn't solve the retry problem: a mobile client that times out and retries `POST /v1/orders` can still trigger two payments. This topic explains exactly why that happens and the engineering patterns — idempotency keys, transactional outboxes, dedup tables — that make retries safe. **Next:** now we know *how many times* effects happen, we need the infrastructure that moves events between services reliably — that's [Messaging & Queues](../../04-messaging-queues/01-knowledge/README.md).

---

## Teaching arc: making ShopFast's payment retry-safe

### What it is

**Delivery semantics** describe the guarantee a messaging or API system makes about how many times a message's *effect* reaches a consumer. There are three:

- **At-most-once:** fire and forget. The sender doesn't retry. Fast, simple — but messages vanish silently on network failure.
- **At-least-once:** the sender retries until it gets an acknowledgement. No data loss — but duplicates happen whenever an ack is lost.
- **Exactly-once (effects):** the observable *outcome* happens exactly once. The holy grail. True exactly-once *delivery* over an unreliable network is mathematically impossible (the **Two Generals problem** — two armies communicating across an unreliable messenger can never be certain both are ready to attack), but exactly-once *effects* are achievable by combining at-least-once delivery with idempotent processing.

Analogy: imagine faxing a signed contract. You fax it, but your machine says "transmission uncertain." Do you fax again? If you don't, the contract may never arrive (at-most-once). If you do, the recipient might sign it twice (at-least-once duplicates). The solution: stamp the contract with a unique document ID. If the recipient already has document #1042 on file, they shred the duplicate and send you a "received" confirmation — the effect (one signed contract) happened exactly once even though you transmitted twice.

### What it looks like

```
ShopFast payment retry sequence:

Mobile client                  ShopFast API               Postgres
─────────────                  ────────────               ────────
POST /v1/orders                                            
  Idempotency-Key: abc-123  ──→  Check dedup table
  (network drops response)       "abc-123" seen? NO
                                 → charge payment
                                 → INSERT order
                                 → INSERT dedup(abc-123, result)  ←── atomic
                                 ← 201 Created  (lost in transit)

POST /v1/orders                  
  Idempotency-Key: abc-123  ──→  Check dedup table
  (client retries)               "abc-123" seen? YES
                                 ← 200 (return stored result)     ← no charge!

Result: one charge, one order. The duplicate was a harmless no-op.
```

### The code that builds it

The server-side idempotency key handler — the atomic check-and-store that turns at-least-once delivery into exactly-once effects:

```typescript
// server: idempotency-key dedup for POST /v1/orders
async function placeOrderIdempotent(
  userId: string,
  productId: string,
  idempotencyKey: string   // client-supplied per ShopFast API design
) {
  return db.primary.transaction(async (tx) => {
    // 1. Check if we already processed this key
    const existing = await tx.query(
      "SELECT result FROM idempotency_keys WHERE key = $1",
      [idempotencyKey]
    );
    if (existing.rows[0]) {
      return existing.rows[0].result;   // return the SAME result — no re-charge
    }

    // 2. Do the actual work
    const order = await tx.query(
      "INSERT INTO orders (user_id, product_id, status) VALUES ($1,$2,'confirmed') RETURNING *",
      [userId, productId]
    );

    // 3. Record the key + result atomically — both commit or both roll back
    await tx.query(
      "INSERT INTO idempotency_keys (key, result, created_at) VALUES ($1, $2, NOW())",
      [idempotencyKey, order.rows[0]]
    );

    return order.rows[0];
  });
}
```

### The code that calls it

The client side: generate a stable, unique key per *logical* operation, then retry freely:

```typescript
// client: generate the key ONCE, before any attempt; reuse on retry
async function checkout(userId: string, productId: string) {
  const idempotencyKey = crypto.randomUUID();   // stable key for this checkout

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.shopfast.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,     // same key every retry
        },
        body: JSON.stringify({ userId, productId }),
      });
      if (res.ok) return res.json();
    } catch {
      await sleep(200 * 2 ** attempt);  // exponential backoff
    }
  }
  throw new Error("checkout failed after retries");
}
```

### Types & differences

| Pattern | When to use | Atomicity requirement | ShopFast example |
|---|---|---|---|
| **Idempotency key** | HTTP POST / payment APIs | Key + effect in one transaction | `POST /v1/orders` dedups charges |
| **Natural idempotency** | State transitions | None — state check is the guard | `SET status = SHIPPED WHERE status = PACKED` |
| **Conditional write / CAS** | Optimistic lock | Atomic compare-and-swap | Update inventory only if stock = expected |
| **Transactional outbox** | DB write + event publish | Same DB transaction | Write order + publish `order.placed` event atomically |
| **Inbox pattern** | Consume event + DB effect | Same DB transaction | Consumer records message-id + inserts order row |
| **Kafka transactions** | Kafka-to-Kafka pipelines | Kafka producer transaction | Consume payment event → produce confirmation event |
| **2PC (two-phase commit)** | Cross-system strong atomicity | Distributed coordinator | Rarely — blocking, doesn't scale; prefer sagas |

### Build it for real — ShopFast

The canonical ShopFast API fact states: *"`POST /v1/orders` is not idempotent → client sends an `Idempotency-Key` header; server dedups retried charges."*

**Decision — payment idempotency key:** every checkout request carries a `UUID` idempotency key generated by the client *before* the first attempt. The server checks an `idempotency_keys` table within the same Postgres transaction that creates the order. On retry, the server returns the stored result without re-charging. The TTL on the table is 24 hours — enough to cover any realistic mobile retry window.

**Decision — inventory update via async events:** ShopFast canonical: *"inventory updates via async events."* When an order is confirmed, the order service publishes an `order.confirmed` event to a queue. The inventory service consumes this event and decrements stock. To prevent double-decrement on redelivery, the inventory consumer uses the **inbox pattern**: it records the message-id in the same transaction as the `UPDATE inventory` query.

**REJECTED — dual write (publish + DB commit separately):** if the service writes the order to Postgres and then publishes the event, a crash between those two steps loses the event. Inventory never decrements. The transactional outbox solves this by writing the event *into* the same DB transaction as the order.

> **If you get this wrong:** a customer on a flaky mobile network taps "Buy" three times while the app waits for a response. No idempotency keys → three orders, three charges, one furious customer. In a flash sale with 10,000 concurrent buyers, duplicate charges are not hypothetical — they are the default outcome on any network. Chargebacks, support tickets, and lost trust are the real-world consequence.

### Scaling story

- **Now (monolith):** `idempotency_keys` table in Postgres, TTL 24 h, index on `(key)`. The outbox is a single table in the same schema. Negligible cost. Placeholders: event schema must include a `message_id` field from day one so the inbox pattern works when consumers are added.
- **Growth signal:** dedup table gets large; TTL cleanup job shows up in DB metrics; payment team wants a dedicated dedup service.
- **At scale (services split):** idempotency key store extracted to Redis (fast, TTL native); transactional outbox read by a CDC (Change Data Capture) relay (Debezium) that publishes to Kafka; inbox pattern enforced by a framework (Axon, NestJS CQRS) so no developer forgets it. Kafka's idempotent producer + `acks=all` (see [Messaging & Queues](../../04-messaging-queues/01-knowledge/README.md)) handles broker-level dedup within the pipeline.

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
- **Conditional writes / compare-and-set (CAS):** use a version/ETag so a stale retry is rejected.
- **Deduplication on a unique business key:** e.g. unique constraint on `(order_id, line_no)` so a duplicate insert fails harmlessly.

Idempotency turns the unavoidable duplicates of at-least-once delivery into harmless no-ops → **exactly-once effects**.

---

## 3. Deduplication mechanisms

- **Dedup store / table:** keyed by message-id or idempotency-key, with a TTL. Check-and-set before processing. Must be atomic with the effect (or at least durable) to be reliable.
- **Sequence numbers / offsets:** a consumer tracks the highest processed sequence per producer/partition; anything ≤ that is a duplicate (works when ordering is preserved per partition — Kafka's model).
- **Bloom filters / probabilistic dedup:** space-efficient for huge ID spaces, with a tunable false-positive rate (may wrongly drop a *new* message → use only when occasional loss is tolerable, or as a pre-filter).
- **Broker-side dedup windows:** e.g. Kafka's idempotent producer dedups retries within a producer session using a producer-id + sequence number; SQS (Simple Queue Service) FIFO dedups within a 5-minute window by message dedup-id.

**Dedup is always bounded** (by TTL/window/retention). True "forever" dedup is impractical; you size the window to cover the maximum realistic retry/replay horizon.

---

## 4. Exactly-once *effects* patterns

### Transactional outbox
To atomically "update my DB and publish an event," you can't span two systems with one transaction reliably. Instead: in the *same* DB transaction, write the business change **and** an `outbox` row. A separate relay reads the outbox and publishes to the broker (at-least-once), marking rows sent. Consumers dedup. This avoids "wrote to DB but crashed before publishing" and "published but DB rolled back."

### Inbox / consumer-side dedup
The consumer records processed message-ids in an `inbox` table *in the same transaction* as the side effect. A redelivered message finds its id already present and skips. Atomicity of (record-id + do-effect) is what makes it exactly-once.

### Kafka transactions / read-process-write
Kafka offers exactly-once *within Kafka*: consume → process → produce + commit offsets in one transaction (transactional producer + `read_committed`). The boundary matters — it's exactly-once for Kafka-to-Kafka pipelines, *not* automatically for external side effects (a DB write or an email still needs idempotency).

### 2PC (two-phase commit)
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
| 2PC (two-phase commit) | Distributed protocol: coordinator drives prepare→commit across all participants. |

---

## 7. Tradeoffs

- **At-most-once vs at-least-once:** lose data vs duplicate data. Almost always pick at-least-once + idempotency (duplicates are recoverable; lost data often isn't).
- **Idempotency cost:** the dedup store is extra state on the hot path (latency, storage, TTL management) — but far cheaper than the alternative bugs.
- **Exactly-once via Kafka transactions:** real throughput cost and only covers Kafka boundaries; outbox/inbox are more portable but add a relay/table.
- **2PC (two-phase commit) vs saga:** 2PC = strong atomicity but blocking and low-scale; saga = scalable, non-blocking, but eventual consistency with compensations.

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
- *"How do you handle a poison message?"* (Retry with backoff, cap, then DLQ (dead-letter queue) + alert.)

---

## 10. Quick-reference summary

- **Three semantics:** at-most-once (may lose), at-least-once (may duplicate), exactly-once (effect-once).
- **Exactly-once *delivery* is impossible** over an unreliable network → engineer **at-least-once + idempotency = exactly-once effects.**
- **Idempotency:** idempotency keys, conditional/CAS (compare-and-set) writes, unique business keys, state checks.
- **Dedup:** dedup table (atomic with effect), sequence numbers/offsets, bounded windows; durable, never in-memory-only.
- **Cross-system exactly-once:** **transactional outbox** (producer side) + **inbox** (consumer side); Kafka transactions cover Kafka-to-Kafka only.
- **Ordering:** prefer per-key/partition order; make consumers order-tolerant.
- **Poison messages → DLQ (dead-letter queue)** after bounded retries; alert and inspect.
