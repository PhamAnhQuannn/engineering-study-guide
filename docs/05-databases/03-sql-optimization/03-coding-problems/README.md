# SQL & Query Optimization — Coding Problems

[← Topic overview](../README.md)

> Topic: Joins, window functions, indexes, EXPLAIN plans.

Each problem: statement + constraints → approach → complexity → worked solution. Solutions target Postgres-flavored SQL (notes where dialects differ). Assume tables are large unless stated.

Schema used throughout:

```sql
users(id PK, name, country, created_at)
orders(id PK, user_id FK, status, amount NUMERIC, created_at)
order_items(id PK, order_id FK, product_id, qty INT, unit_price NUMERIC)
products(id PK, category, name, price)
```

---

## Problem 1 — Top-N per group (latest 3 orders per user)

**Statement:** Return each user's 3 most recent orders. Constraints: `orders` has 200M rows, `user_id` indexed.

**Approach:** Naive self-join (`o2.created_at >= o.created_at`) is O(n²) per group. Use a **window function** `ROW_NUMBER()` partitioned by user, ordered by recency, then filter to rank ≤ 3. An index on `(user_id, created_at DESC)` lets the engine read each partition pre-sorted, avoiding a sort.

**Complexity:** O(n) scan + per-partition ordered read via index → effectively O(n) with no global sort; memory O(partition width).

```sql
SELECT user_id, id, amount, created_at
FROM (
  SELECT o.*,
         ROW_NUMBER() OVER (PARTITION BY user_id
                            ORDER BY created_at DESC, id DESC) AS rn
  FROM orders o
) ranked
WHERE rn <= 3;
-- Supporting index: CREATE INDEX ON orders (user_id, created_at DESC, id DESC);
-- Postgres-specific faster alternative for few-rows-per-group: LATERAL
SELECT u.id, o.*
FROM users u
CROSS JOIN LATERAL (
  SELECT id, amount, created_at FROM orders
  WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 3
) o;
```

The `LATERAL` form is dramatically faster when users ≪ orders, because it does a tiny indexed top-3 lookup per user instead of ranking all 200M rows.

---

## Problem 2 — Running total (cumulative revenue per user over time)

**Statement:** For each order, compute the user's cumulative spend up to and including that order.

**Approach:** Window aggregate with an explicit frame. Default frame quirk: `RANGE` groups ties by ordering value; use `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` for a true per-row running sum.

**Complexity:** O(n) after a per-partition sort, O(n log n) if no supporting index.

```sql
SELECT
  user_id, id, created_at, amount,
  SUM(amount) OVER (
    PARTITION BY user_id
    ORDER BY created_at, id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_total
FROM orders;
```

---

## Problem 3 — De-duplicate keeping the latest row

**Statement:** `orders` has accidental duplicate rows per `(user_id, external_ref)`. Keep the most recent, delete the rest. Constraint: must be safe to re-run.

**Approach:** Rank duplicates with `ROW_NUMBER()` and delete rows where rank > 1. Use a CTE; deleting via a window requires referencing the PK.

**Complexity:** O(n) scan + sort within duplicate groups.

```sql
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, external_ref
                            ORDER BY created_at DESC, id DESC) AS rn
  FROM orders
)
DELETE FROM orders o
USING ranked r
WHERE o.id = r.id AND r.rn > 1;
-- Then prevent recurrence:
-- CREATE UNIQUE INDEX ON orders (user_id, external_ref);
```

---

## Problem 4 — Diagnose and fix a slow date-range report

**Statement:** This query takes 12s; `created_at` is indexed. Make it fast.

```sql
SELECT count(*) FROM orders
WHERE EXTRACT(YEAR FROM created_at) = 2026 AND status = 'paid';
```

**Approach:** The `EXTRACT(...)` wraps the indexed column → **non-sargable** → full scan. Rewrite as a half-open range so the B-tree index applies, and add a composite/partial index for the common `status` filter.

**Complexity:** Scan O(n) → index range O(log n + matching).

```sql
-- Sargable rewrite
SELECT count(*) FROM orders
WHERE created_at >= DATE '2026-01-01'
  AND created_at <  DATE '2027-01-01'
  AND status = 'paid';

-- Partial covering index for the hot path
CREATE INDEX idx_orders_paid_created
  ON orders (created_at)
  WHERE status = 'paid';
```

Verify with `EXPLAIN (ANALYZE, BUFFERS)` that the plan switched from `Seq Scan` to an `Index Only Scan` and actual rows ≈ estimated.

---

## Problem 5 — Gaps and islands (consecutive active days streak)

**Statement:** Given `logins(user_id, login_date)` (one row per active day), find each user's longest streak of consecutive days.

**Approach:** Classic gaps-and-islands. Subtract a `ROW_NUMBER()` (sequence) from the date; consecutive dates share the same `date - row_number` anchor, forming an "island." Group by the anchor and take the max count.

**Complexity:** O(n log n) for the ordered window, then O(n) aggregation.

```sql
WITH islands AS (
  SELECT
    user_id,
    login_date,
    login_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date))::int
      AS grp
  FROM logins
)
SELECT user_id, MAX(streak) AS longest_streak
FROM (
  SELECT user_id, grp, COUNT(*) AS streak
  FROM islands
  GROUP BY user_id, grp
) s
GROUP BY user_id;
```

---

## Problem 6 — Avoiding N+1 with a single aggregated join

**Statement:** For a dashboard, return each user with their order count and lifetime value. The app currently fires one query per user (N+1). Replace with one query.

**Approach:** Left-join the pre-aggregated orders so users with zero orders still appear. Aggregate in a subquery (or lateral) to avoid row multiplication before counting.

**Complexity:** O(n) hash aggregate on orders + O(m) hash join to users.

```sql
SELECT u.id, u.name,
       COALESCE(o.cnt, 0)   AS order_count,
       COALESCE(o.ltv, 0)   AS lifetime_value
FROM users u
LEFT JOIN (
  SELECT user_id, COUNT(*) AS cnt, SUM(amount) AS ltv
  FROM orders
  WHERE status = 'paid'
  GROUP BY user_id
) o ON o.user_id = u.id
ORDER BY lifetime_value DESC;
```

Pitfall avoided: joining `orders` *then* aggregating with `order_items` in the same query would multiply rows (fan-out) and inflate `SUM`/`COUNT` — aggregate each branch separately or use `COUNT(DISTINCT)`.

---

## Problem 7 — Keyset pagination over a composite sort

**Statement:** Implement an efficient "next page" of 50 orders sorted by `created_at DESC, id DESC`, given the last row of the previous page.

**Approach:** Row-value comparison against the last-seen key, backed by a matching descending index. O(log n + 50) regardless of page depth.

```sql
-- index: CREATE INDEX ON orders (created_at DESC, id DESC);
SELECT id, user_id, amount, created_at
FROM orders
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

For MySQL (no row-value index seek as cleanly), expand explicitly:

```sql
WHERE created_at < :last_created_at
   OR (created_at = :last_created_at AND id < :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

---

## Problem 8 — Period-over-period change with LAG

**Statement:** Given monthly revenue per category, compute month-over-month % change.

**Approach:** Pre-aggregate to one row per `(category, month)`, then `LAG` the previous month's value within each category partition.

**Complexity:** O(n log n) for the ordered window over the aggregated set.

```sql
WITH monthly AS (
  SELECT p.category,
         date_trunc('month', o.created_at) AS mon,
         SUM(oi.qty * oi.unit_price)        AS revenue
  FROM order_items oi
  JOIN orders   o ON o.id = oi.order_id AND o.status = 'paid'
  JOIN products p ON p.id = oi.product_id
  GROUP BY p.category, date_trunc('month', o.created_at)
)
SELECT category, mon, revenue,
       LAG(revenue) OVER (PARTITION BY category ORDER BY mon) AS prev_revenue,
       ROUND(
         100.0 * (revenue - LAG(revenue) OVER (PARTITION BY category ORDER BY mon))
         / NULLIF(LAG(revenue) OVER (PARTITION BY category ORDER BY mon), 0)
       , 1) AS pct_change
FROM monthly
ORDER BY category, mon;
```

`NULLIF(prev, 0)` guards against divide-by-zero for the first month / zero baselines.
