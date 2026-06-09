# DB Operations — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Migrations, zero-downtime, pooling, N+1.

Senior study notes on running databases in production: schema migrations without downtime, connection pooling, the N+1 problem, replication, partitioning, backups, and the operational hazards that show up at 3am. This is the "keeps the lights on" tier.

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
- **External pooler** (PgBouncer, ProxySQL, RDS Proxy) — sits between app and DB, multiplexes thousands of client connections onto a small set of server connections.
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

- **Primary/replica (leader/follower)** — writes go to the primary; replicas stream the WAL/binlog and serve reads. Scales **reads**, provides failover.
- **Replication lag** — replicas are slightly behind. Reading your own write from a replica may return stale data (**read-after-write** inconsistency). Mitigate: route the user's reads to the primary briefly after a write, or use causal/"read-your-writes" routing.
- **Synchronous vs asynchronous replication** — sync guarantees the replica has the data before commit ack (durability across nodes, higher latency); async is faster but can lose recent commits on primary failure.
- **Failover** — promoting a replica on primary loss; needs automation (Patroni, RDS multi-AZ) and care to avoid split-brain (two primaries).
- **Logical vs physical replication** — physical ships WAL bytes (whole cluster); logical ships row-level changes (selective, cross-version, powers CDC).

---

## 5. Partitioning & sharding

- **Partitioning** — split one large table into partitions (by range/time, list, or hash) within one DB. Benefits: smaller indexes per partition, **partition pruning** (queries touch only relevant partitions), and O(1) retention (`DROP` an old partition instead of deleting billions of rows). Classic for time-series/audit logs.
- **Sharding** — split data across multiple DB nodes by a **shard key**. Scales writes/storage horizontally. Hard parts: choosing a shard key that distributes evenly and matches query patterns, **cross-shard queries/joins/transactions** (avoid or do at the app layer), **rebalancing** when adding shards, and **hot shards** from skew.
- Choose the partition/shard key to align with the dominant query so most queries hit one partition/shard.

---

## 6. Backups, restore & DR

- **Backups are worthless until you've tested a restore.** "Untested backup = no backup."
- **Logical backup** (`pg_dump`) — portable, slow to restore, fine for small DBs.
- **Physical backup + WAL archiving** — base backup plus continuous WAL → **Point-In-Time Recovery (PITR)** to any moment (e.g., just before a bad `DELETE`).
- **RPO** (Recovery Point Objective) — how much data you can afford to lose (drives backup/WAL frequency). **RTO** (Recovery Time Objective) — how fast you must be back (drives restore strategy/standbys).
- Practice restores (DR drills); automate; store backups off-host/off-region; encrypt.

---

## 7. Maintenance & health

- **VACUUM / autovacuum (Postgres)** — reclaims dead tuples from MVCC, updates statistics, prevents transaction-ID wraparound. Tune it; monitor dead-tuple ratio. (MySQL/InnoDB: purge thread + undo logs.)
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
- **Partition vs shard**: partition = split a table within one DB (pruning, O(1) retention); shard = split across nodes by key (write scale; cross-shard is hard; watch hot shards).
- **Backups/DR**: test restores; PITR via WAL; know your RPO/RTO.
- **Maintenance**: vacuum/analyze, drop unused indexes, monitor lag/locks/slow queries/oldest txn; diagnose with `pg_stat_statements` + `EXPLAIN ANALYZE`.
