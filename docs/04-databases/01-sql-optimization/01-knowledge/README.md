# SQL & Query Optimization — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Joins, window functions, indexes, EXPLAIN plans.

Senior-level study notes on writing correct, fast SQL and reasoning about *why* a query is slow. The thesis: at scale you don't optimize SQL by "rewriting cleverly" — you optimize by understanding the **physical access path** the planner chooses and changing the inputs (indexes, statistics, predicates, data layout) so it chooses a better one.

---

## 1. The relational engine mental model

A SQL query goes through a pipeline:

1. **Parse** — syntax → AST.
2. **Bind / resolve** — validate tables, columns, types.
3. **Rewrite** — view expansion, subquery flattening, constant folding, predicate pushdown.
4. **Optimize** — the **cost-based optimizer (CBO)** enumerates candidate *plans* (join orders, join algorithms, access methods) and picks the cheapest using **statistics** (row counts, histograms, NDV = number of distinct values).
5. **Execute** — runs the chosen physical plan as a tree of operators that pull rows (Volcano/iterator model) or process in vectorized batches.

Key insight: SQL is **declarative**. You describe *what*; the optimizer decides *how*. Most "slow query" problems are the optimizer making a bad *how* decision because of stale stats, non-sargable predicates, or missing indexes.

---

## 2. Indexes — the single biggest lever

### B-tree (the default)
- Balanced tree, O(log n) lookups, keeps keys **sorted**. Supports equality (`=`), range (`<`, `>`, `BETWEEN`), prefix `LIKE 'abc%'`, and **ordered retrieval** (serves `ORDER BY`/`GROUP BY` without a sort).
- **Leftmost-prefix rule**: a composite index `(a, b, c)` can serve predicates on `a`, `a,b`, `a,b,c` — but **not** `b` alone or `c` alone. Column order is a design decision, not cosmetic.
- Rule of thumb for column order: **equality columns first, then the range/sort column last**. `WHERE tenant_id = ? AND created_at > ?` wants `(tenant_id, created_at)`.

### Covering index
An index that contains **every column the query needs** (key + `INCLUDE`d payload). The engine answers from the index alone — an **index-only scan**, no heap/table fetch. This is the cheapest fast path. Postgres `INCLUDE`, MySQL secondary indexes implicitly cover by carrying the PK.

### Other index types
- **Hash** — O(1) equality only, no ranges/ordering. Niche.
- **GIN / inverted** — multi-value: arrays, JSONB, full-text. One row → many keys.
- **GiST / SP-GiST** — geometric, range, nearest-neighbor.
- **BRIN** — block-range min/max summaries; tiny, great for huge append-only tables with natural physical ordering (time-series).
- **Partial index** — `WHERE status='active'`; indexes only the hot subset, smaller and faster.
- **Expression / functional index** — `lower(email)`; required to make `WHERE lower(email)=?` sargable.

### Costs of indexes
Every index is a write-amplifier: each `INSERT`/`UPDATE`/`DELETE` must maintain it. They consume storage and buffer-pool memory. Over-indexing slows writes and bloats the cache. Audit and drop unused indexes (`pg_stat_user_indexes.idx_scan = 0`).

---

## 3. Sargability (the #1 silent killer)

**SARGable** = "Search ARGument able" = the predicate can use an index. A function or computation **on the indexed column** destroys sargability:

```sql
-- NON-sargable: function on the column → full scan
WHERE DATE(created_at) = '2026-06-07'
WHERE email LIKE '%@gmail.com'        -- leading wildcard
WHERE amount + fee > 100
WHERE CAST(user_id AS text) = '42'    -- implicit/explicit cast hides the index

-- Sargable rewrites
WHERE created_at >= '2026-06-07' AND created_at < '2026-06-08'
WHERE email LIKE 'quan%'              -- prefix, uses B-tree
WHERE amount > 100 - fee
-- or build a functional index: CREATE INDEX ON t (lower(email));
```

Implicit type coercion (string column compared to int, or mismatched collations across a join) is a classic production cause of "index exists but isn't used."

---

## 4. Joins — algorithms and order

Three physical join algorithms; the optimizer picks based on cardinality and available indexes:

| Algorithm | How it works | Best when | Cost |
|---|---|---|---|
| **Nested loop** | For each outer row, probe inner (ideally via index) | Small outer side, indexed inner | O(outer × log inner) with index; O(n·m) without |
| **Hash join** | Build hash table on smaller side, probe with larger | Large unsorted inputs, equality joins | O(n+m), needs memory for build side |
| **Merge join** | Sort both sides, merge | Both inputs already sorted (or indexed), range joins | O(n log n + m log m), cheap if pre-sorted |

**Join order matters**: the optimizer reorders joins to keep intermediate result sets small (filter early, join the most-selective tables first). It uses statistics to estimate this; bad stats → bad order → exploding intermediates. With many tables the search space is huge, so optimizers use heuristics (and MySQL/Postgres cap exhaustive search — Postgres' `join_collapse_limit`, GEQO for large joins).

**Join type semantics** (correctness, not perf): `INNER` (matches only), `LEFT/RIGHT OUTER` (keep unmatched from one side, NULL-fill), `FULL OUTER`, `CROSS` (Cartesian), `SEMI` (`EXISTS` / `IN` — returns outer rows that have a match, no duplication), `ANTI` (`NOT EXISTS` — outer rows with no match). Prefer `EXISTS`/`NOT EXISTS` over `IN`/`NOT IN` with subqueries — `NOT IN` has a notorious NULL trap (any NULL in the subquery makes the whole thing return no rows).

---

## 5. Window functions

Compute across a "window" of related rows **without collapsing** them (unlike `GROUP BY`).

```sql
SELECT
  user_id,
  order_id,
  amount,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at)        AS seq,
  RANK()       OVER (PARTITION BY user_id ORDER BY amount DESC)       AS amt_rank,
  SUM(amount)  OVER (PARTITION BY user_id ORDER BY created_at
                     ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
  LAG(amount)  OVER (PARTITION BY user_id ORDER BY created_at)        AS prev_amount
FROM orders;
```

- `ROW_NUMBER` (always unique), `RANK` (gaps on ties), `DENSE_RANK` (no gaps), `NTILE(n)` (buckets).
- `LAG`/`LEAD` for prev/next row; `FIRST_VALUE`/`LAST_VALUE`/`NTH_VALUE`.
- **Frame clause** (`ROWS`/`RANGE BETWEEN ...`) defines the moving window for aggregates. Default frame is `RANGE UNBOUNDED PRECEDING ... CURRENT ROW`, which surprises people on `LAST_VALUE` (gives current row, not partition end) — use `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.
- Canonical use: "top-N per group", running totals, deduplication (`ROW_NUMBER()=1`), period-over-period deltas — all without a self-join.
- Performance: each distinct `PARTITION BY ... ORDER BY` may require a sort. An index matching the partition+order can eliminate it.

---

## 6. Reading EXPLAIN plans

`EXPLAIN` = estimated plan. `EXPLAIN ANALYZE` = actually runs it and shows **real** timings/rows (use `BUFFERS` in Postgres for I/O). Read the tree **inside-out / bottom-up** — leaves execute first.

What to look for:
- **Seq Scan / Full Table Scan** on a large table with a selective filter → missing or unused index.
- **Estimated vs actual rows mismatch** (e.g., estimates 10, gets 2M) → stale statistics → `ANALYZE` the table. This is the root cause behind most bad plans.
- **Join algorithm**: nested loop over millions of rows → the optimizer mis-estimated cardinality.
- **Sort / Hash spilling to disk** (`external merge Disk: ...kB`) → `work_mem`/`sort_buffer` too small for this query.
- **Rows Removed by Filter** high → index isn't selective enough or predicate isn't sargable.
- **Loops** count in nested loops — multiply per-loop cost by loop count.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 42 AND created_at > now() - interval '7 days';
```

---

## 7. Statistics, cardinality, and the planner

The optimizer is only as good as its estimates. **Cardinality estimation** (how many rows a predicate/join produces) drives every choice. Histograms (value distribution) and NDV feed it. Pitfalls:
- **Stale stats** after a bulk load → re-run `ANALYZE`/`ANALYZE TABLE`.
- **Correlated columns** (`city` and `zip`): the planner assumes independence and underestimates → Postgres `CREATE STATISTICS` (extended stats) fixes this.
- **Skew**: one value dominates; the average estimate is wrong. Histograms help; sometimes split the query.
- **Parameter sniffing** (SQL Server) / generic vs custom plans (Postgres prepared statements): a plan cached for one parameter value is bad for another with very different selectivity.

---

## 8. Common anti-patterns and pitfalls

- **`SELECT *`** — defeats covering indexes, ships unneeded columns, breaks on schema change. Select what you need.
- **N+1 queries** — ORM lazy-loading firing one query per parent row. Fix with a join or batched `IN`/`DataLoader`. (Covered in DB Operations.)
- **`OFFSET` pagination** — `LIMIT 20 OFFSET 1000000` scans and discards a million rows. Use **keyset/seek pagination**: `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 20`.
- **`OR` across different columns** — often can't use one index; rewrite as `UNION ALL` of two sargable branches.
- **Functions/casts on indexed columns** (sargability, §3).
- **Over-fetching then filtering in app code** instead of pushing predicates to the DB.
- **`COUNT(*)` on huge tables** — exact counts are expensive in MVCC engines (must scan visible rows); use approximate counts (`pg_class.reltuples`) when "good enough."
- **Implicit transactions / per-row round trips** — batch writes; one statement beats 10,000.
- **Trusting `LIMIT` to be cheap** — `ORDER BY non_indexed LIMIT 10` still sorts the whole set first.

---

## 9. What interviewers probe

- "This query is slow — walk me through how you'd diagnose it." → `EXPLAIN ANALYZE` first, identify the expensive operator, check est-vs-actual rows, check for seq scans / sorts spilling, then form a hypothesis (index? stats? rewrite?). Never guess-and-add-indexes.
- "Given `WHERE a=? AND b>? ORDER BY c`, what index?" → `(a, b)` or `(a, c)` depending on selectivity vs sort cost — explain the tradeoff (the range column `b` and the sort column `c` compete for the last slot).
- "Why might an index you created not be used?" → not selective enough (optimizer prefers a scan), non-sargable predicate, stale stats, type/collation mismatch, small table.
- "`IN` vs `EXISTS` vs `JOIN`?" → semantic equivalence, the `NOT IN` NULL trap, optimizer often rewrites them to the same plan but not always.
- "How do you paginate 10M rows efficiently?" → keyset pagination.
- "Explain a covering index / index-only scan."
- Live SQL: top-N-per-group, running total, sessionization, gaps-and-islands — all window-function territory.

---

## 10. Quick-reference summary

- **Diagnose, don't guess**: `EXPLAIN ANALYZE (BUFFERS)`, read bottom-up, hunt est-vs-actual row gaps.
- **Indexes**: B-tree default; composite obeys leftmost-prefix; equality-then-range column order; covering index → index-only scan; partial/expression indexes for hot subsets and functions.
- **Sargability**: never wrap an indexed column in a function/cast; rewrite date ranges as half-open intervals.
- **Joins**: nested-loop (small+indexed), hash (big+equality), merge (pre-sorted); order matters; `EXISTS`>`IN`, beware `NOT IN`+NULL.
- **Windows**: per-group analytics without collapsing rows; mind the default frame.
- **Stats**: keep them fresh (`ANALYZE`); extended stats for correlated columns.
- **Pagination**: keyset over `OFFSET`.
- **Writes**: every index taxes writes — index deliberately, drop the unused.
