# Schema Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Normalization vs denormalization, modeling.

Senior study notes on designing relational (and document) schemas: normalization theory, when to deliberately break it, modeling patterns, keys, constraints, and the access-pattern-first mindset that separates a junior schema from a senior one.

---

## 1. The core principle: model the access patterns, not just the entities

Juniors model the world ("a user has orders, an order has items"). Seniors model **how the data will be read and written** at the expected scale, then choose a normal form, denormalization, and indexes to serve those queries cheaply. Schema design is an optimization problem with constraints: correctness (no anomalies), read latency, write amplification, storage, and evolvability. Get the access patterns from the product before drawing tables.

---

## 2. Normalization

Normalization decomposes tables to eliminate redundancy and **update/insertion/deletion anomalies**. Each normal form is a stricter constraint on functional dependencies.

- **1NF** — atomic column values, no repeating groups/arrays-as-columns. Each cell holds one value; each row is unique.
- **2NF** — 1NF + every non-key column depends on the **whole** composite primary key (no partial dependency). Splits "attributes that only depend on part of the key."
- **3NF** — 2NF + no **transitive** dependency: non-key columns depend on the key, "the whole key, and nothing but the key." E.g., storing `zip` and `city` where `zip → city` violates 3NF; `city` belongs in a `zip_codes` table.
- **BCNF** — stricter 3NF: every determinant is a candidate key. Handles edge cases 3NF misses.
- **4NF/5NF** — multi-valued and join dependencies; rarely cited in interviews but worth naming.

**Why normalize:** one fact in one place → updates touch one row → no anomalies, smaller storage, referential integrity via FKs.

**Anomalies normalization prevents:**
- *Update anomaly* — a duplicated fact (e.g., supplier address copied into every product row) must be changed in many places; miss one and data is inconsistent.
- *Insertion anomaly* — can't record a fact because unrelated required data is missing.
- *Deletion anomaly* — deleting a row accidentally loses an unrelated fact.

---

## 3. Denormalization (and why seniors do it on purpose)

Normalization optimizes writes and integrity; it can make reads expensive because answering a query needs many joins. **Denormalization** trades redundancy and write complexity for read speed:

- **Precomputed/derived columns** — store `order.total` instead of summing items each read.
- **Duplicated reference data** — copy `product_name` into `order_items` so the line item is a stable historical record (and a join is avoided). Bonus: it captures the *value at time of purchase*, which is semantically correct.
- **Aggregate/rollup tables** — `daily_sales_by_category` maintained by a job or trigger.
- **Wide read models / materialized views** — flatten a star of joins into one table for a dashboard.

**The cost:** you now own consistency. Every write that changes the source of truth must update the copies (via application logic, triggers, CDC, or scheduled recompute). The interview signal is: *"Denormalize when reads dominate and you have a reliable mechanism to keep copies in sync — and you can tolerate brief staleness."*

Rule of thumb: **normalize until it hurts, denormalize until it works.** Start normalized (correctness is cheaper to keep than to recover) and denormalize specific hot read paths backed by measurement.

---

## 4. Keys

- **Primary key** — uniquely identifies a row; ideally small, immutable, never reused.
- **Natural key** — derived from real-world data (email, SSN, ISBN). Risk: can change, may be PII, may not be globally unique.
- **Surrogate key** — synthetic, meaningless ID. Choices:
  - **Auto-increment / `BIGINT` sequence** — small, sequential (great for B-tree locality and clustered indexes), but leaks volume, is guessable, and is a contention point in distributed/multi-master setups.
  - **UUID v4** — globally unique, generatable client-side, non-guessable; but random → terrible index locality (page splits, cache misses) and 16 bytes.
  - **UUID v7 / ULID / Snowflake** — time-ordered IDs: globally unique *and* sequential, best of both. Preferred for new distributed systems.
- **Composite key** — multiple columns; natural for join/junction tables.
- **Foreign key** — enforces referential integrity; index the FK column (databases don't always auto-index FKs — Postgres doesn't, MySQL/InnoDB does) or joins/deletes scan.

---

## 5. Constraints and integrity

Push invariants into the database where possible — the DB is the last line of defense and many writers may exist:

- `NOT NULL`, `UNIQUE`, `CHECK` (e.g., `amount >= 0`, valid enum), `FOREIGN KEY` with `ON DELETE` behavior (`RESTRICT`/`CASCADE`/`SET NULL`).
- **Exclusion constraints** (Postgres) — e.g., no overlapping booking ranges via `EXCLUDE USING gist`.
- **Unique partial index** — "only one `is_primary = true` address per user."
- Prefer enforcing at the DB over the app when correctness is critical; app-only checks race under concurrency.

---

## 6. Modeling patterns

- **One-to-many** — FK on the "many" side.
- **Many-to-many** — junction/join table with two FKs (and possibly its own attributes, e.g., `enrollment(student_id, course_id, grade)`).
- **One-to-one** — same PK shared, or a unique FK; often used to split rarely-used wide columns.
- **Self-referencing / hierarchies** — adjacency list (`parent_id`), or for deep trees: **closure table**, **materialized path** (`/1/4/9/`), or **nested set**. Postgres `ltree` / recursive CTEs help.
- **Polymorphic associations** — a comment that can belong to a post *or* a photo. Options: nullable FKs per type (clean, FK-enforced), a single `(parent_type, parent_id)` pair (flexible, no FK integrity), or supertype/subtype tables.
- **Inheritance / type hierarchies** — single-table (one wide table + type discriminator, sparse nulls), class-table (base + per-subtype tables, joins), concrete-table (one table per concrete type).
- **EAV (entity-attribute-value)** — flexible "any attribute" storage; a known anti-pattern for query performance and integrity. Prefer **JSONB columns** for sparse/dynamic attributes in modern SQL — you keep a relational core and put the flexible bits in an indexed (GIN) JSONB column.
- **Soft deletes** — `deleted_at TIMESTAMP NULL` instead of hard `DELETE`; requires every query to filter it and complicates unique constraints (use a partial unique index).
- **Temporal/history** — audit/SCD: append-only history table, or `valid_from`/`valid_to` (SCD type 2) for time-travel.

---

## 7. Data types and storage discipline

- Pick the **narrowest correct type** — `INT` vs `BIGINT`, `NUMERIC` for money (never floats), `TIMESTAMPTZ` (store UTC, not naive local time), proper enums or lookup tables over free-text status.
- Column order can matter for storage (alignment/padding in Postgres) on very wide tables.
- Beware **over-wide rows** and TOAST/off-page storage for large text/blobs — keep blobs in object storage, store the URL.
- `VARCHAR(n)` length limits are usually documentation, not performance; in Postgres `text` is fine.

---

## 8. Common pitfalls / misconceptions

- **"Always 3NF" / "always denormalize for speed"** — both are dogma. The answer is access-pattern-driven.
- **Random UUID PKs by default** — silently wrecks write throughput and index size on big tables; use time-ordered IDs.
- **No FK indexes** → slow joins and `ON DELETE CASCADE` table scans.
- **Storing money as float**, dates as strings, booleans as `'Y'/'N'` text.
- **Enum-in-CHECK vs lookup table** — CHECK is rigid (migration to add a value); a lookup table is flexible and joinable. Native ENUM types are awkward to alter.
- **Wide nullable tables** modeling optional sub-types — consider splitting.
- **EAV everywhere** — query nightmare; reach for JSONB instead.
- **Ignoring multi-tenancy early** — retrofitting `tenant_id` into every PK/index is painful; decide shared-schema vs schema-per-tenant vs DB-per-tenant up front.

---

## 9. What interviewers probe

- "Design the schema for X (e-commerce, booking, social feed, chat)." → entities, relationships, keys, the 2–3 hot queries, then where you'd denormalize and why.
- "Walk me from 1NF to 3NF on this table." → name the dependency you're removing at each step.
- "When would you denormalize?" → read-heavy hot path + sync mechanism + staleness tolerance; give a concrete example (order line items capturing price-at-purchase).
- "Surrogate vs natural key?" / "UUID vs auto-increment?" → integrity, mutability, index locality, distribution.
- "How do you model a hierarchy / many-to-many / polymorphic relation?"
- "How do you evolve this schema without downtime?" → ties to DB Operations (expand–contract).
- "Where do you enforce invariants — app or DB?" → DB for correctness-critical, both for UX.

---

## 10. Quick-reference summary

- **Model access patterns first**, then choose normal form + denormalization.
- **Normalize for correctness** (3NF/BCNF eliminates update/insert/delete anomalies); **denormalize for read-heavy hot paths** with a sync mechanism and staleness tolerance.
- **Keys**: surrogate (time-ordered ID like UUIDv7/ULID/Snowflake) for scale; index every FK.
- **Push invariants into the DB**: `NOT NULL`, `UNIQUE`, `CHECK`, `FK`, partial/exclusion constraints.
- **Patterns**: junction table for M:N, JSONB over EAV, closure table/materialized path for deep trees, SCD-2 for history, soft delete with partial unique indexes.
- **Types**: narrowest correct; `NUMERIC` money, `TIMESTAMPTZ` time, lookup tables over magic strings.
- Mantra: **normalize until it hurts, denormalize until it works.**
