# Schema Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Normalization vs denormalization, modeling.

> **🛒 Where we are in building ShopFast** — Last topic we chose [SQL vs NoSQL](../../01-sql-vs-nosql/01-knowledge/README.md) — Postgres as the system of record. Now we design the actual table shapes — defining `products`, `inventory`, `orders`, and `carts` in a way that is correct, evolvable, and query-efficient. **Next:** [SQL & Query Optimization](../../03-sql-optimization/01-knowledge/README.md) — making every query on those tables fast.

---

## Teaching arc: designing ShopFast's data layer

### What it is

Schema design is the art of deciding *how to lay data out in tables* so that the things you read are fast, the things you write are safe, and the rules you care about are automatically enforced. A good analogy: think of a schema like the floor plan of a warehouse. If you put all the items in one giant pile (one wide table, everything denormalized), finding one item is fast — but whenever a supplier changes an address you have to update a thousand boxes. If you organize items by category with a card catalog pointing to locations (normalized tables with foreign keys), updates are simple and consistent — but picking an order requires visiting several aisles (joins). Schema design is choosing the right floor plan for *your* most common operations.

The senior mental shift: **model the access patterns, not just the entities**. Juniors draw an entity-relationship diagram and map it to tables. Seniors ask "what are the five hottest queries, what does the write path look like under concurrency, and what invariants must never be violated?" — then choose normalization and denormalization accordingly.

### What it looks like

ShopFast's core tables in normalized form — four entities, their relationships, and the constraints that enforce correctness:

```
products ──< inventory        (one product, one inventory row)
products ──< order_items >── orders   (many-to-many via order_items)
carts    ──< cart_items  >── products
users    ──< orders
users    ──< carts
```

The `order_items` junction table is the canonical many-to-many pattern: one order has many line items, each pointing to a product. Crucially, `unit_price_cents` is **copied into the line item at purchase time** — a deliberate denormalization that freezes the price history even if the product price changes later.

### The code that builds it

```sql
-- Core ShopFast schema (Postgres)

CREATE TABLE products (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT          NOT NULL,
  description   TEXT,
  price_cents   INT           NOT NULL CHECK (price_cents >= 0),  -- NUMERIC for money; never float
  status        TEXT          NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','archived','draft')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()              -- store UTC, always
);

CREATE TABLE inventory (
  product_id    BIGINT        PRIMARY KEY REFERENCES products(id),
  quantity      INT           NOT NULL CHECK (quantity >= 0),     -- ← constraint prevents negative stock
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id            BIGSERIAL     PRIMARY KEY,
  user_id       BIGINT        NOT NULL,                           -- FK to users (omitted for brevity)
  status        TEXT          NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','shipped','cancelled')),
  total_cents   INT           NOT NULL CHECK (total_cents >= 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id              BIGSERIAL   PRIMARY KEY,
  order_id        BIGINT      NOT NULL REFERENCES orders(id),
  product_id      BIGINT      NOT NULL REFERENCES products(id),
  quantity        INT         NOT NULL CHECK (quantity > 0),
  unit_price_cents INT        NOT NULL CHECK (unit_price_cents >= 0), -- price frozen at purchase
  UNIQUE (order_id, product_id)
);

CREATE TABLE carts (
  id          BIGSERIAL       PRIMARY KEY,
  user_id     BIGINT          NOT NULL UNIQUE,                    -- one cart per user
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  cart_id     BIGINT          NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  BIGINT          NOT NULL REFERENCES products(id),
  quantity    INT             NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (cart_id, product_id)                               -- composite PK = no duplicate items
);

-- Index every FK column (Postgres does NOT auto-index FKs)
CREATE INDEX ON order_items (order_id);
CREATE INDEX ON order_items (product_id);
CREATE INDEX ON cart_items  (product_id);
CREATE INDEX ON orders      (user_id, created_at DESC);
```

### The code that calls it

Querying the schema — order history with line items (the most common read after catalog browse):

```sql
-- Order history for a user: one query, no N+1
SELECT
  o.id           AS order_id,
  o.status,
  o.total_cents,
  o.created_at,
  oi.product_id,
  p.name         AS product_name,
  oi.unit_price_cents,              -- ← historical price, not current products.price_cents
  oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id  = o.id
JOIN products    p  ON p.id         = oi.product_id
WHERE o.user_id = :uid
ORDER BY o.created_at DESC
LIMIT 20;
```

The `INCLUDE`d covering index from sql-optimization (`(user_id, created_at DESC) INCLUDE (status, total_cents)`) means the `orders` part of this join is an index-only scan.

### Types & differences

| Pattern | What it solves | Reach for it when… |
|---|---|---|
| **3NF normalized** | One fact in one place; no update anomalies | Correctness-critical data; moderate read complexity |
| **Denormalized copy** (`unit_price_cents` in `order_items`) | Freeze a value at write time; avoid a join | Historical accuracy (prices change); read-hot path; you control the write |
| **Composite PK** (`cart_items`) | No junction-table duplicates; the PK is the uniqueness constraint | Many-to-many where the pair is the identity |
| **Surrogate BIGSERIAL** | Simple, sequential, good B-tree locality | Single-DB systems; high-volume tables where ordering matters |
| **UUID v7 / ULID** | Globally unique + time-ordered | Distributed inserts across multiple writers; exposed IDs shouldn't leak volume |
| **Partial unique index** | "Only one X per Y where condition" | Soft-delete uniqueness; "only one primary address" |
| **JSONB column** | Flexible/sparse attributes without EAV (Entity-Attribute-Value) hell | Product attributes that vary by category; schema-on-read for a known aggregate |

### Build it for real — ShopFast

ShopFast's dominant access patterns at launch:
1. **Catalog browse** — `SELECT … FROM products WHERE status='active' AND price < ?` (read-heavy, cache-backed).
2. **Cart view** — all items for one user's cart, with current product names and prices.
3. **Checkout** — decrement `inventory.quantity` + insert `orders` + insert `order_items`, all atomically (see [Transactions](../../03-transactions/01-knowledge/README.md)).
4. **Order history** — user's past orders with line items.

**Decision:** normalized to 3NF (Third Normal Form) as shown above. `unit_price_cents` in `order_items` is a deliberate, documented denormalization — it is semantically correct (a receipt must show what you paid, not the current price) and avoids a price-snapshot join. All money stored as integer cents (`INT`) — never `FLOAT`, which cannot represent 0.10 exactly. All timestamps as `TIMESTAMPTZ` (UTC). `CHECK` constraints on `quantity >= 0` and `status` enums live in the database, not just application code — the DB is the last line of defense with multiple writers.

**Rejected:** storing `cart_items` in a JSONB blob on `users` — convenient to read but makes it impossible to query "which products are in active carts" without scanning and parsing every user row. Rejected EAV for product attributes — query and indexing nightmare; JSONB column on `products` is the right escape hatch if needed.

> **If you get this wrong:** missing `CHECK (quantity >= 0)` on `inventory` means a race condition at checkout (two buyers, one item) can drive inventory negative — ShopFast oversells and ships a product it doesn't have. The DB constraint is the safety net when application logic races. Missing the FK index on `order_items(order_id)` means every order-history page load does a sequential scan of the entire `order_items` table.

### Scaling story

- **Now (launch):** one Postgres primary, PgBouncer, schema as above. Read replicas serve the catalog reads (cache-aside Redis in front for the hottest products). No sharding needed — ShopFast's launch scale (~1M users, ~60 GB total with replication factor) fits comfortably on one primary.
- **Growth signal:** `products` table grows past a few million rows; `orders` and `order_items` accumulate without archival; `pg_stat_user_tables` shows high dead-tuple ratios on `inventory` (lots of updates under checkout load).
- **At scale:** partition `orders` and `order_items` by `created_at` range — monthly or quarterly partitions give O(1) old-data archival (`DROP PARTITION`) and pruning on date-ranged queries. If write volume outgrows one primary, [SQL vs NoSQL](../../04-sql-vs-nosql/01-knowledge/README.md) covers when (and whether) to shard. Schema evolution via the expand–contract pattern is covered in [DB Operations](../../05-db-operations/01-knowledge/README.md).

---

## 1. The core principle: model the access patterns, not just the entities

Juniors model the world ("a user has orders, an order has items"). Seniors model **how the data will be read and written** at the expected scale, then choose a normal form, denormalization, and indexes to serve those queries cheaply. Schema design is an optimization problem with constraints: correctness (no anomalies), read latency, write amplification, storage, and evolvability. Get the access patterns from the product before drawing tables.

---

## 2. Normalization

Normalization decomposes tables to eliminate redundancy and **update/insertion/deletion anomalies**. Each normal form is a stricter constraint on functional dependencies.

- **1NF (First Normal Form)** — atomic column values, no repeating groups/arrays-as-columns. Each cell holds one value; each row is unique.
- **2NF (Second Normal Form)** — 1NF + every non-key column depends on the **whole** composite primary key (no partial dependency). Splits "attributes that only depend on part of the key."
- **3NF (Third Normal Form)** — 2NF + no **transitive** dependency: non-key columns depend on the key, "the whole key, and nothing but the key." E.g., storing `zip` and `city` where `zip → city` violates 3NF; `city` belongs in a `zip_codes` table.
- **BCNF (Boyce-Codd Normal Form)** — stricter 3NF: every determinant is a candidate key. Handles edge cases 3NF misses.
- **4NF/5NF** — multi-valued and join dependencies; rarely cited in interviews but worth naming.

**Why normalize:** one fact in one place → updates touch one row → no anomalies, smaller storage, referential integrity via FKs (foreign keys).

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

**The cost:** you now own consistency. Every write that changes the source of truth must update the copies (via application logic, triggers, CDC (Change Data Capture), or scheduled recompute). The interview signal is: *"Denormalize when reads dominate and you have a reliable mechanism to keep copies in sync — and you can tolerate brief staleness."*

Rule of thumb: **normalize until it hurts, denormalize until it works.** Start normalized (correctness is cheaper to keep than to recover) and denormalize specific hot read paths backed by measurement.

---

## 4. Keys

- **Primary key** — uniquely identifies a row; ideally small, immutable, never reused.
- **Natural key** — derived from real-world data (email, SSN, ISBN). Risk: can change, may be PII (Personally Identifiable Information), may not be globally unique.
- **Surrogate key** — synthetic, meaningless ID. Choices:
  - **Auto-increment / `BIGINT` sequence** — small, sequential (great for B-tree locality and clustered indexes), but leaks volume, is guessable, and is a contention point in distributed/multi-master setups.
  - **UUID (Universally Unique Identifier) v4** — globally unique, generatable client-side, non-guessable; but random → terrible index locality (page splits, cache misses) and 16 bytes.
  - **UUID v7 / ULID (Universally Unique Lexicographically Sortable Identifier) / Snowflake** — time-ordered IDs: globally unique *and* sequential, best of both. Preferred for new distributed systems.
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
- **Self-referencing / hierarchies** — adjacency list (`parent_id`), or for deep trees: **closure table**, **materialized path** (`/1/4/9/`), or **nested set**. Postgres `ltree` / recursive CTEs (Common Table Expressions) help.
- **Polymorphic associations** — a comment that can belong to a post *or* a photo. Options: nullable FKs per type (clean, FK-enforced), a single `(parent_type, parent_id)` pair (flexible, no FK integrity), or supertype/subtype tables.
- **Inheritance / type hierarchies** — single-table (one wide table + type discriminator, sparse nulls), class-table (base + per-subtype tables, joins), concrete-table (one table per concrete type).
- **EAV (Entity-Attribute-Value)** — flexible "any attribute" storage; a known anti-pattern for query performance and integrity. Prefer **JSONB columns** for sparse/dynamic attributes in modern SQL — you keep a relational core and put the flexible bits in an indexed (GIN) JSONB column.
- **Soft deletes** — `deleted_at TIMESTAMP NULL` instead of hard `DELETE`; requires every query to filter it and complicates unique constraints (use a partial unique index).
- **Temporal/history** — audit/SCD (Slowly Changing Dimension): append-only history table, or `valid_from`/`valid_to` (SCD type 2) for time-travel.

---

## 7. Data types and storage discipline

- Pick the **narrowest correct type** — `INT` vs `BIGINT`, `NUMERIC` for money (never floats), `TIMESTAMPTZ` (store UTC, not naive local time), proper enums or lookup tables over free-text status.
- Column order can matter for storage (alignment/padding in Postgres) on very wide tables.
- Beware **over-wide rows** and TOAST (The Oversized-Attribute Storage Technique)/off-page storage for large text/blobs — keep blobs in object storage, store the URL.
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
- **Patterns**: junction table for M:N (many-to-many), JSONB over EAV, closure table/materialized path for deep trees, SCD-2 for history, soft delete with partial unique indexes.
- **Types**: narrowest correct; `NUMERIC` money, `TIMESTAMPTZ` time, lookup tables over magic strings.
- Mantra: **normalize until it hurts, denormalize until it works.**
