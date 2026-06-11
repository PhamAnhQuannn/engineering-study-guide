# DB Operations — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Migrations, zero-downtime, pooling, N+1.

Each prompt names options, recommends with reasoning, and states **what would change the answer.**

---

### DQ1. Online schema change tooling: native DDL vs `gh-ost`/`pt-online-schema-change` vs expand–contract in app

**Options:** A) Run native DDL directly. B) Online-DDL tool (`gh-ost`, `pt-online-schema-change`, or PG `CONCURRENTLY`). C) Expand–contract orchestrated by application code + batched backfill.

**Recommendation:** For small tables or genuinely instant metadata changes (add nullable column), **A** is fine with a `lock_timeout`. For large tables on MySQL where the operation would otherwise lock/rewrite, **B** (shadow-table copy with triggers, cutover). For changes that also need data transformation or dual-shape compatibility across deploys, **C** — expand–contract is the overarching strategy and the tooling just executes individual steps safely.

**What would change it:** Table size and whether the op locks (large/locking → B/C), the database engine (Postgres `CONCURRENTLY` vs MySQL gh-ost), and whether the change needs backfill/transformation (→ C). Always combine with a `lock_timeout` and a rollback plan.

---

### DQ2. Connection management: app-side pool only vs external pooler (PgBouncer/RDS Proxy)

**Options:** A) App-side pool only. B) External pooler in front of the DB. C) Both (app pool + external pooler).

**Recommendation:** A single app with a modest, well-sized pool → **A** is enough. Many app instances, serverless/Lambda (connection explosion), or microservices all hitting one DB → **B/C**: an external pooler multiplexes thousands of clients onto few server connections, protecting `max_connections`. Use transaction pooling for max multiplexing **only if** you don't depend on session features.

**What would change it:** Number of app instances / serverless fan-out (high → pooler), whether you use session-level features (prepared statements/`LISTEN/NOTIFY` → session pooling or app pool), and how close you are to `max_connections`.

---

### DQ3. Fixing N+1: eager-load JOIN vs batched `IN` vs DataLoader

**Options:** A) Single JOIN (eager load). B) Two queries: parents, then children via `WHERE id IN (...)`. C) DataLoader-style per-tick batching.

**Recommendation:** When you need parent+child together and the join doesn't fan out badly, **A** (or the ORM's join-based eager load). When a JOIN would multiply rows (one-to-many causing Cartesian-ish blowup) or you want to avoid hydrating duplicated parent columns, **B** (two queries, `selectinload`-style) is often cleaner and faster. In GraphQL or any framework where data is loaded field-by-field across resolvers, **C** (DataLoader) is the idiomatic fix that coalesces loads automatically.

**What would change it:** One-to-one/many ratio and fan-out (large child sets → B over A), the framework (GraphQL → C), and whether you control the query shape or are inside a resolver.

---

### DQ4. Scaling reads: read replicas vs caching vs vertical scale-up

**Options:** A) Add read replicas. B) Add a cache (Redis) in front. C) Scale the primary up (bigger box).

**Recommendation:** If reads are diverse/ad-hoc and freshness matters but slight lag is OK → **A** (replicas), accepting read-your-writes handling for the post-write window. If a small set of hot reads dominates and can tolerate caching → **B** (cheapest throughput win, but you own invalidation). If you're not yet at the ceiling and want zero added complexity → **C** first. In practice: scale up until it's uneconomical, add a cache for hot paths, add replicas for read fan-out.

**What would change it:** Read diversity (diverse → replicas; hot-key → cache), staleness tolerance (low → primary/scale-up), write/read ratio, and operational appetite for cache invalidation and replica routing.

---

### DQ5. Big backfill strategy: one big `UPDATE` vs batched updates vs backfill via a job/CDC

**Options:** A) Single `UPDATE table SET ...`. B) Batched updates (by id range, with pauses). C) Background job / dual-write + CDC backfill.

**Recommendation:** Avoid **A** on large tables — it takes a long lock, bloats the table, and lags replicas. Default to **B**: update in bounded batches (e.g., 5–50k rows) ordered by PK, committing each batch, with brief sleeps and monitoring of replica lag. For very large or long-running backfills that must not impact prod, **C**: have the app dual-write the new field going forward and run a throttled background job to fill historical rows.

**What would change it:** Table size and lock/replica-lag sensitivity (large → B/C), how long the backfill runs, and whether new writes also need the field (→ dual-write). Tune batch size to keep each transaction short.

---

### DQ6. Migration safety: forward-only with roll-forward fix vs reversible (down) migrations

**Options:** A) Forward-only; fix problems by rolling forward. B) Every migration ships a tested reverse (down) migration. C) Expand–contract so rollback = "stop, the old schema still works."

**Recommendation:** Additive changes done via **expand–contract** (C) are inherently safe to roll back at the *code* level because the intermediate schema supports the old code — this is the strongest position. Keep a reverse migration (B) for changes where you might need to undo the schema itself, but note destructive downs (recreating dropped data) are often impossible — which is exactly why expand–contract defers destruction. Pure forward-only (A) is pragmatic for additive changes but weak if a change is harmful and can't be cheaply reversed.

**What would change it:** Whether the change is additive (→ C, easy rollback) or destructive (down migration can't restore data → rely on backups + careful contract timing), and how quickly you can roll forward a fix.

---

### DQ7. Partition an existing huge table vs shard across nodes vs archive cold data

**Options:** A) Partition within the current DB (by time). B) Shard across multiple DB nodes. C) Archive/move cold data out (to cheaper storage or a warehouse).

**Recommendation:** If the table is large but the node still has headroom, and queries are time-bounded → **A** (partitioning gives pruning + O(1) retention, low operational change). If you've hit the single-node ceiling on writes/storage → **B** (sharding), accepting cross-shard complexity. If most of the size is old, rarely-queried data → **C** first — archiving often defers both A and B cheaply.

**What would change it:** Whether the bottleneck is a single node's write/storage ceiling (→ shard) vs just table size/retention (→ partition), how much data is cold (→ archive), and query access patterns (time-bounded favors partitioning).

---

### DQ8. Where to enforce data retention/deletion: app cron `DELETE` vs partition drop vs TTL feature

**Options:** A) Scheduled `DELETE FROM ... WHERE created_at < ...`. B) Time-range partitions, drop old partition. C) Native TTL (DynamoDB TTL, Cassandra TTL, MongoDB TTL index).

**Recommendation:** For large relational tables, **B** — dropping a partition is metadata-only and instant, whereas bulk `DELETE` (A) generates massive WAL, bloat, lock pressure, and replica lag. If you're on a store with native TTL (C), use it — it's purpose-built and offloads the work to the engine's compaction. Reserve **A** for small tables or irregular, selective deletions partitioning can't express.

**What would change it:** Data volume (large → B/C; bulk DELETE is the worst option at scale), whether the store offers native TTL, and whether deletions follow the partition boundary (time-based → B) or are selective/ad-hoc (→ A).
