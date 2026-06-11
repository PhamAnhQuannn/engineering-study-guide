# Transactions & Isolation — Real-World Situations

[← Topic overview](../README.md)

> Topic: ACID, isolation levels, locking, MVCC, deadlock.

On-the-job scenarios. Each follows: **Model/approach → Mitigate → Diagnose with data → Communicate → Root-cause fix → Prevention.** These are how a senior reasons under incident pressure, not just textbook answers.

---

## S1. Inventory oversell: more orders confirmed than stock

**Scenario:** A flash sale sold 1,200 units of an item that only had 1,000 in stock. Customers got "confirmed" then "sorry, out of stock" emails.

**Mitigate:** Pause the flash sale / disable that SKU's checkout to stop the bleed. Reconcile: identify the 200 over-orders and proactively refund/notify.

**Diagnose with data:** Inspect the decrement code. Almost certainly a **read-modify-write race**: `SELECT qty` → app checks `qty > 0` → `UPDATE qty = qty - 1`. Under concurrency at Read Committed, many transactions read the same `qty` and all pass the check (lost update). Confirm by checking logs/timestamps showing concurrent decrements crossing zero.

**Communicate:** Tell support the cap was breached due to a concurrency bug, give the list of affected orders and the refund plan, and an ETA for the fix. Post-incident note to eng on the race.

**Root-cause fix:** Replace read-then-write with an **atomic conditional update** that can't oversell:
```sql
UPDATE inventory SET qty = qty - :n
WHERE product_id = :p AND qty >= :n;     -- 0 rows affected => reject the order
```
The DB applies the decrement under a row lock and the `qty >= :n` guard makes oversell impossible. Add a `CHECK (qty >= 0)` as a backstop.

**Prevention:** Code review rule: no read-modify-write on counters without atomic update or `FOR UPDATE`. Load-test the checkout path with concurrency. Add a monitor/alert for negative or capped inventory.

---

## S2. Deadlocks spiking under load

**Scenario:** During peak traffic, the app log fills with "deadlock detected" errors and some user actions fail intermittently.

**Mitigate:** Ensure the app **catches deadlock errors and retries** with small backoff (transient by nature) so users see success. Shed load if necessary.

**Diagnose with data:** Read the DB deadlock log (Postgres `log_lock_waits`, `pg_stat_activity`; InnoDB `SHOW ENGINE INNODB STATUS`). It names the two transactions and the locks/rows involved. The signature is two code paths updating the **same rows in opposite orders** (e.g., a transfer updating accounts A→B while another does B→A).

**Communicate:** Report that deadlocks are a concurrency-ordering issue, not data corruption; failed actions are being retried; root-cause fix incoming. Share the conflicting transactions found.

**Root-cause fix:** Impose a **consistent lock acquisition order** — e.g., always lock the lower account id first:
```sql
-- lock both rows in a deterministic order before mutating
SELECT * FROM accounts WHERE id IN (:a, :b) ORDER BY id FOR UPDATE;
```
Also shorten transactions (no external calls while holding locks) and narrow lock scope.

**Prevention:** Document the lock-ordering convention; add retry-with-backoff as standard for write transactions; set `lock_timeout` to fail fast; load-test contended paths.

---

## S3. Reports occasionally show inconsistent (mid-transaction) totals

**Scenario:** A financial summary screen sometimes shows debits and credits that don't balance, then is correct on refresh.

**Mitigate:** Add a banner/caveat if needed; the data isn't corrupt, just read mid-flight.

**Diagnose with data:** The report runs several `SELECT`s in separate statements at Read Committed, so a transfer transaction committing *between* the debit read and the credit read makes them inconsistent (it read before one leg and after the other). Reproduce by interleaving a transfer with the report.

**Communicate:** Explain it's a read-isolation artifact (the snapshot moved between queries), not lost money; fix is to read a consistent snapshot.

**Root-cause fix:** Run the report's reads in a single transaction at **Repeatable Read** (snapshot isolation) so all its statements see one consistent point-in-time, or combine into one query. For ledgers, never compute balance across multiple un-snapshotted statements.

**Prevention:** Standard: multi-statement reports that must be internally consistent run in a `REPEATABLE READ` transaction. Add a test that interleaves a write with the report.

---

## S4. Database bloating and slowing down over weeks

**Scenario:** Postgres write latency creeps up, table/index sizes balloon far beyond live row counts, autovacuum seems to "never finish."

**Mitigate:** Identify and kill the offending long/idle transaction to unblock vacuum; manually `VACUUM` the worst tables off-peak.

**Diagnose with data:** Query `pg_stat_activity` for `idle in transaction` sessions and the **oldest `xact_start`**; check `pg_stat_user_tables` for high `n_dead_tup`. A single long-running or leaked-in-transaction connection pins the oldest snapshot, so dead tuples can't be reclaimed DB-wide → bloat.

**Communicate:** Report that an open transaction (often a reporting query or a connection-pool leak) is blocking cleanup, causing the slowdown; fixing the source resolves it.

**Root-cause fix:** Eliminate the long/idle transaction: close reporting transactions promptly, fix the pool/ORM that left a connection in transaction state, and run heavy analytics on a replica. Reclaim space (`VACUUM`, or `VACUUM FULL`/`pg_repack` off-peak for severe bloat).

**Prevention:** Set `idle_in_transaction_session_timeout` and `statement_timeout`; alert on oldest open transaction age and dead-tuple ratio; tune autovacuum; route analytics to replicas.

---

## S5. Double-charged customers after a payment retry

**Scenario:** Some customers were charged twice. The pattern correlates with a payment-service timeout where the client retried.

**Mitigate:** Identify duplicate charges, refund them, and notify affected customers. Temporarily make the charge endpoint refuse obvious duplicates.

**Diagnose with data:** The charge flow isn't **idempotent**: on timeout the client retried, the first request had actually succeeded, and the retry created a second charge. Confirm by correlating two payment rows with the same logical order and near-identical timestamps.

**Communicate:** Tell finance/support the cause (non-idempotent retry), provide the affected list and refund status, and the fix timeline.

**Root-cause fix:** Make the operation idempotent: require an **idempotency key** (client-supplied or derived from the order) with a `UNIQUE` constraint; on retry, the second insert hits the constraint and you return the original result instead of charging again. Write the charge record and any outbound event in the **same transaction** (or via the outbox) so a partial failure can't double-emit.

**Prevention:** Idempotency keys on all mutating, retryable endpoints; unique constraint enforced in the DB; chaos-test the timeout-then-retry path.

---

## S6. Serializable transactions failing under contention after an upgrade

**Scenario:** A team set a hot workflow to `SERIALIZABLE` for safety; after traffic grew, users see intermittent failures and elevated error rates.

**Mitigate:** Ensure the app retries serialization failures (`40001`) with backoff so most succeed transparently; this immediately reduces user-visible errors.

**Diagnose with data:** Postgres SSI aborts transactions when it detects a read/write dependency cycle. Under high contention on overlapping rows, abort rate climbs. Inspect logs for `could not serialize access` and identify the conflicting transactions/rows.

**Communicate:** Explain Serializable trades some aborts for the strongest guarantee; failures are retried, but if abort rate is too high we should localize protection.

**Root-cause fix:** If retries make it acceptable, keep Serializable. If aborts are too costly, drop the workflow to Read/Repeatable Read and protect only the genuinely conflicting rows with `SELECT ... FOR UPDATE` or atomic updates — getting correctness on the specific invariant without serializing everything. Reduce the transaction's read/write footprint to shrink the conflict surface.

**Prevention:** Default to the lowest isolation that's correct, with targeted locking; reserve Serializable for invariants (write skew) you can't express otherwise; always implement retry-on-serialization-failure as a standard wrapper; load-test isolation choices under realistic contention.
