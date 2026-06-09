# SQL vs NoSQL — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Data model fit, consistency, scaling tradeoffs.

Each prompt names options, recommends with reasoning, and states **what would change the answer.** The senior move is to derive from access patterns and consistency needs, never from "NoSQL scales better."

---

### DQ1. Relational vs document store for the primary datastore of a new product

**Options:** A) Relational (Postgres). B) Document (MongoDB). C) Postgres with JSONB columns (hybrid).

**Recommendation:** Default to **A** for most products: you rarely know all queries up front, joins and ACID are valuable, and Postgres is operationally mature. If the data is genuinely a set of self-contained aggregates with heterogeneous shapes and few cross-entity queries, **B** fits. Often **C** is the sweet spot — relational core for the structured, queried, constrained data plus JSONB for the flexible bits — avoiding a second datastore entirely.

**What would change it:** How relational the data and queries are (more joins/ad-hoc → A), how flexible/variable the schema must be (very → B or C), team familiarity, and whether you can avoid a second operational system (favors C).

---

### DQ2. Reaching for NoSQL "for scale" — Cassandra vs NewSQL (CockroachDB/Spanner) vs sharded Postgres

**Options:** A) Wide-column (Cassandra). B) Distributed SQL / NewSQL. C) Sharded relational (Vitess/Citus).

**Recommendation:** If you need horizontal **write** scale and your queries are simple, known, and partition-aligned (no cross-partition joins/transactions), **A**. If you need horizontal scale **but still want SQL, joins, and ACID transactions**, **B** — this is usually what people actually want when they say "NoSQL for scale." If you're already on Postgres and want to defer a rewrite, **C** extends it but cross-shard joins/transactions get hard.

**What would change it:** Whether you need joins/transactions at scale (→ B/C, not A), whether query patterns are fixed and partition-aligned (→ A), existing investment in Postgres (→ C), and geo-distribution needs (→ B like Spanner).

---

### DQ3. Strong vs eventual consistency for a given feature

**Options:** A) Strong consistency (CP / ACID). B) Eventual consistency (AP / BASE). C) Tunable per-operation (quorum).

**Recommendation:** Money, inventory, auth, anything where a stale read causes incorrect decisions → **A**. High-volume, read-heavy, human-tolerant data where slight staleness is invisible (feeds, view counts, presence, recommendations) → **B** for availability/latency. When different operations within one store have different needs → **C** (e.g., Cassandra `QUORUM` for the read-your-writes path, `ONE` for analytics reads).

**What would change it:** The cost of a stale/lost read (financial/safety → A), availability and latency SLOs (tight → B/C), and whether the workload mixes critical and tolerant operations (→ C).

---

### DQ4. Add a dedicated search engine (Elasticsearch) vs use the database's built-in full-text

**Options:** A) Postgres full-text search (`tsvector`/GIN). B) Elasticsearch/OpenSearch. C) A managed search service (Algolia).

**Recommendation:** Modest corpus, simple relevance, and a desire to avoid another system → **A**: no sync problem, transactionally consistent, surprisingly capable. Large corpus, complex relevance/faceting/aggregations, typo tolerance, and high query volume → **B**, fed via CDC from the system of record. Small team wanting turnkey instant-search with minimal ops → **C**.

**What would change it:** Corpus size and query complexity (large/complex → B/C), tolerance for the catalog↔index sync lag and operational cost, and team capacity to run a search cluster (none → A or C).

---

### DQ5. Cache + relational DB vs a key-value store as primary

**Options:** A) Relational primary + Redis cache. B) Key-value store as the primary datastore. C) Relational only (no cache).

**Recommendation:** For lookup-heavy workloads where the data is still relational and you want one source of truth, **A** — cache the hot reads, keep Postgres authoritative; just own invalidation. If the access pattern is *purely* key lookup at extreme throughput and the data model has no relational needs, **B** (DynamoDB) is legitimate as the primary. Start with **C** and add a cache only when reads measurably hurt — caching adds invalidation and consistency complexity.

**What would change it:** How relational the data/queries are (relational → A/C), read volume vs primary capacity (high → add cache), and whether you can tolerate cache-invalidation complexity. Don't add Redis prematurely.

---

### DQ6. Polyglot persistence vs single store

**Options:** A) Single store for everything. B) Polyglot (best-fit store per concern). C) Single store now, split later.

**Recommendation:** Start with **A** (or **C**) — usually Postgres — because every additional store adds operational surface and a **sync/consistency problem** between stores. Split into **B** only when a specific access pattern is measurably ill-served by the single store (e.g., full-text search, a high-write event feed, sub-millisecond key lookups). When you do split, use CDC/outbox for sync, never naive dual writes.

**What would change it:** Concrete, measured access patterns the single store can't serve well (→ split), team's ops capacity (more stores = more burden), and how critical cross-store consistency is (harder → resist splitting).

---

### DQ7. Keeping two datastores in sync: dual writes vs CDC/outbox vs periodic batch

**Options:** A) Application dual-writes to both stores. B) Change Data Capture / transactional outbox. C) Periodic batch ETL.

**Recommendation:** Avoid **A** — the classic **dual-write problem**: a crash between the two writes leaves the stores inconsistent with no atomicity. Prefer **B**: write once to the system of record (with an outbox row in the same transaction), then stream changes to the other store via CDC — atomic and ordered. Use **C** when near-real-time isn't needed and a nightly/periodic sync is acceptable (analytics warehouse loads).

**What would change it:** Required freshness (real-time → B; daily fine → C), whether you can run a CDC pipeline, and the cost of temporary inconsistency. Dual writes are almost never the right answer at scale.

---

### DQ8. Graph database vs relational recursive queries for relationship-heavy data

**Options:** A) Graph DB (Neo4j/Neptune). B) Relational with recursive CTEs / closure tables. C) Relational + an in-memory graph computed at query time.

**Recommendation:** If multi-hop traversals (paths, rings, neighborhoods) are the *core, frequent* query at scale, **A** — purpose-built and fast for deep traversals. For shallow hops, moderate scale, or occasional traversal, **B** keeps everything in one store (recursive CTEs handle bounded depth fine). **C** suits cases where the graph is small enough to load and traverse in memory on demand, avoiding a second datastore.

**What would change it:** Traversal depth/frequency and graph size (deep + frequent + large → A), whether you want to avoid a second store (→ B/C), and the consistency lag tolerable between the relational source and a derived graph.
