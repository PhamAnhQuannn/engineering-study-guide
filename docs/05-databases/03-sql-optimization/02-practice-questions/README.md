# SQL & Query Optimization — Practice Questions

[← Topic overview](../README.md)

> Topic: Joins, window functions, indexes, EXPLAIN plans.

A mix of recall, "explain to a junior," and multiple-choice. Try to answer before expanding the reasoning.

---

### Q1. What does "sargable" mean and why does it matter?

**Answer:** SARGable ("Search ARGument able") means a predicate can be satisfied using an index seek/range scan rather than a full scan. A predicate stops being sargable when you apply a function or computation to the **indexed column** — e.g. `WHERE DATE(created_at) = '2026-06-07'` or `WHERE lower(email) = ?` (without a functional index) — forcing the engine to compute the expression for every row. The fix is to move the transformation to the constant side (`created_at >= '2026-06-07' AND created_at < '2026-06-08'`) or build a matching expression index. It matters because non-sargable predicates silently turn O(log n) index lookups into O(n) scans, and the index "exists but isn't used."

---

### Q2. Explain the leftmost-prefix rule to a junior.

**Answer:** Think of a composite index `(a, b, c)` like a phone book sorted by last name, then first name, then middle name. You can find everyone with last name "Pham" instantly, and "Pham, Quan" instantly — because the book is sorted that way. But you **cannot** efficiently find everyone whose *first* name is "Quan" regardless of last name; you'd scan the whole book. So the index helps queries that filter on `a`, or `a+b`, or `a+b+c` (a leading prefix), but not `b` alone or `c` alone. Practical consequence: order composite-index columns by how your queries filter — usually equality columns first, the range/sort column last.

---

### Q3. When does the optimizer choose a hash join over a nested loop?

**Answer:** A **nested loop** wins when the outer input is small and the inner side has an index to probe (each outer row → cheap indexed lookup). A **hash join** wins when both inputs are large and unsorted and the join is an equality: it builds an in-memory hash table on the smaller side once, then streams the larger side through it — O(n+m) instead of O(n·m). If the build side doesn't fit in `work_mem`, it spills to disk (batched/grace hash join), which is much slower. **Merge join** is preferred when both inputs are already sorted (e.g., both sides indexed on the join key), giving a cheap linear merge.

---

### Q4. Why is `LIMIT 20 OFFSET 1000000` slow, and what's the fix?

**Answer:** `OFFSET` doesn't skip rows cheaply — the engine must generate and discard the first 1,000,000 rows (including any sort) before returning 20. Cost grows linearly with the offset, so deep pages get progressively slower. The fix is **keyset (seek) pagination**: remember the sort key of the last row seen and use it as a `WHERE` bound:

```sql
SELECT * FROM orders
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

With an index on `(created_at, id)` this jumps straight to the page in O(log n + 20), independent of depth. Tradeoff: you lose random "jump to page 500" access and it needs a stable, unique sort key.

---

### Q5. You added an index but `EXPLAIN` still shows a Seq Scan. Give three reasons.

**Answer:**
1. **Low selectivity** — the predicate matches a large fraction of rows; a sequential scan is genuinely cheaper than many random index lookups + heap fetches.
2. **Non-sargable predicate** — a function/cast on the column, or an implicit type/collation mismatch in the comparison.
3. **Stale statistics** — the planner underestimates the table size or misjudges selectivity; run `ANALYZE`. (Also: the table is tiny, so a scan is trivially cheap; or the index column order doesn't match the query.)

---

### Q6. Difference between `RANK()`, `DENSE_RANK()`, and `ROW_NUMBER()`?

**Answer:** All assign a number over an ordered partition. On **ties**: `ROW_NUMBER` gives distinct sequential numbers arbitrarily breaking ties (1,2,3,4); `RANK` gives the same rank to ties and then **skips** (1,1,3,4); `DENSE_RANK` gives the same rank to ties with **no gap** (1,1,2,3). Use `ROW_NUMBER()=1` to pick one representative row per group (dedup / latest-per-key); use `RANK`/`DENSE_RANK` for leaderboard semantics.

---

### Q7. Explain `EXPLAIN` vs `EXPLAIN ANALYZE`. What's the danger of the latter?

**Answer:** `EXPLAIN` shows the planner's **estimated** plan and costs without running the query. `EXPLAIN ANALYZE` **actually executes** the query and reports real timings and actual row counts, letting you compare estimated vs actual rows (the key diagnostic). The danger: it really runs the statement — so `EXPLAIN ANALYZE DELETE/UPDATE/INSERT` mutates data. Wrap it in a transaction and `ROLLBACK`, or only run it on read queries.

---

### Q8. Why prefer `EXISTS` over `IN`, and what's the `NOT IN` trap?

**Answer:** `EXISTS` short-circuits on the first match and pairs naturally with a semi-join; `IN` with a subquery is logically similar and optimizers often plan them identically, but `IN` materializes the list and can behave worse with large/duplicated subqueries. The real trap is **`NOT IN` with NULLs**: if the subquery returns *any* NULL, `NOT IN` evaluates to UNKNOWN for every row and the query returns **zero rows** (three-valued logic). `NOT EXISTS` is NULL-safe. Default to `EXISTS`/`NOT EXISTS`.

---

### Q9 (MCQ). A query filters `WHERE tenant_id = ? AND status = 'active' AND created_at > ?` and sorts `ORDER BY created_at DESC`. The best single index is:

- A. `(created_at, tenant_id, status)`
- B. `(tenant_id, status, created_at)`
- C. `(status, created_at)`
- D. `(created_at)`

**Answer: B.** Equality columns (`tenant_id`, `status`) come first so the index narrows to the matching slice, then `created_at` last serves both the range filter **and** the `ORDER BY` (the index is already sorted, so no separate sort step). A puts the range/sort column first, breaking the leftmost-prefix for the equality filters.

---

### Q10 (MCQ). In an `EXPLAIN ANALYZE` plan, the most important signal that the optimizer made a bad decision is:

- A. The query used a hash join
- B. A large gap between *estimated rows* and *actual rows*
- C. The presence of a Sort operator
- D. The total cost number is high

**Answer: B.** Est-vs-actual divergence means cardinality estimation failed (usually stale/missing stats or correlated columns), which cascades into wrong join algorithms and orders. Hash joins and sorts are often optimal; the absolute cost number is meaningful only relative to alternatives.

---

### Q11 (MCQ). Which index lets `SELECT user_id, total FROM orders WHERE user_id = ?` run as an index-only scan?

- A. `(user_id)`
- B. `(total)`
- C. `(user_id) INCLUDE (total)` / `(user_id, total)`
- D. A hash index on `user_id`

**Answer: C.** The index must **cover** every column the query touches (key `user_id` + payload `total`) so the engine never visits the table heap. A alone forces a heap fetch for `total`; a hash index can't be index-only and serves equality only.

---

### Q12. Explain why `COUNT(*)` on a 500M-row table can be slow, and an alternative.

**Answer:** In MVCC engines (Postgres, MySQL/InnoDB) there's no single stored row count — visibility depends on the transaction, so an exact `COUNT(*)` must scan every visible row (or an index). On huge tables that's expensive. Alternatives: an **approximate count** from catalog stats (`pg_class.reltuples`, refreshed by `ANALYZE`), a maintained counter table updated by triggers/CDC, or `SELECT COUNT(*)` over a covering index (cheaper than heap). Ask whether the product actually needs an exact, real-time count — usually "approximately 4.2M" is fine.

---

### Q13. A junior asks: "Should I just add an index on every column in the WHERE clause?" How do you respond?

**Answer:** No. Indexes cost write throughput (every DML maintains them), storage, and buffer-pool memory, and the optimizer can typically use only one (or via bitmap-and, a few) per table per query. Instead: identify the *actual* slow queries (from `pg_stat_statements` / slow log), design a small number of **composite, covering** indexes that match their predicate + sort + selected columns, and verify with `EXPLAIN ANALYZE`. One well-ordered composite index often replaces several single-column ones. Then periodically drop indexes with zero scans.

---

### Q14 (MCQ). `WHERE status = 'A' OR priority = 'high'` on a large table is slow. Best fix?

- A. Add a composite index on `(status, priority)`
- B. Rewrite as `UNION ALL` of two sargable single-column-indexed queries (deduped)
- C. Add `OPTION (FORCE INDEX)`
- D. Increase `work_mem`

**Answer: B.** An `OR` across two *different* columns usually can't be served by one composite index (leftmost-prefix), forcing a scan or an expensive bitmap-or. Splitting into `SELECT ... WHERE status='A'` `UNION` `SELECT ... WHERE priority='high'` lets each branch use its own index; use `UNION` (or `UNION ALL` + explicit dedup) to avoid double-counting rows matching both.

---

### Q15. Explain a covering index and an index-only scan in one breath.

**Answer:** A covering index includes every column a query references (filter keys plus selected/returned columns, via the key tuple or an `INCLUDE` payload), so the database answers the query entirely from the index B-tree without ever fetching rows from the table heap — that heap-free execution is an **index-only scan**, the cheapest possible read path. (Caveat in Postgres: it still needs the visibility map to be set, so heavily-updated tables may require `VACUUM` for the index-only scan to actually avoid heap visits.)
