# Transactions & Isolation — Practice Questions

[← Topic overview](../README.md)

> Topic: ACID, isolation levels, locking, MVCC, deadlock.

Recall, teaching, and MCQ. Answer before expanding.

---

### Q1. What does each letter of ACID guarantee?

**Answer:** **Atomicity** — all writes in a transaction commit or none do (all-or-nothing, via WAL/undo). **Consistency** — the transaction preserves declared invariants (constraints/FKs), moving the DB between valid states. **Isolation** — concurrent transactions don't observe each other's intermediate state beyond what the isolation level allows. **Durability** — once committed, the change survives crashes (WAL flushed/fsync'd before ack). Isolation is the concurrency letter; Durability is the crash-survival letter.

---

### Q2. Explain the difference between non-repeatable read and phantom read to a junior.

**Answer:** Both happen when you read twice in one transaction and get different results. **Non-repeatable read:** you read *the same row* twice and its *value changed* (another transaction updated and committed it in between) — it's about a row's contents. **Phantom read:** you run *the same range query* twice (`WHERE age > 30`) and get a *different set of rows* because another transaction inserted or deleted rows matching that predicate — it's about which rows exist. Repeatable Read stops the first; you need Serializable (or range/next-key locks) to stop phantoms.

---

### Q3. What is write skew and which isolation level prevents it?

**Answer:** Write skew is when two concurrent transactions each read an overlapping data set, each writes a *different* row based on what it read, and together they break an invariant that neither breaks alone. Classic example: two on-call doctors each check "is at least one other doctor on call?", see "yes," and both go off-call — now zero coverage. Snapshot Isolation (Postgres "Repeatable Read") *allows* this because neither transaction's write conflicts with the other's write. Only **Serializable** prevents it (in Postgres via SSI, which detects the read/write dependency cycle and aborts one transaction).

---

### Q4. How does MVCC let readers avoid blocking writers?

**Answer:** Under MVCC, an update doesn't overwrite a row in place — it writes a **new version** and leaves the old one. Each transaction reads against a **snapshot** (a point-in-time view defined by which transactions had committed). Readers see the version valid as of their snapshot; concurrent writers create newer versions that readers simply don't see. So a reader never waits for a writer's lock and vice versa. The cost is dead row versions that accumulate and must be cleaned up (Postgres `VACUUM`, InnoDB purge).

---

### Q5. Why are long-running transactions dangerous in an MVCC database?

**Answer:** A transaction's snapshot pins the "oldest version still potentially needed." While it's open, the database **cannot reclaim** any row version newer than that snapshot's start — even for unrelated tables. So one long/idle transaction (a forgotten reporting query or a leaked connection in transaction state) blocks `VACUUM`/purge across the whole database, causing table and index bloat, degrading performance, and in Postgres risking transaction-ID wraparound. Mitigate with `idle_in_transaction_session_timeout`, short transactions, and monitoring the oldest open transaction.

---

### Q6. Two requests both run "read balance, subtract \$10, write balance" concurrently. What goes wrong and how do you fix it?

**Answer:** That's a **lost update**: both read \$100, both compute \$90, both write \$90 — one \$10 deduction vanishes. Read Committed does *not* prevent this. Fixes: (1) **atomic update** — `UPDATE accounts SET balance = balance - 10 WHERE id = ? AND balance >= 10` (the DB does the read-modify-write under a row lock); (2) **pessimistic lock** — `SELECT ... FOR UPDATE` then update; (3) **optimistic** — read a `version`, `UPDATE ... WHERE version = :v`, retry if 0 rows changed; (4) Serializable isolation with retry. The atomic update is usually simplest and fastest.

---

### Q7. What causes a deadlock and how do you prevent it?

**Answer:** A deadlock is a cycle: T1 holds lock A and wants B; T2 holds B and wants A; neither can proceed. It typically arises when transactions acquire the same locks in **different orders**. The DB detects the cycle and aborts a victim. Prevention: acquire locks in a **consistent order** (e.g., always update rows in ascending PK order), keep transactions **short** with no external I/O while locked, reduce lock scope, set a `lock_timeout`, and **retry** the aborted transaction with backoff (so transactions must be written to be safely retryable).

---

### Q8. How would you build a job queue with SQL so workers don't grab the same job?

**Answer:** Use row locking with `SKIP LOCKED` so each worker atomically claims the next *unlocked* job without blocking:

```sql
BEGIN;
SELECT id FROM jobs
WHERE status = 'pending'
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT 1;
-- mark it taken, do work, commit
UPDATE jobs SET status = 'running', worker_id = :w WHERE id = :id;
COMMIT;
```

`FOR UPDATE` locks the chosen row; `SKIP LOCKED` makes other workers skip already-locked rows instead of waiting, giving lock-free fan-out across many workers.

---

### Q9 (MCQ). Postgres default isolation level is:

- A. Read Uncommitted
- B. Read Committed
- C. Repeatable Read
- D. Serializable

**Answer: B. Read Committed.** Each statement sees a fresh snapshot of committed data. (Note MySQL/InnoDB defaults to Repeatable Read.)

---

### Q10 (MCQ). In Postgres, "Repeatable Read" isolation prevents all of the following EXCEPT:

- A. Dirty reads
- B. Non-repeatable reads
- C. Phantom reads
- D. Write skew

**Answer: D. Write skew.** Postgres RR is snapshot isolation: it prevents dirty/non-repeatable reads and (unlike the SQL standard minimum) phantoms, but it still permits write skew. Only Serializable (SSI) prevents write skew.

---

### Q11 (MCQ). A transaction running at Serializable in Postgres fails with a serialization error. The correct response is:

- A. Lower the isolation level permanently
- B. Catch the error and retry the transaction
- C. Add a longer lock timeout
- D. Disable SSI

**Answer: B.** SSI signals a true serialization conflict by aborting one transaction; the application is expected to **retry** it (ideally with backoff). Lowering isolation reintroduces anomalies; retry is the designed contract.

---

### Q12. Optimistic vs pessimistic locking — when do you use each?

**Answer:** **Pessimistic** (`SELECT ... FOR UPDATE`) locks the row up front, so it shines under **high contention** where conflicts are likely and you want to avoid wasted retry work — at the cost of held locks, reduced concurrency, and deadlock risk. **Optimistic** (read a version, write with `WHERE version = :v`, retry on mismatch) holds no locks during think-time and excels under **low contention** where conflicts are rare and retries are cheap — but degrades to a retry storm if contention is actually high. Choose by measured conflict rate; optimistic also fits stateless web flows where you don't want to hold a lock across a round-trip.

---

### Q13. What is two-phase commit and why is it avoided in microservices?

**Answer:** 2PC coordinates an atomic commit across multiple resources: a coordinator sends *prepare* (each participant durably promises it can commit and locks resources), and if all vote yes, sends *commit*. It gives cross-node atomicity but is a **blocking** protocol — if the coordinator crashes after prepare, participants are stuck holding locks until it recovers, hurting availability and tail latency. In microservices it couples services and creates distributed locks, so teams prefer **sagas** (local transactions + compensating actions, eventual consistency) and the **outbox pattern** for atomic write-plus-publish.
