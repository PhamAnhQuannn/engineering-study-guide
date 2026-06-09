# Delivery Semantics — System Design Questions

[← Topic overview](../README.md)

> Topic: Idempotency, at-least/exactly-once, dedup.

Each prompt: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## D1. Design an idempotent order-placement API

**Requirements / Scale**
- Mobile + web clients retry aggressively on timeout; must never create duplicate orders.
- ~5k orders/s peak; p99 < 200 ms.
- Exactly-once *order creation* effect.

**High-level design**
- Client generates an **idempotency key** (UUID) per checkout attempt; sends it as a header on every retry of that attempt.
- Order service, in one DB transaction: `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`. If inserted → create order, store response. If conflict → fetch and return the stored response (dedup).
- Emit `OrderPlaced` via **transactional outbox** in the same transaction so downstream (payment, inventory, email) get the event reliably.
- Validate that a reused key with a *different* request body returns 409.

**Data model**
```
idempotency_keys(key PK, request_hash, order_id, response_body, status, expires_at)
orders(id PK, ...)
outbox(id PK, aggregate_id, type, payload, created_at, sent_at NULL)
```

**Scaling & bottlenecks**
- The idempotency table is on every write path; co-locate it with the orders DB so the insert + order creation share one transaction. Shard by key hash if needed.
- Outbox relay throughput; partition the outbox and run multiple relays with row-level locking (`FOR UPDATE SKIP LOCKED`).

**Tradeoffs & failure modes**
- *Failure:* crash after order created but before response stored → retry hits the conflict and re-reads the committed order (safe, because both committed together).
- *Failure:* key TTL too short → a very late client retry creates a duplicate. Size TTL > max client retry window (e.g. 24–72 h).
- Tradeoff: storing full responses costs space; alternative is storing just `order_id` and re-deriving the response.

---

## D2. Design exactly-once-effects processing for a payment-events consumer

**Requirements / Scale**
- Consume `PaymentAuthorized` events from Kafka, debit a wallet ledger, and notify the user.
- At-least-once delivery from Kafka (redeliveries on rebalance/crash). Must debit exactly once.

**High-level design**
- Consumer reads a batch; for each event, in **one DB transaction**: check/insert into `inbox(event_id)` (inbox pattern); if newly inserted, apply the ledger debit; commit. On redelivery, the `event_id` is already present → skip the debit.
- Commit Kafka offsets **after** the DB transaction commits (process-then-commit) so a crash before offset-commit causes redelivery, which the inbox safely dedups.
- User notification (external, irreversible) gets its **own** dedup keyed on `event_id` (record "notified" durably before/with sending).

**Data model**
```
inbox(event_id PK, processed_at)
ledger(account_id, entry_id PK, delta, balance_after, event_id UNIQUE)
notifications_sent(event_id PK, channel, sent_at)
```

**Scaling & bottlenecks**
- Per-partition ordering (key by `account_id`) gives per-account sequencing and lets you scale by adding partitions/consumers.
- Inbox table growth → TTL/partition prune old `event_id`s beyond the max redelivery horizon.

**Tradeoffs & failure modes**
- *Failure:* offset committed before DB commit (wrong order) → message lost on crash. Always commit offsets *after* the effect.
- *Failure:* notification sent but DB rolled back → user told about a debit that didn't happen. Mitigate by sending notifications from the outbox *after* commit, not inside the same path.
- Tradeoff: strict per-account ordering caps parallelism per account; usually fine.

---

## D3. Design at-least-once webhook delivery (you are the sender) with consumer-friendly dedup

**Requirements / Scale**
- You deliver event webhooks to thousands of customer endpoints; endpoints are flaky and slow.
- Must not lose events; minimize but expect duplicates; give customers a way to dedup.

**High-level design**
- Persist every event to a durable `deliveries` table with state `pending`. A delivery worker pulls pending deliveries, POSTs to the customer URL with a stable **`X-Event-Id`** and **HMAC signature**.
- On 2xx → mark `delivered`. On failure/timeout → **exponential backoff + jitter**, capped attempts; after the cap → `failed` (DLQ) + alert the customer.
- Provide customers `X-Event-Id` and document that they should **dedup on it** (since you guarantee at-least-once, not exactly-once).
- Offer idempotent re-drive: customers can replay from the `deliveries` log.

**Data model**
```
deliveries(id PK, event_id, endpoint_id, payload, state, attempts, next_attempt_at, last_status)
```

**Scaling & bottlenecks**
- Scheduler scanning `next_attempt_at` is a hot query → index it; shard by endpoint to isolate a slow customer (bulkhead) so one bad endpoint can't starve others.
- Backoff queues can grow during a customer outage; cap retention and surface DLQ depth.

**Tradeoffs & failure modes**
- *Failure:* customer returns 2xx but failed internally → from our side it's delivered; their dedup/idempotency must handle their own retries. We document the contract.
- *Failure:* duplicate delivery because their 2xx ack was lost on the wire → expected under at-least-once; `X-Event-Id` lets them dedup.
- Tradeoff: stronger guarantees (e.g. ordered per-tenant delivery) cost throughput and complexity; most webhook systems deliberately choose unordered at-least-once + dedup id.
