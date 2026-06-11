# Schema Design — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Normalization vs denormalization, modeling.

Each prompt names concrete options, gives a reasoned recommendation, and states **what would change the answer.** The senior signal is naming the deciding variable, not picking a "best."

---

### DQ1. Normalized (3NF) vs denormalized read model for an analytics dashboard

**Options:** A) Query the normalized OLTP tables with joins/aggregates live. B) Maintain a denormalized rollup/materialized view. C) Stream to a separate columnar warehouse.

**Recommendation:** For a few users and small data, (A) — no extra moving parts. As the dashboard becomes hot or the joins span large tables, (B) — a rollup table refreshed by a job or incrementally maintained, accepting bounded staleness. At true analytics scale or when OLTP and OLAP workloads contend, (C) — separate the read store entirely.

**What would change it:** Query latency SLO, freshness requirement (real-time vs minutes-stale OK), data volume, and whether analytics queries are degrading transactional performance. Tight freshness + low volume favors live joins; large volume + tolerance for staleness favors rollups/warehouse.

---

### DQ2. Surrogate auto-increment `BIGINT` vs UUIDv7/ULID vs UUIDv4 for primary keys

**Options:** A) Auto-increment `BIGINT`. B) Time-ordered UUIDv7/ULID/Snowflake. C) Random UUIDv4.

**Recommendation:** Single-primary OLTP with no need for client-side ID generation → A (smallest, best locality, simplest). Distributed/multi-region writes, client- or service-generated IDs, or merge of data across systems → B (global uniqueness + index locality). Avoid C unless non-guessability is the only thing that matters and tables stay small.

**What would change it:** Whether IDs must be generated outside the DB or across shards (rules out plain auto-increment), whether sequential IDs leaking volume/order is a security concern (rules out auto-increment, favors random or time-ordered with a separate public slug), and table size (random UUID locality pain only bites at scale).

---

### DQ3. Enforce a business rule in the application vs in the database

**Options:** A) App-layer validation only. B) DB constraint only (`CHECK`/`UNIQUE`/`FK`/exclusion). C) Both.

**Recommendation:** For correctness-critical invariants (uniqueness, no-overlap, referential integrity, non-negative balance), the DB must enforce it (B or C) — it's the only layer that holds under concurrency and multiple writers. Add app-layer checks (C) for fast user feedback and clearer error messages. App-only (A) is acceptable only for soft UX rules the DB can't express or where a single writer is guaranteed.

**What would change it:** Number of writers/services touching the table (more writers → DB enforcement mandatory), how catastrophic a violation is, and whether the rule is expressible declaratively (complex cross-table/temporal rules may need triggers or app transactions).

---

### DQ4. Single wide table vs class-table inheritance for a type hierarchy

**Options:** A) Single-table (one table, type discriminator, nullable subtype columns). B) Class-table (base table + one table per subtype, joined). C) Concrete-table (one full table per concrete type).

**Recommendation:** Few subtypes with mostly shared columns and read-by-supertype queries → A (no joins, simple, accept some sparse nulls). Many divergent subtype attributes and strong integrity needs → B (each subtype's columns are `NOT NULL`-enforceable, no sparse nulls). C only when subtypes are queried independently and almost never together.

**What would change it:** How much subtypes diverge (more divergence → B/C), whether queries usually hit the supertype (favors A) or one concrete type (favors C), and tolerance for nullable/sparse columns and join cost.

---

### DQ5. Hard delete vs soft delete (`deleted_at`)

**Options:** A) Hard `DELETE`. B) Soft delete with `deleted_at`/`is_deleted`. C) Move to an archive table.

**Recommendation:** Default to hard delete for simplicity unless you have a concrete need to recover, audit, or reference deleted rows. Use soft delete (B) when undo, audit trails, or referential history matter — but pay the tax: every query must filter `deleted_at IS NULL`, unique constraints need to become partial (`UNIQUE (...) WHERE deleted_at IS NULL`), and the table accumulates dead rows. Use archive tables (C) when deleted data is large and rarely needed, keeping the hot table lean.

**What would change it:** Regulatory/recovery requirements (push toward B/C), data volume of deletions (large → C to keep hot table small), and how many queries you're willing to burden with the soft-delete filter.

---

### DQ6. Multi-tenancy: shared-schema (`tenant_id`) vs schema-per-tenant vs DB-per-tenant

**Options:** A) Shared schema + `tenant_id`. B) Schema per tenant. C) Database per tenant.

**Recommendation:** Many small/medium tenants, cost-sensitive, frequent schema changes → A (best pooling, single migration, simplest ops) with `tenant_id` leading every index and RLS as a safety net. Strong isolation/compliance or per-tenant customization → B. Enterprise/regulated tenants needing dedicated resources, independent backup/restore, and noisy-neighbor isolation → C. Most mature SaaS end up **hybrid**: pooled shared schema for the long tail, dedicated DBs for whales.

**What would change it:** Number of tenants (thousands → A; per-schema/DB ops don't scale), isolation/compliance requirements, tenant size skew (whales → C), and per-tenant customization needs.

---

### DQ7. Store flexible attributes as JSONB column vs EAV vs explicit columns

**Options:** A) Explicit typed columns. B) JSONB column. C) EAV (attribute-value rows).

**Recommendation:** For attributes you filter/join/constrain on regularly → A (typed, indexable, integrity-enforced). For sparse, evolving, per-record attributes you rarely query structurally → B (JSONB with a GIN index, keeping a relational core). Avoid C (EAV) in relational stores — it destroys query performance and integrity; JSONB supersedes it for nearly every case.

**What would change it:** How often the flexible attributes are queried/filtered (frequent → promote to columns), how dynamic the attribute set is (very dynamic → JSONB), and whether you need per-attribute constraints/types (favors explicit columns).

---

### DQ8. Index a foreign key column or not

**Options:** A) Always index FK columns. B) Index only FKs used in joins/lookups. C) Rely on the engine's defaults.

**Recommendation:** Index FK columns that you join on, filter by, or that back `ON DELETE CASCADE` (an unindexed FK makes parent deletes scan the child table). In Postgres, FK indexes are **not** created automatically, so (B leaning toward A) is the conscious default; in MySQL/InnoDB they are auto-created. Don't blindly index every FK on write-heavy tables you never query by that direction — each index taxes writes.

**What would change it:** Whether you query/delete in that direction, the engine (Postgres needs explicit indexes), write throughput sensitivity, and child-table size (large child + cascading deletes → definitely index).
