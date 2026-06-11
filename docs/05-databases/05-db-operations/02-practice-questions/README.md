# DB Operations — Practice Questions

[← Topic overview](../README.md)

> Topic: Migrations, zero-downtime, pooling, N+1.

Recall, teaching, and MCQ. Answer before expanding.

---

### Q1. What is the expand–contract (parallel-change) migration pattern?

**Answer:** A three-phase approach to schema change without downtime: **Expand** — make an additive, backward-compatible change (add nullable column / new table / index `CONCURRENTLY`) that old code ignores and new code can use; **Migrate** — backfill the new structure in batches and dual-write from app code if needed so both shapes stay consistent; **Contract** — once all running code uses the new shape and you've verified, remove the old column/table/constraint. The key invariant: old and new application versions must both work against every intermediate schema, so you never deploy a schema change and the code that requires it at the same instant.

---

### Q2. How do you add a `NOT NULL` column to a huge live table with zero downtime?

**Answer:** Don't add `NOT NULL` with a default directly (can rewrite/lock the table). Instead: (1) add the column **nullable** (instant metadata change); (2) **backfill** the value in bounded batches with brief pauses to avoid lock pile-ups and replica lag; (3) once fully populated and the app writes the column on every insert, add the `NOT NULL` constraint — in Postgres add a `CHECK (col IS NOT NULL) NOT VALID` then `VALIDATE CONSTRAINT` (cheap lock), or set `NOT NULL` after backfill. Set a short `lock_timeout` so the DDL fails fast rather than stalling the table behind a long query.

---

### Q3. Explain the N+1 query problem to a junior and how to fix it.

**Answer:** Say you list 100 blog posts and, for each, show the author's name. A naive ORM runs **1** query to get the posts, then **1 more query per post** to fetch its author — 101 queries (the "+ N"). In dev with 3 posts you never notice; in prod with thousands it hammers the DB. Fix by loading the related data **together**: a single `JOIN`, or collect the author ids and run one `WHERE author_id IN (...)` query, or use the ORM's eager-loading (`select_related`/`includes`/`JOIN FETCH`) — turning 1+N queries into 1 or 2. In GraphQL, use DataLoader to batch per-field loads.

---

### Q4. Why isn't a bigger connection pool always better?

**Answer:** Each DB connection costs memory (Postgres forks a process per connection) and a server with N CPU cores can only truly execute ~N CPU-bound queries at once. Past that, extra active connections just contend for CPU, locks, and I/O, increasing context-switching and latency — throughput goes *down* (a thundering herd). Also, the total connections from all app servers' pools must stay under the DB's `max_connections`. So you size the pool to a small multiple of cores and use an external pooler (PgBouncer/RDS Proxy) to multiplex many clients onto few server connections, rather than growing the pool to match worker count.

---

### Q5. What does PgBouncer's "transaction pooling" mode break, and why use it anyway?

**Answer:** In transaction pooling a server connection is handed to a client only for the duration of a single transaction, then returned to the pool. This breaks anything that relies on **session state spanning transactions**: server-side prepared statements reused across calls, `SET`/session variables, session-level advisory locks, `LISTEN/NOTIFY`, and temp tables. You use it anyway because it gives enormous multiplexing — thousands of client connections mapped onto a few dozen server connections — which is essential for high-concurrency and serverless workloads where session pooling can't multiplex enough.

---

### Q6. A read replica is lagging and a user reports "I saved it but it disappeared." What's happening and how do you fix it?

**Answer:** That's **read-after-write inconsistency** from replication lag: the write went to the primary, but the user's subsequent read was routed to a replica that hadn't yet applied that change. Fixes: route a user's reads to the **primary** for a short window after they write (sticky/read-your-writes routing), use the replica's applied-LSN to only read from a replica that's caught up to the write, or keep that particular read on the primary. Long-term, monitor and bound replication lag and shed read traffic if a replica falls too far behind.

---

### Q7. Why use `CREATE INDEX CONCURRENTLY`, and what's the catch?

**Answer:** A plain `CREATE INDEX` takes a lock that blocks writes (and is `ACCESS EXCLUSIVE`-ish) for the whole build — on a large hot table that's an outage. `CREATE INDEX CONCURRENTLY` builds the index without blocking writes by scanning the table in two passes. Catches: it's slower, can't run inside a transaction block, and if it **fails partway it leaves an invalid index** that must be dropped and retried. In MySQL the analogous tools are online DDL / `gh-ost` / `pt-online-schema-change`.

---

### Q8 (MCQ). Which migration step is safe to deploy *before* the new application code in expand–contract?

- A. `DROP COLUMN old_field`
- B. `ADD COLUMN new_field` (nullable)
- C. `ALTER COLUMN ... SET NOT NULL`
- D. Renaming a column in place

**Answer: B.** Adding a nullable column is additive and backward-compatible — old code ignores it. Dropping (A) or in-place renaming (D) breaks old code still referencing the old shape; `SET NOT NULL` (C) belongs after backfill and after all writers populate it. Destructive steps happen in the *contract* phase, after the new code is fully live.

---

### Q9 (MCQ). The best tool to spot an N+1 problem in production is:

- A. Counting rows in the table
- B. An APM/trace or query log showing a fan of near-identical queries per request
- C. Increasing the connection pool
- D. Adding more replicas

**Answer: B.** N+1 shows up as many repeated, structurally identical queries within one request — visible in an APM trace, slow-query log, or `pg_stat_statements` (one query template with a huge call count). The other options mask or worsen it without diagnosing it.

---

### Q10 (MCQ). Range-partitioning an audit table by month primarily helps because:

- A. It makes individual rows smaller
- B. Old data can be removed by dropping a partition (O(1)) and queries prune to relevant partitions
- C. It guarantees stronger consistency
- D. It eliminates the need for indexes

**Answer: B.** Time-range partitioning lets you `DROP` an entire old partition for retention instead of deleting billions of rows, and the planner **prunes** to only the partitions a date-filtered query needs (smaller indexes scanned). It doesn't shrink rows, change consistency, or remove the need for indexes.

---

### Q11. Difference between partitioning and sharding?

**Answer:** **Partitioning** splits one large table into sub-tables (partitions) **within a single database** — improving manageability (per-partition indexes, partition pruning, drop-partition retention) but not adding compute/storage beyond that node. **Sharding** splits data across **multiple database nodes** by a shard key, scaling writes, storage, and compute horizontally — at the cost of hard cross-shard joins/transactions, rebalancing, and hot-shard risk. Partitioning is a single-node organization technique; sharding is a multi-node scaling technique (and they compose: each shard can be partitioned).

---

### Q12. What's the difference between RPO and RTO, and why do they matter for backups?

**Answer:** **RPO (Recovery Point Objective)** is the maximum acceptable *data loss* — "we can lose at most 5 minutes of writes" — which dictates how frequently you back up / how continuously you archive WAL. **RTO (Recovery Time Objective)** is the maximum acceptable *downtime* to recover — "we must be back within 1 hour" — which dictates your restore strategy (hot standby vs restoring from a dump). They matter because they turn "we have backups" into concrete, testable requirements: a nightly dump gives ~24h RPO and a slow RTO; continuous WAL archiving with a warm standby gives near-zero RPO and minutes of RTO. And both are meaningless unless you've actually **test-restored**.
