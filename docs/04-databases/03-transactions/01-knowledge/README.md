# Transactions & Isolation — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: ACID, isolation levels, locking, MVCC, deadlock.

Senior study notes on transactions: what ACID actually guarantees, the isolation-level ladder and the anomalies each prevents, how MVCC and locking implement isolation, and the concurrency bugs that show up in production.

---

## 1. ACID — what each letter guarantees

- **Atomicity** — all-or-nothing. A transaction's writes either all commit or none do. Implemented via a write-ahead log (WAL/redo) and undo: on crash or `ROLLBACK`, partial effects are reversed. Atomicity is about *failure handling*, not concurrency.
- **Consistency** — a transaction moves the DB from one valid state to another, preserving declared invariants (constraints, FKs, triggers). This is largely the *application's + constraints'* responsibility; the DB enforces the declared rules.
- **Isolation** — concurrent transactions don't see each other's uncommitted/intermediate state in ways the chosen isolation level forbids. The hardest letter; the rest of this note is mostly about it.
- **Durability** — once committed, survives crashes. Implemented by flushing the WAL to stable storage (`fsync`) before acknowledging commit. Tradeoffs: group commit, `synchronous_commit` settings, replication-based durability.

A transaction is the unit that bundles these: `BEGIN ... COMMIT/ROLLBACK`.

---

## 2. The concurrency anomalies (what isolation prevents)

Defined by the SQL standard (and extended in practice):

- **Dirty read** — read another transaction's *uncommitted* write (which may roll back).
- **Non-repeatable read** — re-reading the same row in one transaction returns different values because another transaction committed an update in between.
- **Phantom read** — re-running the same *range* query returns different *rows* because another transaction inserted/deleted rows matching the predicate.
- **Lost update** — two transactions read a value, both compute from it, both write; one overwrite is silently lost (classic read-modify-write race).
- **Write skew** — two transactions read an overlapping set, each writes a *different* row, and together they violate an invariant that neither violates alone (e.g., both doctors go off-call because each saw the other still on-call). The signature anomaly that Snapshot Isolation allows but Serializable forbids.

---

## 3. Isolation levels (the ladder)

The SQL standard defines four levels by which anomalies they *permit*:

| Level | Dirty read | Non-repeatable read | Phantom | Notes |
|---|---|---|---|---|
| **Read Uncommitted** | possible | possible | possible | rarely useful; Postgres treats it as Read Committed |
| **Read Committed** | no | possible | possible | each *statement* sees a fresh snapshot of committed data (default in Postgres, Oracle, SQL Server) |
| **Repeatable Read** | no | no | possible* | a transaction-wide snapshot; *Postgres's RR (snapshot isolation) also prevents phantoms but allows write skew |
| **Serializable** | no | no | no | result equivalent to *some* serial order; the only level safe against write skew |

Important nuances seniors must know:
- **The names are not portable.** Postgres "Repeatable Read" is **Snapshot Isolation** (no phantoms, but write skew possible). MySQL/InnoDB "Repeatable Read" (the default) uses next-key locking and prevents many phantoms but has its own quirks. Always say *which engine*.
- **Read Committed allows lost updates** in a naive read-then-write; you must use atomic updates, `SELECT ... FOR UPDATE`, or optimistic version checks.
- **Serializable isn't free**: Postgres implements it as **SSI** (Serializable Snapshot Isolation), which can abort transactions with a serialization failure — the app must **retry**. SQL Server/MySQL implement it with heavier locking (lower concurrency, deadlock risk).

---

## 4. MVCC — Multi-Version Concurrency Control

The dominant mechanism (Postgres, Oracle, MySQL/InnoDB, etc.). Core idea: **readers don't block writers and writers don't block readers** because each row can have multiple versions.

- A write creates a **new version** of the row; old versions remain visible to transactions whose snapshot predates the write.
- Each transaction reads against a **snapshot** (a consistent point-in-time view) defined by transaction IDs / visibility rules.
- Visibility: a version is visible if it was committed before the reader's snapshot and not deleted/superseded by another committed transaction in that snapshot.

**Consequences / costs:**
- **Bloat**: dead (no-longer-visible) row versions accumulate. Postgres reclaims them with **VACUUM** (and `autovacuum`); failing to vacuum causes table/index bloat and, ultimately, transaction-ID **wraparound** danger. InnoDB uses an **undo log** / purge thread; long transactions pin old versions and grow the undo log / history list.
- **Long-running transactions are toxic**: they hold back the "oldest visible snapshot," preventing cleanup of dead tuples DB-wide. A reporting query left open for hours can bloat the whole database.
- MVCC makes consistent reads cheap but makes `COUNT(*)` and uniqueness checks do real work (must check visibility).

---

## 5. Locking

Even MVCC systems lock for writes and for some reads.

- **Shared (S) vs Exclusive (X) locks** — many readers share; a writer needs exclusive.
- **Row locks** — `SELECT ... FOR UPDATE` (exclusive, for read-modify-write), `FOR SHARE`/`FOR KEY SHARE` (weaker). Used to serialize concurrent updates to the same row and prevent lost updates.
- **`SKIP LOCKED` / `NOWAIT`** — for queue/worker patterns: grab the next *unlocked* row without blocking (`SELECT ... FOR UPDATE SKIP LOCKED`).
- **Table locks** — taken by DDL (`ALTER TABLE`) and some operations; can stall all access. Use `lock_timeout` to fail fast rather than queue behind a long lock.
- **Gap / next-key locks** (InnoDB) — lock ranges to prevent phantom inserts at Repeatable Read.
- **Predicate / SIREAD locks** (Postgres SSI) — track read/write dependencies to detect serialization conflicts without blocking.
- **Optimistic vs pessimistic**:
  - *Pessimistic* — lock first (`FOR UPDATE`), then modify. Good under high contention; risks deadlock and reduced concurrency.
  - *Optimistic* — read a `version`/`updated_at`, compute, then `UPDATE ... WHERE version = :v`; if zero rows updated, someone else won → retry. Good under low contention; no locks held across think-time.

---

## 6. Deadlocks

A cycle of transactions each waiting on a lock the other holds. The DB's deadlock detector picks a **victim** and aborts it with an error; the app must catch and retry.

- **Cause:** transactions acquire the same locks in **different orders** (T1 locks A then B; T2 locks B then A).
- **Prevention/mitigation:**
  - Acquire locks in a **consistent global order** (e.g., always lock rows by ascending PK).
  - Keep transactions **short**; do no network/user I/O while holding locks.
  - Use lower isolation where safe; use `SELECT ... FOR UPDATE` deliberately, not broadly.
  - Set `lock_timeout`/`innodb_lock_wait_timeout` so waits fail fast.
  - **Retry** with backoff on deadlock/serialization-failure errors — design transactions to be idempotent/retryable.

---

## 7. Distributed transactions (brief)

- **Two-phase commit (2PC)** — coordinator asks all participants to *prepare* (durably promise), then *commit*. Provides atomicity across nodes but **blocks** if the coordinator fails after prepare (participants hold locks), and hurts availability/latency. Avoid as a default in microservices.
- **Sagas** — sequence of local transactions with **compensating** actions for rollback; eventual consistency, no global locks. Preferred for cross-service workflows. (Covered more in distributed-systems tiers.)
- **Outbox pattern** — write the business change and an "event to publish" row in the *same* local transaction, then a relay publishes the event — gives atomicity between DB write and message emission without 2PC.

---

## 8. Common pitfalls & misconceptions

- **"Read Committed prevents lost updates."** It doesn't. Naive read-modify-write loses updates; use atomic `UPDATE`, `FOR UPDATE`, or optimistic versioning.
- **"Serializable is just stricter Repeatable Read."** In Postgres, RR = snapshot isolation allowing write skew; Serializable (SSI) is genuinely different and can abort you.
- **Assuming isolation-level names mean the same across engines.**
- **Forgetting to handle serialization failures / deadlocks** → un-retried errors surface to users.
- **Long-running/idle-in-transaction sessions** → MVCC bloat, blocked vacuum, lock pile-ups. Always commit/rollback promptly; set `idle_in_transaction_session_timeout`.
- **Doing application work (HTTP calls, user prompts) inside a transaction** → locks held forever, deadlocks.
- **`SELECT COUNT(*)` to check existence** instead of `EXISTS` / a unique constraint.
- **Relying on app-level checks for uniqueness** under concurrency instead of a DB unique constraint (the only race-free guarantee).

---

## 9. What interviewers probe

- "Explain ACID. Which letter is about concurrency?" (Isolation.)
- "Walk the isolation levels and the anomaly each prevents." Then: "What does Postgres Repeatable Read *not* prevent?" (Write skew.)
- "What is MVCC and why are long transactions dangerous?" (Snapshots pin old versions → bloat / blocked vacuum.)
- "Two users transfer money / decrement inventory concurrently — how do you avoid lost updates?" (Atomic update / `FOR UPDATE` / optimistic version.)
- "What causes a deadlock and how do you prevent it?" (Inconsistent lock ordering; order locks, keep txns short, retry.)
- "Optimistic vs pessimistic locking — when each?" (Contention level.)
- "How do you implement a job queue in SQL?" (`FOR UPDATE SKIP LOCKED`.)
- "Why might Serializable abort a transaction?" (SSI serialization failure → retry.)

---

## 10. Quick-reference summary

- **ACID**: Atomicity (all-or-nothing via WAL), Consistency (invariants), Isolation (concurrency control), Durability (fsync'd WAL).
- **Anomalies ladder**: dirty read → non-repeatable read → phantom → write skew, each prevented at a higher isolation level.
- **Levels**: Read Committed (default, per-statement snapshot), Repeatable Read / Snapshot Isolation (txn-wide snapshot, write skew possible in PG), Serializable (only level safe from write skew; PG uses SSI → may abort → retry).
- **MVCC**: multiple row versions, readers don't block writers; cost = bloat → VACUUM/purge; long transactions are toxic.
- **Locking**: `FOR UPDATE` (pessimistic), `version`-check (optimistic), `SKIP LOCKED` (queues); choose by contention.
- **Deadlocks**: inconsistent lock order; fix by ordering locks, short txns, `lock_timeout`, and **retry**.
- Always: keep transactions short, no external I/O inside them, make them retryable, enforce uniqueness in the DB.
