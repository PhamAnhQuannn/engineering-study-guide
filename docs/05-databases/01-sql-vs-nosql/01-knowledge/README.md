# SQL vs NoSQL — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Data model fit, consistency, scaling tradeoffs.

> **🛒 Where we are in building ShopFast** — Last topic we added [WebSockets & Streaming](../../../04-networking/05-websockets/01-knowledge/README.md) — real-time channels for live updates. Now we build ShopFast's data layer: this topic gives us the framework to choose the right store for each access pattern — relational vs document vs key-value — and explains why Postgres stays the right answer for most of ShopFast at launch. **Next:** [Schema Design](../../02-schema-design/01-knowledge/README.md) — designing the actual table shapes for products, orders, and carts.

---

## Teaching arc: choosing ShopFast's data stores

### What it is

"SQL vs NoSQL" is a false binary. The real question is: **which store's physics match my data model and consistency requirements?** Think of database stores as tools: a relational database is a Swiss Army knife — flexible, consistent, works for many jobs. A key-value store is a specialized scalpel — blindingly fast for one operation, useless for others. "NoSQL" isn't one thing; it's at least five distinct families, each with a different strength.

The senior framing: every store trades *something* for *something else*. Relational databases trade horizontal write scalability for the ability to join normalized data and maintain ACID transactions. Key-value stores trade rich queries for O(1) throughput. Wide-column stores trade ad-hoc queries for linear write scalability. You pick the store whose tradeoffs you can afford.

### What it looks like

ShopFast already uses two stores by the end of T3 (System Design tier):

```
Browser / Mobile
      │
      ▼
  Load Balancer
      │
      ▼
  App Servers  ──► Redis (key-value)  ← sessions, hot-product cache (TTL ~60s)
      │
      ▼
  PgBouncer (connection pooler)
      │
      ▼
  Postgres primary  ──► Read replicas  ← catalog reads, order history
  (orders, products,
   inventory, carts)
```

Postgres is the **system of record** (writes + strong consistency). Redis is a **cache + session store** (availability-first, seconds-stale OK). Two stores — each doing what it's best at. The canonical ShopFast fact: **"catalog = availability-first (seconds-stale OK); checkout/order = strong consistency (no double-charge, no oversell)."**

### The code that builds it

The access pattern determines the store. Here's how the same "product" data flows through two different stores:

```typescript
// Cache-aside pattern: Redis for hot catalog reads (key-value store)
async function getProduct(id: string): Promise<Product> {
  const cacheKey = `product:${id}`;
  const cached = await redis.get(cacheKey);       // O(1) Redis GET
  if (cached) return JSON.parse(cached);

  const product = await db.queryOne(              // Postgres fallback (system of record)
    'SELECT id, name, price_cents, status FROM products WHERE id = $1', [id]
  );
  await redis.setex(cacheKey, 60, JSON.stringify(product));  // TTL 60s + jitter
  return product;
}

// Write goes ONLY to Postgres (Redis outage degrades gracefully to DB reads)
async function updateProductPrice(id: string, priceCents: number) {
  await db.query('UPDATE products SET price_cents = $1 WHERE id = $2', [priceCents, id]);
  await redis.del(`product:${id}`);               // invalidate cache on write
}
```

### The code that calls it

Choosing between stores at the application layer — the routing logic that decides where to read from:

```typescript
// Catalog browse: read replica (reads can be slightly stale — availability-first)
const products = await readReplicaDb.query(
  'SELECT id, name, price_cents FROM products WHERE status = $1 AND price_cents < $2 LIMIT 20',
  ['active', maxPrice]
);

// Checkout: primary only (strong consistency — no oversell, no double-charge)
const order = await primaryDb.transaction(async (tx) => {
  // ... SELECT FOR UPDATE on inventory, INSERT order (see Transactions topic)
});

// Session lookup: Redis (pure key-value, microsecond latency)
const session = await redis.get(`session:${sessionToken}`);
```

### Types & differences

| Store family | One-line | Data shape | Reach for it when… |
|---|---|---|---|
| **Relational** (Postgres, MySQL) | Tables + SQL + ACID | Normalized rows, typed columns | Rich/ad-hoc queries, joins, transactions, strong consistency — the default |
| **Key-value** (Redis, DynamoDB core, Memcached) | `get(key)` / `set(key, val)` | Opaque value blob | Cache, sessions, rate limiting, feature flags — pure lookup, extreme throughput |
| **Document** (MongoDB, Couchbase, Firestore) | JSON documents, flexible schema | Self-contained aggregates | Catalogs with varying attributes, user profiles, content — natural aggregate shape |
| **Wide-column** (Cassandra, ScyllaDB, Bigtable) | Rows + sparse columns, partition key | Write-heavy, known query patterns | Massive write throughput, time-series, feeds, IoT — scale beats flexibility |
| **Graph** (Neo4j, Neptune) | Nodes + edges as first-class | Relationship traversal | Social graphs, fraud rings, recommendations — when the *path* is the query |
| **Search** (Elasticsearch, OpenSearch) | Inverted index + aggregations | Text documents | Full-text search, relevance ranking, log analytics — pairs with a primary store |
| **NewSQL** (Spanner, CockroachDB, YugabyteDB) | Relational + ACID + horizontal scale | Normalized, distributed | When you need SQL/ACID *and* horizontal write scale — before choosing Cassandra |
| **Time-series** (InfluxDB, TimescaleDB) | Timestamped metrics, downsampling | Append-heavy, time-ordered | Metrics, monitoring, IoT telemetry |

### Build it for real — ShopFast

ShopFast at launch has three clear access patterns:

1. **Catalog reads** — highly cacheable, seconds-stale OK, relational structure (products with prices, categories, inventory). → **Postgres + Redis cache**. No need for a document store — Postgres JSONB handles flexible product attributes.
2. **Checkout** — ACID transactions across `inventory`, `orders`, `order_items`. Strong consistency required. → **Postgres primary** only.
3. **Sessions** — pure key lookup, no joins, sub-millisecond required. → **Redis** (already present for cache). No need for a separate session DB.

**Decision:** Postgres as the single system of record; Redis for cache and sessions. This is the canonical ShopFast architecture. **No sharding at launch** — the launch scale (~1M users, ~1,800 peak read QPS, ~60 GB) fits comfortably on one Postgres primary with read replicas. "Shard only when write/storage outgrows one primary."

**Rejected:** MongoDB for the product catalog — it would lose ACID transactions across `orders`/`inventory` (critical for checkout correctness) and gains nothing over Postgres JSONB for flexible product attributes. Cassandra for orders — write scalability is not the bottleneck at launch; cross-row transactions across `inventory` and `orders` are essential, and Cassandra's lack of joins makes order-history queries painful. DynamoDB — vendor lock-in with minimal benefit over Postgres at this scale; justified only if we outgrow Postgres write throughput on a hosted platform.

> **If you get this wrong:** adding a second datastore "for scale" before you need it costs engineering time to build sync pipelines, introduces eventual-consistency bugs (a product shows as in-stock on the browse page but rejects at checkout because the two stores diverged), and doubles operational surface area. At ShopFast's launch scale, Postgres with replicas is the correct choice. Premature NoSQL adoption is one of the most common and expensive architectural mistakes.

### Scaling story

- **Now (launch):** Postgres primary + read replicas + PgBouncer + Redis cache. One system of record, zero sync complexity.
- **Growth signal:** write QPS to `orders`/`inventory` pushes toward primary CPU saturation. `pg_stat_activity` shows write queue depth growing. Alternatively: a specific access pattern emerges (e.g., a user activity feed that's write-heavy and never queried relationally) that Postgres serves poorly.
- **At scale:** evaluate adding a **wide-column store** (Cassandra/DynamoDB) for the specific write-heavy feed, keeping Postgres as the transactional core. Or adopt a **NewSQL distributed SQL** solution (CockroachDB, YugabyteDB) if you want horizontal write scale *with* ACID and SQL. **Polyglot persistence** — multiple stores for different workloads — is normal at scale but every extra store adds a CDC (Change Data Capture) / sync pipeline and an operational burden. The canonical rule: **default to one store; add a second for a specific, measured access pattern.** See [DB Operations](../../05-db-operations/01-knowledge/README.md) for the operational impact.

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
- **BASE (Basically Available, Soft state, Eventually consistent)** — many NoSQL stores favor availability and partition tolerance, accepting that replicas converge *eventually*. Reads may be stale.
- **CAP theorem** — under a network **partition** (P) you must choose **Consistency (C) or Availability (A)**. CP systems (e.g., default Mongo, HBase, Spanner) reject/redirect to stay consistent; AP systems (Cassandra/Dynamo-style) stay available and reconcile later. (When there's no partition, you're not forced to choose — see PACELC.)
- **PACELC** — the better senior framing: on **P**artition choose **A**/**C**; **E**lse (normal operation) choose **L**atency/**C**onsistency. Dynamo-style stores trade consistency for latency even without partitions; Spanner pays latency for consistency.
- **Tunable consistency** — Cassandra/Dynamo let you choose per-operation quorum: with replication factor N, if read replicas **R + W > N**, you get read-your-writes/strong-ish consistency at the cost of latency/availability; `R=W=1` is fast but stale-prone.

---

## 5. Scaling tradeoffs

- **Vertical scaling (relational default)** — bigger box. Simple, preserves joins/ACID, but a ceiling; read replicas scale reads, not writes.
- **Sharding/partitioning** — relational sharding (Vitess, Citus, app-level) is possible but cross-shard joins and transactions get hard. Many NoSQL stores **shard natively** by partition key — that's their whole value proposition.
- **Write scaling** — wide-column/Dynamo-style scale writes linearly by adding nodes; relational single-primary write scaling is the classic bottleneck (mitigate with CQRS (Command Query Responsibility Segregation), queues, sharding, or NewSQL).
- **Hot keys / skew** — any partitioned store suffers if one partition key is far hotter (a celebrity user, a popular tenant). Mitigate with key salting, splitting, or caching.
- **Operational cost** — relational is mature and well-understood; distributed NoSQL trades that for tunability and scale but adds operational complexity (repair, compaction, rebalancing, eventual-consistency reasoning).

---

## 6. Schema & evolution

- **Relational** — schema-on-write: structure enforced at write time; migrations needed to change shape (see DB Operations). Strong integrity, predictable shape.
- **Document/wide-column** — schema-on-read (flexible): write any shape, the app interprets it. Faster early iteration and heterogeneous data, but the schema doesn't disappear — it moves into application code, and you must handle multiple versions at read time. "Schemaless" is a misnomer; it's "schema enforced by the app instead of the DB."

---

## 7. Polyglot persistence

Real systems use **multiple** stores, each for what it's best at: Postgres as the system of record, Redis for cache/sessions, Elasticsearch for search, a wide-column store for the high-volume event feed, an object store for blobs. The cost is **keeping them in sync** (CDC (Change Data Capture), dual writes, the dual-write consistency problem) and more operational surface. Default to one store until a clear access pattern justifies adding another.

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
