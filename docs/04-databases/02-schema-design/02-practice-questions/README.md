# Schema Design — Practice Questions

[← Topic overview](../README.md)

> Topic: Normalization vs denormalization, modeling.

Recall, teaching, and MCQ. Answer before expanding.

---

### Q1. State 1NF, 2NF, and 3NF in one sentence each.

**Answer:**
- **1NF** — every column holds a single atomic value; no repeating groups or arrays-as-columns.
- **2NF** — 1NF and every non-key attribute depends on the *whole* composite key (no partial dependency).
- **3NF** — 2NF and no non-key attribute depends on another non-key attribute (no transitive dependency): "the key, the whole key, and nothing but the key."

---

### Q2. Explain update/insertion/deletion anomalies to a junior with one example.

**Answer:** Imagine one `orders` table that repeats the supplier's address in every row. **Update anomaly:** the supplier moves — you must update thousands of rows; miss one and the data contradicts itself. **Insertion anomaly:** you can't record a new supplier until they have at least one order (the address has nowhere to live). **Deletion anomaly:** deleting the supplier's last order erases their address entirely. Splitting `suppliers` into its own table (normalization) stores each fact once and removes all three.

---

### Q3. When is denormalization the right call?

**Answer:** When a hot read path is dominated by expensive joins/aggregations, the workload is read-heavy, you have a reliable way to keep the duplicated data in sync (triggers, application transaction, CDC, scheduled rollup), and you can tolerate the staleness window that sync implies. Classic examples: storing `order.total`, copying `product_name`/`unit_price` into `order_items` (also captures historical value), and maintaining rollup tables for dashboards. You're trading write complexity and storage for read latency — only worthwhile when reads actually dominate and you've measured it.

---

### Q4. Surrogate vs natural primary key — tradeoffs?

**Answer:** A **natural key** (email, ISBN) carries meaning and avoids an extra column, but it can change (breaking FKs everywhere), may be PII, and may not be reliably unique/stable. A **surrogate key** (synthetic ID) is small, immutable, meaningless, and decoupled from business changes — the safer default for PKs — at the cost of an extra column and an extra lookup to find rows by their natural identity (so you often still add a `UNIQUE` constraint on the natural key). Most senior designs use a surrogate PK plus a unique natural-key constraint.

---

### Q5. Why can random UUID v4 primary keys hurt at scale, and what's the fix?

**Answer:** Random UUIDs have no temporal ordering, so inserts land at random positions in the primary B-tree/clustered index. That causes page splits, poor cache locality, write amplification, and index bloat as the table grows — INSERT throughput degrades. They're also 16 bytes (vs 8 for `BIGINT`), inflating every secondary index that carries the PK. Fix: use **time-ordered IDs** — UUID v7, ULID, or Snowflake — which keep global uniqueness and client-side generation while inserting near the "end" of the index, restoring locality.

---

### Q6. How do you model a many-to-many relationship? Give the SQL.

**Answer:** With a junction (associative) table holding a FK to each side, often with its own attributes:

```sql
CREATE TABLE enrollment (
  student_id BIGINT NOT NULL REFERENCES students(id),
  course_id  BIGINT NOT NULL REFERENCES courses(id),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade CHAR(1),
  PRIMARY KEY (student_id, course_id)
);
CREATE INDEX ON enrollment (course_id);  -- index the second FK for reverse lookups
```

The composite PK enforces "one enrollment per student/course"; index the reverse direction so "students in a course" is also fast.

---

### Q7. How would you store flexible, sparse, per-record custom attributes? Compare EAV vs JSONB.

**Answer:** **EAV** (entity-attribute-value: a row per attribute) is maximally flexible but a query and integrity nightmare — every logical read becomes a pivot of many rows, no type safety, no easy constraints, poor performance. **JSONB** (a semi-structured column) keeps a relational core (typed, constrained columns for the stable fields) and puts the dynamic bits in one indexable (GIN) JSONB column, supporting containment/path queries. For modern Postgres/MySQL, prefer JSONB for sparse/dynamic attributes; reserve full relational columns for anything you filter, join, or constrain on frequently.

---

### Q8 (MCQ). A table `(order_id, product_id, product_name, product_category)` where `product_id → product_name, product_category`. Which normal form does it violate, and how do you fix it?

- A. 1NF — make values atomic
- B. 2NF — partial dependency on part of the composite key
- C. 3NF — transitive dependency; move product attributes to a `products` table
- D. It's already in BCNF

**Answer: C (and arguably 2NF).** `product_name`/`product_category` depend on `product_id`, not on the full row identity / order — a partial+transitive dependency. The fix is to keep only `product_id` as the FK in the order-items table and store name/category once in `products`. (Note: if you *intentionally* copy `product_name` to capture the value at purchase time, that's a deliberate denormalization, not an accidental violation.)

---

### Q9 (MCQ). You need "at most one primary email per user." Best enforcement?

- A. Application-level check before insert
- B. `CHECK (is_primary IN (true,false))`
- C. Partial unique index: `UNIQUE (user_id) WHERE is_primary`
- D. A trigger that counts rows

**Answer: C.** A partial unique index `CREATE UNIQUE INDEX ON emails (user_id) WHERE is_primary` enforces the invariant atomically at the storage layer, immune to race conditions. The app check (A) races under concurrency; CHECK (B) only validates the column domain; a counting trigger (D) is heavier and still racy without proper locking.

---

### Q10. How do you model a tree/hierarchy (e.g., org chart, nested comments)? Compare two approaches.

**Answer:**
- **Adjacency list** (`parent_id`): trivial to write and update; reading an arbitrary-depth subtree needs a recursive CTE (`WITH RECURSIVE`), which is fine in modern SQL.
- **Closure table** (a row for every ancestor-descendant pair): fast subtree/ancestor queries at any depth with a simple join, at the cost of write amplification and storage on inserts/moves.
- **Materialized path** (`'/1/4/9/'`): subtree query is a cheap `LIKE 'prefix%'`; moves require rewriting paths of all descendants.

Pick adjacency list + recursive CTE for moderate depth and write-heavy trees; closure table or materialized path when reads are deep/frequent and the tree is relatively stable.

---

### Q11. What's wrong with `status VARCHAR` holding free text, and what are the options?

**Answer:** Free-text status invites typos/inconsistent casing ('Paid', 'paid', 'PAID'), no integrity, and accidental new values. Options, by rigidity: a `CHECK (status IN (...))` constraint (simple, but altering the allowed set needs a migration); a native `ENUM` type (compact, but altering is awkward in Postgres/MySQL); or a **lookup table** with a FK (most flexible — add/rename values as data, joinable for labels/metadata, fully integrity-enforced). For a stable small set, CHECK; for an evolving set with metadata, a lookup table.

---

### Q12 (MCQ). For storing monetary amounts, the correct type is:

- A. `FLOAT` / `DOUBLE`
- B. `NUMERIC`/`DECIMAL` with fixed scale
- C. `INT` cents only
- D. `VARCHAR`

**Answer: B (or C).** `NUMERIC(12,2)` (or integer minor units like cents) avoids binary floating-point rounding errors that silently corrupt sums and comparisons. Floats (A) are wrong for money; storing as text (D) loses arithmetic and ordering. Integer-cents (C) is also valid and common in code that does heavy arithmetic, with formatting at the edges.
