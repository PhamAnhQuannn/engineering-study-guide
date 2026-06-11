# Transactions & Isolation — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: ACID, isolation levels, locking, MVCC, deadlock.

Each prompt names options, recommends with reasoning, and states **what would change the answer.**

---

### DQ1. Read Committed vs Repeatable Read vs Serializable for a given workload

**Options:** A) Read Committed (default). B) Repeatable Read / Snapshot Isolation. C) Serializable.

**Recommendation:** Default to **Read Committed** — highest concurrency, lowest overhead — and handle the specific races (lost update) with atomic updates or row locks where they occur. Step up to **Repeatable Read** when a transaction must see a *stable snapshot* across multiple reads (e.g., a multi-statement report or consistency-sensitive read-modify-write of several rows). Use **Serializable** only when correctness depends on preventing **write skew** and you can't easily express the invariant as a constraint — and you're prepared to retry on serialization failures.

**What would change it:** Presence of write-skew-style invariants (push to Serializable), how much you can localize protection with `FOR UPDATE`/atomic updates (lets you stay at Read Committed), and throughput sensitivity to abort/retry rates.

---

### DQ2. Optimistic vs pessimistic concurrency control

**Options:** A) Optimistic (version check + retry). B) Pessimistic (`SELECT ... FOR UPDATE`). C) Serializable isolation (DB does it).

**Recommendation:** Low conflict probability and stateless request flows (don't hold a lock across a client round-trip) → **optimistic**: cheap, scalable, no held locks. High contention on the same rows where retries would thrash → **pessimistic**: lock once, avoid wasted work, accept lower concurrency and deadlock-management cost. Use **Serializable** when conflicts are complex/multi-row and you'd rather let the engine detect them than hand-roll locking.

**What would change it:** The measured conflict rate (high → pessimistic), whether think-time/round-trips happen mid-transaction (favors optimistic), and deadlock tolerance.

---

### DQ3. Enforce uniqueness with a DB unique constraint vs application check

**Options:** A) DB `UNIQUE` constraint/index. B) App "SELECT then INSERT if absent." C) Both.

**Recommendation:** Always use the **DB unique constraint** (A, or C for nicer error UX). The app-only check (B) has a check-then-act race: two concurrent requests both SELECT "absent," both INSERT, both succeed (or one errors only because the constraint existed anyway). The unique index is the only mechanism that's atomic under concurrency. Pattern: attempt the INSERT and handle the unique-violation error (`ON CONFLICT`/upsert), rather than pre-checking.

**What would change it:** Essentially nothing for correctness — the DB constraint is mandatory. App checks only add early/friendlier feedback.

---

### DQ4. Handle a lost-update risk: atomic `UPDATE ... SET x = x - n` vs `SELECT FOR UPDATE` vs optimistic version

**Options:** A) Single atomic conditional update. B) `SELECT ... FOR UPDATE` then update. C) Read `version`, update `WHERE version=:v`, retry.

**Recommendation:** If the new value is a pure function of the old value computable in SQL (decrement, increment, set-if-condition), prefer **A** — one statement, one lock, no round-trip, no retry: `UPDATE inventory SET qty = qty - :n WHERE id=:id AND qty >= :n`. If the new value requires application logic between read and write (complex computation, external data), use **B** (high contention) or **C** (low contention).

**What would change it:** Whether the update is expressible atomically in SQL (yes → A), contention level (B vs C), and whether application code must run between the read and write.

---

### DQ5. Cross-service consistency: distributed transaction (2PC) vs saga vs outbox

**Options:** A) Two-phase commit across services. B) Saga (local transactions + compensations). C) Outbox + async events.

**Recommendation:** Avoid **2PC** in microservices — it's blocking, couples services, holds locks across the network, and degrades availability. Use a **saga** for multi-step business workflows that can tolerate eventual consistency and have natural compensating actions (refund, cancel). Use the **outbox pattern** to make "update DB and publish event" atomic within a single service without 2PC. Reserve 2PC for the rare case where you genuinely need synchronous cross-resource atomicity and control both resources (e.g., a single XA-capable DB + queue) and can accept the cost.

**What would change it:** Whether eventual consistency is acceptable (yes → saga/outbox), the availability SLO (2PC hurts it), and whether compensations are feasible for each step.

---

### DQ6. Retry-on-serialization-failure vs lower isolation to avoid aborts

**Options:** A) Keep Serializable, retry aborted transactions. B) Drop to Read Committed + targeted locks. C) Repeatable Read as a middle ground.

**Recommendation:** If correctness truly needs serializability and abort rates are low, **A** — design transactions to be idempotent/retryable and retry with backoff; this keeps the strongest guarantee. If aborts are frequent enough to hurt throughput, analyze the conflicting transactions: often you can drop to **B** and protect just the conflicting rows with `FOR UPDATE`/atomic updates, getting correctness without global serialization cost.

**What would change it:** The serialization-failure/abort rate under real load (high → push protection down to specific rows at lower isolation), and how cheap/safe retries are (idempotent work makes A attractive).

---

### DQ7. Durability tuning: synchronous commit vs relaxed durability for throughput

**Options:** A) Full synchronous commit (fsync on every commit). B) Relaxed/async commit (`synchronous_commit=off`, group commit). C) Synchronous replication to a replica.

**Recommendation:** For data you cannot lose (payments, ledgers), keep **synchronous commit** (A) and consider **synchronous replication** (C) so a committed transaction survives a single-node loss. For high-volume, loss-tolerant data (metrics, analytics events, recoverable derived data), **relaxed durability** (B) trades a small window of recent commits for major throughput. Group commit batches fsyncs to recover some throughput while staying durable.

**What would change it:** The cost of losing the last few hundred milliseconds of commits on crash (financial/regulatory → A/C), write throughput requirements, and whether the data is reconstructable from another source (tolerant → B).
