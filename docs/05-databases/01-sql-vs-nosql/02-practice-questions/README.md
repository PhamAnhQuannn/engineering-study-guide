# SQL vs NoSQL — Practice Questions

[← Topic overview](../README.md)

> Topic: Data model fit, consistency, scaling tradeoffs.

Recall, teaching, and MCQ. Answer before expanding.

---

### Q1. Name the main NoSQL families and one use case each.

**Answer:** **Key-value** (Redis/DynamoDB) — caches, sessions, rate limiters (O(1) lookup by key). **Document** (MongoDB/Firestore) — user profiles, catalogs, CMS content (self-contained aggregates, flexible schema). **Wide-column** (Cassandra/Bigtable) — time-series, event feeds, write-heavy at scale with known query patterns. **Graph** (Neo4j/Neptune) — social graphs, recommendations, fraud detection (relationship traversals). Plus **search** (Elasticsearch) for full-text and **time-series** (InfluxDB/Timescale) for metrics. Saying just "NoSQL" in an interview is a red flag — name the family.

---

### Q2. "NoSQL is schemaless" — true or false, and explain to a junior.

**Answer:** False (or misleading). NoSQL stores are **schema-on-read** rather than schema-on-write: the database doesn't enforce structure at write time, so you can store varied shapes — but the schema doesn't vanish, it moves into your **application code**, which must know how to interpret the documents and handle multiple versions. Relational DBs are schema-on-write: structure is enforced and changing it needs a migration. So it's a tradeoff between "DB enforces shape" (safety, predictability) and "app enforces shape" (flexibility, faster early iteration, but you own version handling).

---

### Q3. When is a relational database the better choice despite "scale" concerns?

**Answer:** When you need rich/ad-hoc queries, joins across many entities, multi-row ACID transactions, and strong consistency — and the data is highly relational. Relational scales further than people assume: vertical scaling, read replicas, partitioning, `JSONB` for semi-structured bits, and full-text search cover a lot. If you genuinely need horizontal write scale *and* transactions/joins, the answer is usually **NewSQL/distributed SQL** (Spanner, CockroachDB, Vitess/Citus), not abandoning the relational model for Cassandra.

---

### Q4. Explain CAP and why "CA" isn't a real operational choice.

**Answer:** CAP says that during a network **partition** a distributed store must choose between **Consistency** (reject/redirect to avoid serving stale/divergent data) and **Availability** (keep serving, reconcile later). Partitions *will* happen in any distributed system, so you don't get to "choose CA and avoid partitions" — partition tolerance is mandatory. The real choice is **CP** (sacrifice availability under partition, e.g., Spanner/HBase/default Mongo) vs **AP** (sacrifice consistency under partition, e.g., Dynamo/Cassandra). The better model is **PACELC**: under Partition pick A/C; Else (normal operation) pick Latency/Consistency.

---

### Q5. What is tunable consistency and the R + W > N rule?

**Answer:** In Dynamo/Cassandra-style stores, data is replicated to **N** nodes, and each operation specifies how many replicas must respond: **W** for a write to be acknowledged, **R** for a read. If **R + W > N**, the read and write quorums overlap by at least one node, so a read is guaranteed to see the latest acknowledged write (strong-ish consistency / read-your-writes). Lower R/W (e.g., R=W=1) gives lower latency and higher availability but can return stale data. It lets you trade consistency vs latency/availability **per operation**.

---

### Q6. Your team wants to add MongoDB next to Postgres "for flexibility." How do you push back constructively?

**Answer:** Ask what access pattern needs it. Postgres already offers `JSONB` (indexable, queryable documents), arrays, full-text search, and partitioning — so "flexible/semi-structured fields" usually don't require a second datastore. Adding MongoDB means a second system to operate, back up, secure, and — critically — **keep in sync** with Postgres (the dual-write/consistency problem). I'd only add it if there's a concrete pattern Postgres can't serve well at our scale, and even then prefer CDC/outbox over dual writes. Default: one store until a measured need justifies more.

---

### Q7. Why must you know your query patterns before choosing a wide-column store?

**Answer:** Wide-column stores (Cassandra) have no general query planner and limited/expensive secondary indexes — efficient queries must hit a single partition by its key. So you **model one table per query**, choosing partition and clustering keys to match each access path, and you **denormalize** (duplicate data across tables) to serve different queries. If a new, unanticipated query arrives, you may have no efficient way to answer it without re-modeling and backfilling. Relational lets you write arbitrary queries after the fact; wide-column trades that flexibility for linear write scale.

---

### Q8 (MCQ). You need to power "people you may know" (friends-of-friends, shortest paths) on a social network. Best-fit store?

- A. Key-value
- B. Wide-column
- C. Graph database
- D. Relational with recursive CTEs

**Answer: C (graph).** Multi-hop relationship traversals are first-class and cheap in a graph DB, where they'd be deep, expensive self-joins relationally. D (relational + recursive CTE) works for shallow hops/moderate scale; at social-network scale a graph engine is purpose-built.

---

### Q9 (MCQ). Which best fits a high-write IoT pipeline ingesting millions of timestamped sensor readings per minute, with mostly time-range queries?

- A. Graph database
- B. Wide-column / time-series store
- C. Single-node relational with random-UUID PKs
- D. Key-value cache

**Answer: B.** Wide-column (Cassandra) or a time-series DB scales writes linearly and is optimized for time-partitioned, append-heavy data with range scans and retention/downsampling. A graph is wrong for this shape; a single-node relational store with random PKs would bottleneck on write locality.

---

### Q10 (MCQ). "NoSQL databases cannot support transactions." This statement is:

- A. Always true
- B. Always false
- C. Outdated — many modern NoSQL stores support transactions
- D. True only for graph databases

**Answer: C.** MongoDB supports multi-document transactions, DynamoDB has transactional APIs, and NewSQL/distributed-SQL stores provide full ACID. The blanket claim is outdated; the real differences are scope, cost, and default consistency.

---

### Q11. What is polyglot persistence and what's its main cost?

**Answer:** Polyglot persistence is using multiple specialized datastores in one system — e.g., Postgres as system of record, Redis for caching/sessions, Elasticsearch for search, a wide-column store for high-volume events, object storage for blobs — each chosen for what it does best. The main cost is **keeping them consistent**: data must be propagated between stores (CDC, outbox, or risky dual writes), and you reason about eventual consistency across them, plus the operational burden of running, securing, and backing up several systems. Justify each additional store with a concrete access pattern.

---

### Q12. A document store lets you embed related data to avoid joins. When is embedding the wrong choice?

**Answer:** Embedding works when the related data is part of the same aggregate, read/written together, and bounded in size (a user and their settings). It's wrong when: the embedded collection grows unbounded (comments on a viral post → ever-growing document hitting size limits), the embedded entity is shared/referenced by many parents (duplicating it causes update fan-out), or you need to query the embedded items independently across parents. Then you reference by id (and accept a lookup) instead — i.e., you've rediscovered why relational normalization exists.
