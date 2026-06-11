# Transactions & Isolation — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: ACID, isolation levels, locking, MVCC, deadlock.

> **🛒 Where we are in building ShopFast** — Last topic we optimized [SQL & Query Optimization](../../03-sql-optimization/01-knowledge/README.md) — fast queries with indexes and sargable predicates. The schema enforces individual-row constraints, but checkout requires multiple rows across multiple tables to change *together* or not at all — and two users can try to buy the last unit simultaneously. This topic gives us ACID (Atomicity, Consistency, Isolation, Durability) transactions and isolation levels to make checkout correct under concurrency. **Next:** [DB Operations](../../05-db-operations/01-knowledge/README.md) — migrations, connection pooling, and N+1 in production.

---

## Teaching arc: making ShopFast checkout safe

### What it is

A **transaction** is a group of database operations that are treated as a single unit — all succeed together, or all fail together. The canonical analogy: a bank transfer. Subtracting $100 from account A and adding $100 to account B must happen as one unit. If the system crashes between those two steps, you cannot have one happen without the other. Transactions are the mechanism that makes this possible.

ACID is the four-property guarantee that makes transactions useful:
- **Atomicity** — all or nothing. Checkout either deducts inventory AND creates the order, or does neither.
- **Consistency** — the database moves from one valid state to another, respecting all declared constraints (no negative inventory, valid order status).
- **Isolation** — two concurrent checkouts don't corrupt each other's view of the same inventory row.
- **Durability** — once ShopFast confirms "your order is placed," it survives a server crash.

The hardest letter is **I**. The rest of this note is mostly about it.

### What it looks like

Two users trying to buy the last unit of a product at the same instant is the classic concurrency race. Without proper isolation, both reads see `quantity = 1`, both decrement it, and the result is `quantity = -1` — ShopFast has oversold:

```
Time →        User A                    User B
T1            READ quantity = 1
T2                                      READ quantity = 1
T3            quantity - 1 = 0          quantity - 1 = 0
T4            UPDATE quantity = 0
T5                                      UPDATE quantity = 0   ← oversold!
T6            INSERT order (success)    INSERT order (success) ← double-charge!
```

With `SELECT … FOR UPDATE` (pessimistic locking) or an atomic `UPDATE … WHERE quantity > 0` (optimistic), only one transaction wins.

### The code that builds it

The ShopFast checkout transaction — all-or-nothing, with inventory protection:

```sql
BEGIN;

-- Step 1: Lock the inventory row so concurrent checkouts queue up, not race
SELECT quantity FROM inventory
WHERE product_id = :pid
FOR UPDATE;                             -- ← acquires exclusive row lock; other buyers wait here

-- Step 2: Fail fast if out of stock (check AFTER lock, not before)
-- Application checks the returned quantity > 0, else ROLLBACK

-- Step 3: Decrement inventory atomically
UPDATE inventory
SET quantity    = quantity - :qty,      -- ← atomic decrement; CHECK(quantity >= 0) is the backstop
    updated_at  = now()
WHERE product_id = :pid
  AND quantity >= :qty;                 -- ← second safety net: only update if enough stock

-- If 0 rows updated → out of stock → ROLLBACK

-- Step 4: Create the order record
INSERT INTO orders (user_id, status, total_cents, created_at)
VALUES (:uid, 'pending', :total, now())
RETURNING id INTO :order_id;

-- Step 5: Create line items (price frozen at purchase time)
INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
VALUES (:order_id, :pid, :qty, :current_price);

COMMIT;
-- All five steps committed together, or none of them (on any error → ROLLBACK)
```

### The code that calls it

Application-side checkout — including the retry loop that ACID requires when serialization failures occur:

```typescript
async function checkout(userId: number, productId: number, qty: number): Promise<Order> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await db.transaction(async (tx) => {  // BEGIN … COMMIT/ROLLBACK
        const inv = await tx.queryOne(
          'SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE', [productId]
        );
        if (!inv || inv.quantity < qty) throw new OutOfStockError();

        await tx.query(
          'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND quantity >= $1',
          [qty, productId]
        );
        const order = await tx.queryOne(
          'INSERT INTO orders(user_id,status,total_cents) VALUES($1,$2,$3) RETURNING id',
          [userId, 'pending', qty * inv.price]
        );
        await tx.query(
          'INSERT INTO order_items(order_id,product_id,quantity,unit_price_cents) VALUES($1,$2,$3,$4)',
          [order.id, productId, qty, inv.price]
        );
        return order;
      });
    } catch (err) {
      if (isSerializationFailure(err) && attempt < MAX_RETRIES - 1) continue;  // ← retry on conflict
      throw err;
    }
  }
}
```

### Types & differences

| Isolation level | Dirty read | Non-repeatable read | Phantom | Write skew | ShopFast relevance |
|---|---|---|---|---|---|
| **Read Uncommitted** | possible | possible | possible | possible | Never use — Postgres ignores it |
| **Read Committed** (default) | no | possible | possible | possible | OK for catalog reads; **not safe for checkout** |
| **Repeatable Read** (Snapshot Isolation in Postgres) | no | no | no* | possible | Better; still allows write skew on disjoint rows |
| **Serializable** (SSI in Postgres) | no | no | no | no | Correct for checkout; may abort → must retry |

*Postgres Repeatable Read (RR) is actually Snapshot Isolation (SI) and prevents phantoms — but **still allows write skew**. Always name the engine.

| Locking style | Mechanism | Reach for it when… |
|---|---|---|
| **Pessimistic** (`FOR UPDATE`) | Lock the row before modifying | High contention (e.g., hot inventory item — many buyers) |
| **Optimistic** (`version` column) | Read version, update only if unchanged | Low contention; avoid holding locks across think-time |
| **`SKIP LOCKED`** | Skip rows already locked | Job queues — grab next unprocessed task without blocking |

### Build it for real — ShopFast

ShopFast's checkout is explicitly called out in the canonical facts: **"checkout/order = strong consistency (no double-charge, no oversell)"**. This means:

1. The inventory decrement + order creation must be atomic — use a single transaction wrapping both.
2. Concurrent buyers for the same last unit must serialize — use `SELECT … FOR UPDATE` on `inventory`.
3. The `CHECK (quantity >= 0)` DB constraint is the backstop if application logic has a bug.

**Decision:** `READ COMMITTED` for catalog/cart reads (the default; fine for reads that don't require cross-row consistency). **Serializable or pessimistic `FOR UPDATE`** for checkout. ShopFast uses `FOR UPDATE` on the `inventory` row — simpler to reason about than SSI (Serializable Snapshot Isolation), and the retry logic is explicit. The idempotency key on `POST /v1/orders` (established in [API Design](../../../03-system-design/03-api-design/01-knowledge/README.md)) prevents a network retry from double-inserting if the client retries after the first request commits.

**Rejected:** application-level check without a DB lock — `SELECT quantity`, check in code, then `UPDATE` — is a classic time-of-check / time-of-use (TOCTOU) race under `READ COMMITTED`. Two concurrent requests both see `quantity=1`, both pass the check, both decrement. The `FOR UPDATE` serializes the check and the decrement into one locked window.

> **If you get this wrong:** two users simultaneously buy the last item in stock. Without `FOR UPDATE` (or an atomic update with a `WHERE quantity >= :qty` guard), both checkouts succeed, `inventory.quantity` goes to -1, ShopFast ships a product it doesn't have and has to issue refunds. This is the oversell bug — the most consequential correctness failure in e-commerce. The `CHECK (quantity >= 0)` constraint is the last-resort backstop: it will cause a transaction abort rather than allow negative stock, but it should never be the *only* defense.

### Scaling story

- **Now (launch):** one Postgres primary, PgBouncer pooling. Serializable checkout via `FOR UPDATE`. Lock contention is low because different buyers mostly buy different products — lock scope is per-row on `inventory`.
- **Growth signal:** a flash sale drives 500 concurrent buyers at the same SKU (stock-keeping unit). `pg_locks` shows a queue of waiters on that `inventory` row. Checkout p99 latency spikes as buyers queue for the lock.
- **At scale:** for flash-sale hot SKUs, move inventory counting to Redis atomic decrements (`DECR` is serialized by Redis's single-threaded command loop) with a reconciliation job syncing to Postgres. For the broader system, [SQL vs NoSQL](../../04-sql-vs-nosql/01-knowledge/README.md) covers when Postgres's write bottleneck warrants a different store. Cross-service transactions (when `catalog`, `order`, and `payment` split into separate services) move to the **Saga pattern** with compensating transactions — covered in [Distributed Systems: Failure Handling](../../../05-distributed-systems/01-failure-handling/01-knowledge/README.md).

---

## 1. ACID — what each letter guarantees

- **Atomicity** — all-or-nothing. A transaction's writes either all commit or none do. Implemented via a WAL (Write-Ahead Log / redo log) and undo: on crash or `ROLLBACK`, partial effects are reversed. Atomicity is about *failure handling*, not concurrency.
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
- **Serializable isn't free**: Postgres implements it as **SSI (Serializable Snapshot Isolation)**, which can abort transactions with a serialization failure — the app must **retry**. SQL Server/MySQL implement it with heavier locking (lower concurrency, deadlock risk).

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
- **Predicate / SIREAD (Serializable Read) locks** (Postgres SSI) — track read/write dependencies to detect serialization conflicts without blocking.
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

- **2PC (Two-Phase Commit)** — coordinator asks all participants to *prepare* (durably promise), then *commit*. Provides atomicity across nodes but **blocks** if the coordinator fails after prepare (participants hold locks), and hurts availability/latency. Avoid as a default in microservices.
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
