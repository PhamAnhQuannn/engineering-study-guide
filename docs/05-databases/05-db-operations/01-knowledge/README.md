# DB Operations — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Migrations, zero-downtime, pooling, N+1.

> **🛒 Where we are in building ShopFast** — Last topic we locked down [Transactions & Isolation](../../04-transactions/01-knowledge/README.md) — ACID guarantees for concurrent checkout. Now we need to keep that database running safely in production: migrating the `products`/`orders`/`inventory`/`carts` schema without taking down the site, pooling connections correctly, and diagnosing the N+1 (one query per parent row) bugs that ORM (Object-Relational Mapper) code hides until production. **Next:** [Cryptography Basics](../../../06-security/01-crypto/01-knowledge/README.md) — hashing, encryption, and signing — the building blocks of security.

---

## Teaching arc: operating ShopFast's database safely

### What it is

DB operations is the discipline of running a database in production: changing the schema while traffic is live, managing how application processes connect, and diagnosing the performance problems that only appear at scale. It's the difference between a schema that works in a staging environment with 100 rows and one that deploys safely to production with 50 million rows under continuous traffic.

A useful mental model: a live production database is like changing a tire on a moving car. You can do it, but only if you follow a careful sequence that keeps the car rolling the whole time. Schema migrations are that sequence — **expand first** (add new structures the old code tolerates), **backfill** (populate the new structures in batches), **contract later** (remove the old structures once all code has switched). Never change the tire and the steering wheel at the same instant.

### What it looks like

The most dangerous migration in e-commerce: adding a `NOT NULL` column to a table with tens of millions of rows while checkout is live.

```
❌ Dangerous — one-shot migration locks the table:
ALTER TABLE orders ADD COLUMN coupon_code TEXT NOT NULL DEFAULT '';

✅ Safe — three-phase expand → backfill → contract:
Phase 1 (expand):   ALTER TABLE orders ADD COLUMN coupon_code TEXT;  -- nullable, no lock
Phase 2 (backfill): UPDATE orders SET coupon_code = '' WHERE coupon_code IS NULL
                    -- batched: WHERE id BETWEEN :start AND :end, with sleep between batches
Phase 3 (contract): ALTER TABLE orders ALTER COLUMN coupon_code SET NOT NULL;
                    -- fast in Postgres once all NULLs are gone
```

### The code that builds it

Safe migration patterns for ShopFast's schema — each step runnable independently:

```sql
-- Adding an index to orders without blocking writes (CONCURRENTLY = no write lock)
CREATE INDEX CONCURRENTLY idx_orders_coupon
  ON orders (coupon_code)
  WHERE coupon_code IS NOT NULL;        -- ← partial index; only index rows that matter

-- Adding a FK constraint safely: NOT VALID skips scanning existing rows (fast),
-- VALIDATE CONSTRAINT checks existing rows separately (weaker lock, can be interrupted)
ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_products
  FOREIGN KEY (product_id) REFERENCES products(id)
  NOT VALID;                            -- ← step 1: create constraint, skip existing rows

ALTER TABLE order_items
  VALIDATE CONSTRAINT fk_order_items_products; -- ← step 2: validate existing rows (ShareLock, not ExclusiveLock)

-- Batched backfill — never update millions of rows in one statement
DO $$
DECLARE
  batch_size INT := 1000;
  last_id    BIGINT := 0;
  max_id     BIGINT;
BEGIN
  SELECT MAX(id) INTO max_id FROM orders;
  WHILE last_id < max_id LOOP
    UPDATE orders
    SET coupon_code = ''
    WHERE id > last_id AND id <= last_id + batch_size
      AND coupon_code IS NULL;          -- ← only rows that need it
    last_id := last_id + batch_size;
    PERFORM pg_sleep(0.05);            -- ← yield to other queries; reduce replica lag
  END LOOP;
END $$;
```

### The code that calls it

The N+1 (N plus one query) problem — the most common ORM performance bug, invisible in dev, catastrophic in prod:

```typescript
// ❌ N+1: 1 query for orders, then 1 query PER order for its items
const orders = await Order.findAll({ where: { userId } });          // 1 query
for (const order of orders) {
  const items = await order.getOrderItems();                        // N queries!
  console.log(items);
}
// At 5 rows in dev: fine. At 500 orders in prod: 501 queries, 200ms+ latency.

// ✅ Fix: eager load — one JOIN query fetches orders + items together
const orders = await Order.findAll({
  where: { userId },
  include: [{ model: OrderItem, include: [Product] }],              // ← one query (or 2 with prefetch)
});

// ✅ Fix: batch with IN — collect parent ids, one query for all children
const orderIds = orders.map(o => o.id);
const items = await OrderItem.findAll({
  where: { orderId: { [Op.in]: orderIds } },                        // ← 1 query for all items
});
```

Detect N+1 with query logging (count the queries in a request cycle), an APM (Application Performance Monitoring) trace (you'll see a fan of identical queries), or `pg_stat_statements` in Postgres.

### Types & differences

| Migration technique | When to use | Risk |
|---|---|---|
| **Expand–contract (parallel-change)** | Any breaking schema change on a live table | Low — old and new code coexist during transition |
| **`CREATE INDEX CONCURRENTLY`** | Adding an index to a hot table | Low — no write lock; takes longer, can fail and leave an invalid index to clean up |
| **`NOT VALID` + `VALIDATE CONSTRAINT`** | Adding FK or CHECK to a large table | Low — validation uses a weaker lock |
| **Batched backfill** | Populating a new column on millions of rows | Low if batched with sleep; high if done in one statement |
| **`lock_timeout`** | Any DDL on a busy table | Prevents one stalled migration from queuing all queries behind it |
| **One-shot `ALTER TABLE … ADD COLUMN NOT NULL DEFAULT`** | Never on a big live table | High — exclusive lock for the full rewrite |

| Pooling mode | Multiplexing | Breaks |
|---|---|---|
| **Transaction pooling (PgBouncer)** | Very high — server connection shared across many clients | Session-level features: prepared statements across calls, `SET`, `LISTEN/NOTIFY`, advisory locks |
| **Session pooling** | Moderate — one server conn per client session | Nothing — safest, but limits concurrency |
| **Statement pooling** | Highest | Everything session-related — rarely used |

### Build it for real — ShopFast

ShopFast's canonical database setup: **Postgres primary + read replicas + PgBouncer**. The schema will evolve — new columns, new indexes, new tables — as features ship. Every migration must be safe to run against a live system where checkout, catalog browse, and order history are all in flight.

**Decision:** adopt the expand–contract pattern as the default migration strategy from day one. All index creation via `CREATE INDEX CONCURRENTLY`. All `NOT NULL` column additions via the three-phase pattern. `lock_timeout = '2s'` set on all migration sessions so a migration that can't grab a lock in 2 seconds fails loudly rather than stalling the entire table behind it.

PgBouncer in **transaction pooling mode** — this multiplexes thousands of app-server connections onto a small set of Postgres backend connections, essential given Postgres's per-connection process cost. ShopFast's app code does not use session-level prepared statements across requests (the ORM uses per-request statement preparation), so transaction pooling is safe.

**Rejected:** running migrations in the same deployment step as the code that depends on them — the classic "deploy schema + code atomically" mistake. During a rolling deploy, old pods see the new schema (and must tolerate it) while new pods run. A `NOT NULL` column added simultaneously with the code that writes it will crash old pods that don't write it. Expand first, deploy new code, contract later.

> **If you get this wrong:** a `CREATE INDEX` (without `CONCURRENTLY`) on the `orders` table during a peak traffic window takes an exclusive write lock for minutes. Every `INSERT INTO orders` (i.e., every checkout) queues behind the lock. ShopFast's checkout is down for the duration of the index build — a self-inflicted outage from a routine schema change. This is one of the most common production incidents in e-commerce systems.

### Scaling story

- **Now (launch):** expand–contract for all migrations, `CREATE INDEX CONCURRENTLY`, `lock_timeout` guard, PgBouncer transaction pooling. Connection pool sized to ~2× Postgres CPU cores per replica, not "number of app workers."
- **Growth signal:** PgBouncer queue depth climbs (`pgbouncer` admin console `SHOW POOLS` shows `cl_waiting > 0`); `pg_stat_activity` shows many idle-in-transaction connections (a sign that app code is holding transactions open during HTTP calls); replication lag on read replicas rises during backfills.
- **At scale:** table partitioning for `orders` and `order_items` by `created_at` — monthly partitions allow `DROP TABLE` for old data (O(1) vs deleting billions of rows), and queries on recent orders prune to one or two partitions. Logical replication (rather than physical WAL streaming) enables cross-version upgrades and CDC pipelines feeding analytics. VACUUM tuning becomes critical on `inventory` (high update rate under checkout load). Add `pgaudit` and slow-query alerting (`log_min_duration_statement`) as operational baselines. All of these operational concerns converge with the resilience patterns in [Distributed Systems: Failure Handling](../../../05-distributed-systems/01-failure-handling/01-knowledge/README.md).

---

## 1. Schema migrations & zero-downtime change

In a live system, schema changes run **while the old application code is still serving traffic** and the new code is rolling out. The cardinal rule: **never deploy a schema change and the code that requires it at the same instant** — the old and new code versions must both work against an intermediate schema. This is the **expand–contract** (parallel-change) pattern:

1. **Expand** — make an additive, backward-compatible change (add a nullable column, add a new table, add an index `CONCURRENTLY`). Old code ignores it; new code can use it.
2. **Migrate/backfill** — populate new structures in batches; dual-write from app code if needed so both old and new paths stay consistent.
3. **Contract** — once all code uses the new shape and you've verified, remove the old column/table/constraint.

**Destructive/locking operations to fear:**
- `ALTER TABLE ... ADD COLUMN NOT NULL DEFAULT <volatile>` on big tables historically rewrote the whole table under an exclusive lock (modern Postgres optimizes constant defaults; volatile defaults still rewrite). Prefer add nullable → backfill → set `NOT NULL` (via `NOT VALID` + `VALIDATE` in PG).
- `CREATE INDEX` takes a lock that blocks writes — use `CREATE INDEX CONCURRENTLY` (Postgres) / online DDL (MySQL `pt-online-schema-change`, `gh-ost`).
- `DROP COLUMN`/`DROP TABLE`/type narrowing — destructive and may lock; do them in the contract phase, after a safety window.
- Adding a `FOREIGN KEY` or `CHECK` validates existing rows under lock — add as `NOT VALID`, then `VALIDATE CONSTRAINT` separately (cheaper lock).
- Long-held `ACCESS EXCLUSIVE` locks queue behind/ahead of normal queries — set a short `lock_timeout` so a migration that can't grab the lock fails fast instead of stalling the whole table.

**Migration hygiene:** migrations are **forward-only, idempotent-ish, versioned, and reviewed**; always have a **rollback plan** (reverse migration or roll-forward fix). Test on a production-sized copy. Run backfills in **bounded batches** with sleeps to avoid replica lag and lock pile-ups.

---

## 2. Connection pooling

Databases handle a **limited** number of concurrent connections; each backend connection costs memory (Postgres forks a process per connection — expensive). App servers spawn many workers; without pooling you exhaust connections and the DB falls over.

- **Application-side pool** (HikariCP, pgx pool) — reuse a fixed set of connections across requests; size it deliberately.
- **External pooler** (PgBouncer, ProxySQL, RDS (Relational Database Service) Proxy) — sits between app and DB, multiplexes thousands of client connections onto a small set of server connections.
  - **Transaction pooling** (PgBouncer) — a server connection is assigned only for the duration of a transaction → huge multiplexing, but **breaks session-level features** (prepared statements across calls, `SET`, session advisory locks, `LISTEN/NOTIFY`).
  - **Session pooling** — one server connection per client session; safer, less multiplexing.
- **Sizing:** more connections is *not* better. A DB with N cores can do only ~N concurrent CPU-bound queries; beyond that, connections contend and throughput drops (thundering herd). Rule of thumb: pool size ≈ a small multiple of cores, not "number of app workers." The whole fleet's pools must sum to under `max_connections`.
- **Serverless/Lambda** explodes connection counts → a pooler/proxy is mandatory.

---

## 3. The N+1 query problem

The most common ORM performance bug: fetch N parent rows, then fire **one extra query per parent** to load a relation → 1 + N queries.

```python
# N+1: 1 query for authors, then 1 query per author for their books
for author in Author.objects.all():        # 1 query
    print(author.books.all())              # N queries
```

**Fixes:**
- **Eager load / join** — fetch parents and children in one (or two) queries: SQL `JOIN`, Django `select_related`/`prefetch_related`, Rails `includes`, SQLAlchemy `joinedload`/`selectinload`, Hibernate `JOIN FETCH`/`@BatchSize`.
- **Batch with `IN`** — collect parent ids, one query `WHERE child.parent_id IN (...)`.
- **DataLoader** (GraphQL) — coalesces per-field loads in a tick into one batched query, the canonical fix for GraphQL resolvers.

Detect it with query logging, an APM trace (you'll see a fan of identical queries), or tools like `pg_stat_statements`. N+1 is invisible in dev with 5 rows and catastrophic in prod with 5,000.

---

## 4. Replication & read scaling

- **Primary/replica (leader/follower)** — writes go to the primary; replicas stream the WAL (Write-Ahead Log)/binlog and serve reads. Scales **reads**, provides failover.
- **Replication lag** — replicas are slightly behind. Reading your own write from a replica may return stale data (**read-after-write** inconsistency). Mitigate: route the user's reads to the primary briefly after a write, or use causal/"read-your-writes" routing.
- **Synchronous vs asynchronous replication** — sync guarantees the replica has the data before commit ack (durability across nodes, higher latency); async is faster but can lose recent commits on primary failure.
- **Failover** — promoting a replica on primary loss; needs automation (Patroni, RDS multi-AZ) and care to avoid split-brain (two primaries).
- **Logical vs physical replication** — physical ships WAL bytes (whole cluster); logical ships row-level changes (selective, cross-version, powers CDC).

---

## 5. Partitioning & sharding

- **Partitioning** — split one large table into partitions (by range/time, list, or hash) within one DB. Benefits: smaller indexes per partition, **partition pruning** (queries touch only relevant partitions), and O(1) retention (`DROP` an old partition instead of deleting billions of rows). Classic for time-series/audit logs.
- **Sharding** — split data across multiple DB nodes by a **shard key**. Scales writes/storage horizontally. Hard parts: choosing a shard key that distributes evenly and matches query patterns, **cross-shard queries/joins/transactions** (avoid or do at the app layer), **rebalancing** when adding shards, and **hot shards** from skew.
- Choose the partition/shard key to align with the dominant query so most queries hit one partition/shard.
- ShopFast's canonical rule: **shard only when write/storage outgrows one primary**. At launch scale, partitioning within one Postgres instance is sufficient.

---

## 6. Backups, restore & DR (Disaster Recovery)

- **Backups are worthless until you've tested a restore.** "Untested backup = no backup."
- **Logical backup** (`pg_dump`) — portable, slow to restore, fine for small DBs.
- **Physical backup + WAL archiving** — base backup plus continuous WAL → **PITR (Point-In-Time Recovery)** to any moment (e.g., just before a bad `DELETE`).
- **RPO (Recovery Point Objective)** — how much data you can afford to lose (drives backup/WAL frequency). **RTO (Recovery Time Objective)** — how fast you must be back (drives restore strategy/standbys).
- Practice restores (DR drills); automate; store backups off-host/off-region; encrypt.

---

## 7. Maintenance & health

- **VACUUM / autovacuum (Postgres)** — reclaims dead tuples from MVCC (Multi-Version Concurrency Control), updates statistics, prevents transaction-ID wraparound. Tune it; monitor dead-tuple ratio. (MySQL/InnoDB: purge thread + undo logs.)
- **ANALYZE** — refresh planner statistics (esp. after bulk loads/migrations).
- **Index maintenance** — drop unused indexes; rebuild bloated ones (`REINDEX CONCURRENTLY`, `pg_repack`).
- **Monitoring**: connection count, replication lag, slow-query log / `pg_stat_statements`, cache hit ratio, lock waits, disk/IOPS, oldest open transaction, autovacuum activity.
- **Slow-query workflow**: find via `pg_stat_statements` → `EXPLAIN ANALYZE` → fix (index/rewrite/stats) → verify.

---

## 8. Common pitfalls & misconceptions

- **Deploying schema + dependent code together** → old pods break or new pods 500. Use expand–contract.
- **`CREATE INDEX` without `CONCURRENTLY`** on a hot table → write outage.
- **Unbounded backfill** (`UPDATE` 100M rows in one statement) → long lock, replica lag, bloat. Batch it.
- **No `lock_timeout` on migrations** → one migration stuck behind a long query stalls the whole table.
- **Oversized connection pools** → DB thrashing; remember per-connection cost and `max_connections`.
- **Transaction-pooling mode + session features** (prepared statements/`SET`) → subtle breakage.
- **N+1 unnoticed** until production scale.
- **Reading-your-own-write from a lagging replica** → "I just saved it but it's gone."
- **Backups never test-restored** → discovered useless during a real incident.
- **Long/idle-in-transaction connections** → blocked vacuum, bloat (see Transactions tier).

---

## 9. What interviewers probe

- "How do you add a `NOT NULL` column to a 500M-row table with zero downtime?" → expand (nullable) → batched backfill → `NOT NULL` via `NOT VALID`+`VALIDATE`; index `CONCURRENTLY`; `lock_timeout`.
- "Walk me through expand–contract / a zero-downtime rename."
- "What is the N+1 problem and how do you fix it?"
- "How do you size a connection pool? What is PgBouncer transaction pooling and what does it break?"
- "Read replica is lagging and users see stale data — what do you do?"
- "How do you do a safe, reversible migration? What's your rollback plan?"
- "Partitioning vs sharding — when each?"
- "How do you diagnose a sudden slowdown in production?" (connections, locks, slow queries, replica lag, autovacuum).

---

## 10. Quick-reference summary

- **Migrations**: expand → backfill (batched) → contract; additive first; never ship schema + dependent code together; `CREATE INDEX CONCURRENTLY`; constraints `NOT VALID` then `VALIDATE`; set `lock_timeout`; always have a rollback plan; test on prod-sized data.
- **Pooling**: reuse connections; external pooler (PgBouncer/RDS Proxy) for high fan-out; transaction pooling multiplexes hard but breaks session features; size by cores, not worker count; fleet sum < `max_connections`.
- **N+1**: 1 + N queries from per-parent lazy loads; fix with eager load/JOIN, `IN`-batching, or DataLoader; detect via query logs/APM.
- **Replication**: primary takes writes, replicas scale reads; beware replication lag → read-your-writes; sync vs async durability; safe failover.
- **Partition vs shard**: partition = split a table within one DB (pruning, O(1) retention); shard = split across nodes by key (write scale; cross-shard is hard; watch hot shards). ShopFast: shard only when one primary is outgrown.
- **Backups/DR**: test restores; PITR via WAL; know your RPO/RTO.
- **Maintenance**: vacuum/analyze, drop unused indexes, monitor lag/locks/slow queries/oldest txn; diagnose with `pg_stat_statements` + `EXPLAIN ANALYZE`.
