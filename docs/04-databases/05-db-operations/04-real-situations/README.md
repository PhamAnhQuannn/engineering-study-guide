# DB Operations — Real-World Situations

[← Topic overview](../README.md)

> Topic: Migrations, zero-downtime, pooling, N+1.

On-the-job scenarios. Each follows: **Model/approach → Mitigate → Diagnose with data → Communicate → Root-cause fix → Prevention.**

---

## S1. A migration locked the table and took down the site

**Scenario:** A deploy ran `CREATE INDEX` (non-concurrent) / `ALTER TABLE ADD COLUMN NOT NULL DEFAULT ...` on a 300M-row table. Writes to that table hung; the app started timing out; the site went down.

**Mitigate:** **Cancel the migration** (`pg_cancel_backend`/`pg_terminate_backend` on the DDL pid) to release the `ACCESS EXCLUSIVE` lock so queued queries drain. Confirm the site recovers.

**Diagnose with data:** `pg_stat_activity` shows the DDL holding the lock and a long queue of blocked queries (`wait_event = Lock`); `pg_locks` shows the table lock. The DDL took a heavy lock and/or rewrote the table.

**Communicate:** Tell stakeholders it was a locking migration, not data loss; service is restored; the schema change will be re-applied safely. Post a brief incident note.

**Root-cause fix:** Re-run the change the **online** way: `CREATE INDEX CONCURRENTLY`; for the column, add it **nullable** → **batched backfill** → `NOT NULL` via `NOT VALID` + `VALIDATE`. Set a short `lock_timeout` so the DDL fails fast instead of stalling the table behind a long query.

**Prevention:** A migration-safety review gate (flag `CREATE INDEX` without `CONCURRENTLY`, `NOT NULL`/type changes, missing `lock_timeout`); test migrations on a production-sized copy; require expand–contract for schema changes; never bundle schema + dependent code in one release.

---

## S2. Connection pool exhaustion under a traffic spike

**Scenario:** During a marketing push, the app throws "too many connections" / "pool timeout" errors; the DB CPU is high; requests fail even though queries individually look fine.

**Mitigate:** Shed or throttle non-critical traffic; reduce per-instance pool size if it's oversubscribing the DB; restart leaking app instances. If a pooler exists, lower DB-side server connections to stop thrashing.

**Diagnose with data:** Check active vs idle connections (`pg_stat_activity`), how the fleet's pools sum vs `max_connections`, and whether connections are stuck `idle in transaction` (a leak) or genuinely all busy. High CPU with many active connections = oversubscription (more connections than cores can serve). Many `idle in transaction` = a connection leak.

**Communicate:** Report the cause (connection oversubscription/leak under load), the immediate mitigation, and the durable fix and timeline.

**Root-cause fix:** Right-size the pool (small multiple of DB cores, fleet sum < `max_connections`) and put an **external pooler** (PgBouncer/RDS Proxy) in front to multiplex. Fix any code path leaving connections `idle in transaction` (missing commit/rollback, ORM session not closed). Set `idle_in_transaction_session_timeout`.

**Prevention:** Capacity-plan pool sizing against `max_connections`; add a pooler before scaling out app instances; alert on connection count and `idle in transaction`; load-test at projected peak.

---

## S3. An endpoint is slow only at scale — N+1 in production

**Scenario:** A list endpoint is fast in staging but takes 4s in prod. DB CPU is high; the slow-query log shows thousands of tiny near-identical queries.

**Mitigate:** Add a short-lived cache on the endpoint if acceptable to relieve immediate load; consider lowering page size.

**Diagnose with data:** An APM trace of one request shows 1 query for the list + N queries (one per row) for a relation — the classic **N+1**. `pg_stat_statements` shows one query template with an enormous call count. Staging didn't reproduce it because it had few rows.

**Communicate:** Explain it's an N+1 query pattern that only bites at production data volumes; fix is to batch the loads; no data risk.

**Root-cause fix:** Replace per-row lazy loading with **eager loading** — a JOIN or the ORM's `select_related`/`prefetch_related`/`includes`/`JOIN FETCH` — or batch the relation with a single `WHERE parent_id IN (...)`. In GraphQL, add a DataLoader. Verify the request now issues 1–2 queries.

**Prevention:** Query-count assertions in tests (fail if a request exceeds N queries); seed staging/CI with production-scale data; APM alerts on per-request query counts; code-review awareness of lazy-loaded relations in loops.

---

## S4. Replica lag causing stale reads after a deploy

**Scenario:** After enabling read replicas to offload the primary, users complain that data they just edited "reverts" on the next page load.

**Mitigate:** Temporarily route the affected reads (or all reads for a user right after a write) back to the primary to stop the user-visible inconsistency.

**Diagnose with data:** Measure replication lag (`pg_stat_replication`/replica `pg_last_xact_replay_timestamp`). The "revert" is **read-after-write** inconsistency: the write hit the primary, the immediate read hit a replica that hadn't applied it yet. Correlate complaint timestamps with lag spikes (often during heavy writes/backfills).

**Communicate:** Clarify it's replication lag, not data loss; the edit is safe on the primary; we're adjusting read routing.

**Root-cause fix:** Implement **read-your-writes** routing: send a user's reads to the primary for a short window after they write, or only read from a replica whose applied LSN is past the write's LSN. Keep strongly-consistent reads (e.g., post-edit confirmation) on the primary. Bound and monitor lag; throttle backfills that inflate it.

**Prevention:** Establish a read-routing policy distinguishing "must be fresh" from "lag-tolerant" reads; alert on replication lag thresholds; throttle bulk writes; document which queries are replica-safe.

---

## S5. Disk filling up — table and index bloat / runaway growth

**Scenario:** A DB volume is approaching full. Growth far outpaces actual new data; an outage is imminent if it fills.

**Mitigate:** Buy time — extend the volume if possible, drop/rotate obvious large transient data (old logs, expired partitions), and identify the biggest tables/indexes. Kill any long/idle transaction blocking vacuum.

**Diagnose with data:** Compare live rows vs physical size (bloat); check `pg_stat_user_tables.n_dead_tup`, `pg_stat_activity` for the oldest open transaction, and whether autovacuum is keeping up. Common causes: a long-running transaction pinning dead tuples (blocked vacuum → bloat), a never-purged append-only table, an unbounded `UPDATE` that churned the whole table, or WAL/archive piling up.

**Communicate:** Report the cause (bloat from blocked vacuum / unmanaged growth) and the reclamation plan; flag the deadline before the disk fills.

**Root-cause fix:** Remove the blocker (close the long transaction), let autovacuum/`VACUUM` reclaim space, or run `pg_repack`/`VACUUM FULL` off-peak for severe bloat. For append-only growth, introduce **time partitioning** and drop old partitions for retention. Fix unbounded updates to run in batches.

**Prevention:** Alert on disk usage, dead-tuple ratio, oldest-transaction age, and WAL/archive backlog; tune autovacuum; partition large append-only tables with a retention policy; set `idle_in_transaction_session_timeout` and `statement_timeout`.

---

## S6. A bad `DELETE` wiped production data — recovering with PITR

**Scenario:** A buggy script (missing `WHERE`) deleted a large chunk of a critical table 20 minutes ago. Users are reporting missing data.

**Mitigate:** Stop the offending job and **freeze further writes** to the affected table if feasible (to preserve a clean recovery point and avoid compounding). Communicate a brief maintenance window.

**Diagnose with data:** Determine exactly *what* was deleted and the precise time of the bad statement (from logs/audit). Decide the recovery target: a timestamp just **before** the delete.

**Communicate:** Tell stakeholders the scope (which/how many rows), that backups/PITR exist, the recovery approach, and the ETA + any data written after the delete that may be affected.

**Root-cause fix:** Use **Point-In-Time Recovery**: restore a base backup + replay WAL to the moment just before the bad `DELETE`, into a **scratch instance**, then extract and re-insert the lost rows into prod (merging carefully with any legitimate writes that happened after). If the table is fully isolatable, restore over it. Verify row counts and integrity.

**Prevention:** Require `WHERE` guards / dry-run + row-count confirmation in destructive scripts; least-privilege so ad-hoc scripts can't mass-delete; **regularly test restores** (untested backup = no backup); enable an audit log; consider soft deletes for critical tables. Wrap risky data ops in a transaction reviewed before commit.

---

## S7. Cutting over a column rename with zero downtime (planned change gone right)

**Scenario:** Product wants to rename `users.username` to `users.handle` across a live, high-traffic service. An in-place `ALTER ... RENAME` would break every running pod that still reads `username`.

**Model/approach:** Treat it as **expand–contract**, never an in-place rename.

**Mitigate (proactive):** Plan the change as additive so there's never a moment old code can break.

**Steps (with data checks at each):**
1. **Expand:** add `handle` column; deploy code that **dual-writes** both `username` and `handle` (and reads `username` still).
2. **Backfill:** copy existing `username → handle` in batches; verify counts match.
3. **Flip reads:** deploy code that reads `handle`, still writing both.
4. **Stop writing old:** deploy code that only uses `handle`.
5. **Contract:** after a safety window, drop `username`.

**Communicate:** Share the staged plan and that each step is independently deployable and reversible (rolling back any step leaves a working system).

**Root-cause/outcome:** No downtime, no broken pods, fully reversible until the final drop.

**Prevention (as a pattern):** Standardize expand–contract for all column renames/type changes; gate destructive contract steps behind a verification checklist and a soak period; keep migrations decoupled from the code that depends on them.
