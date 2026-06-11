# Delivery Semantics — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Idempotency, at-least/exactly-once, dedup.

Named options, a reasoned recommendation, and **what would change the answer.**

---

### Dec1. At-most-once vs at-least-once for an event pipeline

- **A — At-most-once:** fire-and-forget, no retries; may lose events.
- **B — At-least-once:** retry until acked; may duplicate.

**Recommendation:** **B (at-least-once) + idempotent consumers** for anything where data loss matters (orders, payments, audit, billing). Duplicates are recoverable via dedup; lost events usually aren't. Reserve **A** for genuinely disposable, high-volume signals (metrics, presence) where the cost of dedup outweighs the harm of an occasional drop.

**What would change the answer:** If duplicates are *more* harmful than loss and can't be made idempotent (rare), or if volume is so extreme that durable retry is infeasible, at-most-once becomes the pragmatic pick.

---

### Dec2. Idempotency keys (client-supplied) vs server-derived natural dedup key

- **A — Client idempotency key:** caller sends a UUID per attempt.
- **B — Natural business key:** dedup on `(order_id, line)` / `(account, txn_ref)` already in the data.

**Recommendation:** Use **B when a stable natural key exists** — it's robust, doesn't depend on client discipline, and a unique constraint enforces it at the DB. Use **A (client key)** when there's no natural uniqueness (e.g. "create a new order" has no pre-existing id) or the client may legitimately submit two near-identical requests that must be distinguished.

**What would change the answer:** If clients are untrusted or buggy and might omit/reuse keys, lean on natural keys / server-side derivation. If the operation is inherently "new every time" with no natural key, you must use client keys.

---

### Dec3. Transactional outbox vs dual writes vs 2PC for "update DB and publish event"

- **A — Dual writes:** write DB, then publish (or vice versa), no coupling.
- **B — Transactional outbox:** write change + outbox row in one tx; relay publishes.
- **C — 2PC:** distributed transaction across DB and broker.

**Recommendation:** **B (outbox).** Dual writes (A) are the classic bug — a crash between the two leaves them inconsistent. 2PC (C) gives atomicity but is blocking, low-throughput, and many brokers don't support it well. The outbox achieves atomicity using only a local DB transaction plus an async relay, scaling cleanly.

**What would change the answer:** If your broker and DB both support efficient 2PC *and* you need synchronous cross-system atomicity at low scale, 2PC is defensible. If the event is purely best-effort, even dual writes may be tolerable.

---

### Dec4. Exactly-once via Kafka transactions vs at-least-once + idempotent sinks

- **A — Kafka transactions (EOS):** transactional producer/consumer for Kafka-to-Kafka.
- **B — At-least-once + idempotent sinks:** simpler delivery, dedup at each sink.

**Recommendation:** Use **A** only when the whole pipeline is **Kafka-to-Kafka** (stream processing producing back to Kafka), where EOS is clean and worth the throughput cost. The moment an *external* sink (DB, payment, email) is involved, A doesn't cover it anyway — so prefer **B**, which is portable and forces you to make each sink idempotent (which you'd need regardless).

**What would change the answer:** A pure Kafka Streams topology with no external side effects strongly favors A. A heterogeneous pipeline with external sinks favors B everywhere.

---

### Dec5. Dedup with a durable store vs probabilistic (Bloom filter) dedup

- **A — Durable dedup table** (exact, keyed by id, TTL).
- **B — Bloom filter** (probabilistic, space-efficient, false positives possible).

**Recommendation:** **A (exact)** whenever a false positive (wrongly treating a *new* message as a duplicate → dropping it) is unacceptable — payments, orders, anything financial/auditable. Use **B** only as a *pre-filter* in front of an exact check, or for huge-scale, loss-tolerant dedup (e.g. "have I seen this URL") where occasional drops are fine.

**What would change the answer:** Extreme cardinality where an exact store is too expensive, *and* the cost of a rare false-positive drop is negligible, justifies Bloom filters — ideally combined with an exact fallback.

---

### Dec6. Saga (with compensations) vs 2PC for a multi-service transaction

- **A — Saga:** local transactions + compensating actions; eventual consistency.
- **B — 2PC:** synchronous distributed commit; strong atomicity.

**Recommendation:** **A (saga)** for most microservice workflows (order → payment → inventory → shipping). It's non-blocking, scales, and tolerates partial failure via compensations. 2PC's blocking coordinator and lock-holding make it a poor fit across service/network boundaries at scale.

**What would change the answer:** If the steps *cannot* be compensated (truly irreversible, no business undo) and you need strict atomicity at low scale within one trust/admin boundary, 2PC may be warranted. Strong latency-sensitive consistency needs also push toward 2PC or a single transactional store.

---

### Dec7. Ordered delivery (per-key) vs unordered + idempotent consumers

- **A — Strict per-key ordering** (single partition per key, one in-flight).
- **B — Unordered, idempotent, order-tolerant consumers.**

**Recommendation:** Default to **B** — it scales better and is more resilient, since retries naturally reorder anyway. Add **A (per-key ordering)** only for the specific keys/entities where ordering is a correctness requirement (e.g. a state machine where "ship" must follow "pack"), using a partition key like `entity_id`.

**What would change the answer:** Workloads that are fundamentally sequential per entity (event-sourced aggregates, ledgers with running balances) need A for those keys. Pure independent events need only B.
