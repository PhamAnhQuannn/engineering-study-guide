# SQL vs NoSQL — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Data model fit, consistency, scaling tradeoffs.

Senior study notes on choosing between relational and non-relational stores. The senior framing: there is no "SQL vs NoSQL" winner — there are **data models** and **consistency/scaling requirements**, and you pick the store whose physics match your dominant access patterns. "NoSQL" is not one thing; it's four+ very different families.

---

## 1. Why the question exists

Relational databases assume you don't fully know your queries up front, so they store data **normalized** and let a query planner join it at read time — flexible queries, strong consistency, ACID. That flexibility costs: joins and ACID across many rows are hard to scale horizontally. "NoSQL" stores relax one or more of {rich queries, joins, strong consistency, fixed schema} to buy **horizontal scalability, throughput, or data-model fit**. The choice is which constraints you're willing to trade.

---

## 2. The NoSQL families (know all of them — "NoSQL" alone is a non-answer)

- **Key-value** (Redis, DynamoDB at its core, Memcached) — `get(key)`/`put(key,val)`. O(1) lookups, trivially shardable by key. No queries beyond the key. Caches, sessions, feature flags, rate limiters.
- **Document** (MongoDB, Couchbase, DynamoDB, Firestore) — JSON-like documents keyed by id; flexible/optional schema; query by fields with secondary indexes; nested data avoids joins. Catalogs, user profiles, content, anything that's naturally a self-contained aggregate.
- **Wide-column** (Cassandra, ScyllaDB, HBase, Bigtable) — rows keyed by a partition key with sparse, wide columns; designed for massive write throughput and linear horizontal scale; **query patterns must be known up front** because you model tables per query. Time-series, event logs, feeds, IoT, write-heavy at scale.
- **Graph** (Neo4j, Neptune, JanusGraph) — nodes + edges as first-class; traversals (friends-of-friends, shortest path, recommendations) that would be many self-joins in SQL. Social graphs, fraud rings, knowledge graphs, recommendations.
- **Search** (Elasticsearch/OpenSearch) — inverted-index full-text and aggregation engine; not a primary store but often paired with one.
- **Time-series** (InfluxDB, TimescaleDB — the latter is Postgres) — optimized for append-heavy timestamped metrics with downsampling/retention.
- **NewSQL / distributed SQL** (Spanner, CockroachDB, YugabyteDB, Vitess) — relational model + ACID + SQL **with** horizontal scale and geo-distribution. Often the right answer when people reach for NoSQL "for scale" but still want transactions and joins.

---

## 3. Data model fit (the primary axis)

Ask: *what is the natural shape of the data and the dominant access pattern?*

- **Highly relational, many-to-many, ad-hoc queries** → relational. Joins and a query planner earn their keep.
- **Self-contained aggregate read/written as a unit** (a document, a user profile with embedded settings) → document store; embedding avoids joins.
- **Pure lookup by key, extreme throughput** → key-value.
- **Write-heavy, known query patterns, linear scale** → wide-column (model one table per query; denormalize aggressively).
- **Relationship traversal is the query** (paths, hops) → graph.
- **Full-text relevance ranking** → search index alongside the system of record.

A senior insight: relational stores can do a *lot* of "NoSQL" jobs now — Postgres `JSONB` (document-ish), arrays, `hstore`, full-text search, `LISTEN/NOTIFY`, time-series via Timescale, even key-value via unlogged tables. Reaching for a second datastore adds operational and consistency cost — justify it.

---

## 4. Consistency and the CAP/PACELC framing

- **ACID** (relational, and increasingly NewSQL/Mongo with multi-doc transactions) — strong consistency, transactions across rows/documents.
- **BASE** (Basically Available, Soft state, Eventual consistency) — many NoSQL stores favor availability and partition tolerance, accepting that replicas converge *eventually*. Reads may be stale.
- **CAP** — under a network **partition** you must choose **Consistency or Availability**. CP systems (e.g., default Mongo, HBase, Spanner) reject/redirect to stay consistent; AP systems (Cassandra/Dynamo-style) stay available and reconcile later. (When there's no partition, you're not forced to choose — see PACELC.)
- **PACELC** — the better senior framing: on **P**artition choose **A**/**C**; **E**lse (normal operation) choose **L**atency/**C**onsistency. Dynamo-style stores trade consistency for latency even without partitions; Spanner pays latency for consistency.
- **Tunable consistency** — Cassandra/Dynamo let you choose per-operation quorum: with replication factor N, if read replicas **R + W > N**, you get read-your-writes/strong-ish consistency at the cost of latency/availability; `R=W=1` is fast but stale-prone.

---

## 5. Scaling tradeoffs

- **Vertical scaling (relational default)** — bigger box. Simple, preserves joins/ACID, but a ceiling; read replicas scale reads, not writes.
- **Sharding/partitioning** — relational sharding (Vitess, Citus, app-level) is possible but cross-shard joins and transactions get hard. Many NoSQL stores **shard natively** by partition key — that's their whole value proposition.
- **Write scaling** — wide-column/Dynamo-style scale writes linearly by adding nodes; relational single-primary write scaling is the classic bottleneck (mitigate with CQRS, queues, sharding, or NewSQL).
- **Hot keys / skew** — any partitioned store suffers if one partition key is far hotter (a celebrity user, a popular tenant). Mitigate with key salting, splitting, or caching.
- **Operational cost** — relational is mature and well-understood; distributed NoSQL trades that for tunability and scale but adds operational complexity (repair, compaction, rebalancing, eventual-consistency reasoning).

---

## 6. Schema & evolution

- **Relational** — schema-on-write: structure enforced at write time; migrations needed to change shape (see DB Operations). Strong integrity, predictable shape.
- **Document/wide-column** — schema-on-read (flexible): write any shape, the app interprets it. Faster early iteration and heterogeneous data, but the schema doesn't disappear — it moves into application code, and you must handle multiple versions at read time. "Schemaless" is a misnomer; it's "schema enforced by the app instead of the DB."

---

## 7. Polyglot persistence

Real systems use **multiple** stores, each for what it's best at: Postgres as the system of record, Redis for cache/sessions, Elasticsearch for search, a wide-column store for the high-volume event feed, an object store for blobs. The cost is **keeping them in sync** (CDC, dual writes, the dual-write consistency problem) and more operational surface. Default to one store until a clear access pattern justifies adding another.

---

## 8. Common pitfalls & misconceptions

- **"NoSQL is faster/more scalable than SQL."** Only for the access patterns it's designed for; for ad-hoc queries and joins it's often worse. Modern Postgres scales very far vertically and with read replicas.
- **"NoSQL means no schema."** It means schema-on-read; the schema lives in your code.
- **"NoSQL can't do transactions."** Many now do (Mongo multi-doc, DynamoDB transactions, NewSQL full ACID).
- **Choosing wide-column without knowing query patterns** — you model tables *per query*; ad-hoc queries you didn't plan for are painful or impossible.
- **Reaching for NoSQL "for scale" when you need joins/transactions** — that's a NewSQL/distributed-SQL case, not Cassandra.
- **Dual-writes to two stores without a consistency strategy** — guaranteed drift; use CDC/outbox.
- **Ignoring eventual consistency in app logic** — read-after-write surprises, lost updates from last-writer-wins.

---

## 9. What interviewers probe

- "When would you pick NoSQL over a relational DB?" → name the *family*, the *access pattern*, and the *tradeoff* (e.g., "wide-column for a write-heavy feed with known queries, accepting denormalization and no ad-hoc joins").
- "Design X — what store and why?" → derive from access patterns and consistency needs, not buzzwords.
- "Explain eventual consistency / tunable consistency / quorum (R+W>N)."
- "CAP / PACELC — what does your chosen store sacrifice under a partition and in normal operation?"
- "Can Postgres do this instead?" → know JSONB, full-text, arrays; justify a second store.
- "How do you keep two datastores in sync?" → CDC/outbox, dual-write problem.

---

## 10. Quick-reference summary

- **Not a binary.** Match the store family to the **data model** and **consistency/scale** needs.
- **Families:** key-value (lookup/throughput), document (self-contained aggregates), wide-column (write-heavy, known queries, linear scale), graph (traversals), search (full-text), NewSQL (relational + horizontal scale + ACID).
- **Pick relational** for rich/ad-hoc queries, joins, transactions, strong consistency; it scales further than people think (replicas, JSONB, partitioning, NewSQL).
- **Pick NoSQL** when one dimension dominates: pure key lookups, flexible documents, massive known-pattern writes, or relationship traversal.
- **Consistency:** ACID vs BASE; CAP (partition: pick C or A); **PACELC** (else: latency vs consistency); tunable quorum `R+W>N`.
- **Scaling:** relational = vertical + replicas (+ sharding/NewSQL); NoSQL = native horizontal sharding by partition key (watch hot keys).
- **Polyglot persistence** is normal but every extra store is a sync/ops cost — justify it. Default to one store; add a second for a specific, measured access pattern.
