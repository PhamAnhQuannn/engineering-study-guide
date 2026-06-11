# Migration Scenarios — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Big rewrites, data migration, zero downtime.

> **🛒 Where we are in building ShopFast** — In [Tech Debt Calls](../../03-tech-debt-calls/01-knowledge/README.md) we decided to pay down the catalog-orders coupling that was taxing our checkout velocity. The cheapest fix — wrapping the direct SQL queries behind the `CatalogApi` interface — is done. But the bigger prize is extracting the `catalog` module into its own service, with its own database, so catalog reads can scale independently. That means a **live migration of a production database table, with zero downtime, while orders keep flowing.** **Next:** The migration plan will surface a disagreement between the catalog engineer and the platform team about scope and ownership — we tackle that in [Conflict & Ownership](../../05-conflict-ownership/01-knowledge/README.md).

---

## Teaching arc: extracting the catalog service without downtime

### What it is & why it matters

Migrations — moving from one schema, datastore, service, or platform to another — are where senior engineers most visibly prove they can manage risk. The defining constraints are that the system usually must stay **live** during the move, the data must end up **correct and consistent**, and the change must be **reversible** until it's proven. The hallmark of a good migration is that it's *boring*: incremental, reversible, observable, and dual-running long enough to verify before cutover. Big-bang flag-day migrations are the anti-pattern.

Why this matters in interviews: this is the topic where strong candidates demonstrate operational maturity and systems thinking simultaneously. Most interviewers at staff-level companies consider this a must-pass area.

---

### A ShopFast situation: zero-downtime catalog-service extraction

**Context.** ShopFast's `catalog` module currently lives inside the modular monolith and shares the main Postgres database. The module is self-contained (all catalog queries go through the `CatalogApi` interface — the seam we fixed in the debt-calls chapter). The plan: extract catalog into its own service with its own Postgres instance. This lets catalog reads scale separately (catalog is read-heavy: ~50:1 read:write ratio), keeps catalog availability issues from blocking checkout, and reduces coupling.

The data to migrate: ~8 million product rows in the `catalog.products` table, with associated rows in `catalog.categories` and `catalog.product_images`. Total: ~12 GB. ShopFast cannot afford a maintenance window — the site must stay live throughout.

**Timeline**

**Week 1 — Phase 1: Expand (additive only, no breakage)**

The first deploy adds the new Catalog Service codebase alongside the monolith. It provisions a new, empty Postgres instance. The monolith continues to handle all reads and writes to the shared DB. No traffic is routed to the new service yet.

Also in this deploy: the monolith's order module is already using the `CatalogApi` interface — so no order-module changes are needed. This is exactly why we paid down DEBT-21 first.

**Week 1 — Backfill: copying 12 GB without melting production**

The team writes a one-time backfill script: reads `catalog.products` in batches of 500 rows, writes each batch to the new Catalog DB, sleeps for 50ms between batches (throttling). The script is **idempotent** — each row is upserted by product ID, so if it crashes and restarts at row 2.3M, it won't duplicate data. It is also **resumable** — it stores a checkpoint (last processed `product_id`) in a small state table.

The backfill runs over ~3 hours without affecting production latency (monitored: checkout p99 latency stays flat throughout).

**Week 2 — Phase 2: Dual-write**

A new deploy modifies the monolith's catalog write path: every product create/update/delete writes to *both* the old shared Postgres **and** the new Catalog DB. The write to the new DB is in a `try/catch` — a failure logs and alerts but does not fail the primary write. This is intentional: the new DB is not yet the source of truth, so failing a write there should not break a customer's product update.

Monitoring added: a Datadog metric `catalog.dual_write.divergence_count` tracks rows that failed to write to the new DB. It is zero for 3 days running.

**Week 2 — Dual-read (shadow read) for verification**

Another deploy adds a shadow read path: for ~10% of catalog read requests, the monolith reads from *both* the old DB and the new Catalog Service, compares the results, and logs any discrepancy. The response served to the customer is still from the old DB. No customer impact.

After 72 hours: 0 discrepancies on 2.1M shadow reads. The new Catalog DB is consistent.

**Week 3 — Phase 3: Canary cutover (reads)**

The team flips a feature flag to route 1% of catalog read traffic to the new Catalog Service. Watches for 2 hours: error rate, latency p50/p99, and cache hit rate (catalog uses Redis cache-aside). All nominal. Ramps to 10%, then 50%, then 100% over 48 hours. At each step: 30-minute soak, then proceed.

At 100% reads: the old DB's catalog read replicas see traffic drop to near zero. The monolith's `CatalogApi` interface now hits the new Catalog Service over gRPC internally.

**Week 4 — Cutover writes, then contract**

Write cutover: the new Catalog Service becomes the primary write destination. The monolith now sends all catalog writes to the Catalog Service via gRPC, and the Catalog Service writes to its own Postgres. The old shared DB's catalog tables become read-only.

A 1-week soak period follows. Dual-write to the old DB continues (still writing to the old tables in background, not on the critical path) so the team can roll back instantly by re-pointing traffic if a rare edge case surfaces.

After the soak: the dual-write to the old tables is disabled. The old `catalog.*` tables are renamed `catalog_deprecated.*` (not dropped yet). After another 2 weeks with no rollback: `catalog_deprecated.*` is dropped and the schema is contracted.

**Total migration duration: ~5 weeks. Zero downtime. Zero customer-visible errors. Rollback was available at every phase.**

**What the RCA (Root Cause Analysis) on one near-miss showed:** During the canary read cutover at 50%, the team noticed a 0.3% discrepancy rate in product prices for products with active time-based promotions. Root cause: the backfill had run before the promotion service wrote promotional prices, and dual-write wasn't capturing promotion-price updates (which went through a different code path). Fix: add dual-write to the promotion-price update path, re-verify with shadow reads, then continue the cutover. This is exactly why the canary + shadow read phase exists — it caught the discrepancy before it became a customer-visible pricing error.

---

### How to handle it

**The expand → migrate → contract backbone.** Almost every safe online migration follows three phases:

1. **Expand** — add the new thing *alongside* the old, backward-compatible (new column/table/service), without removing or breaking anything. Old code still works.
2. **Migrate** — dual-write to old and new, backfill historical data, shift reads from old to new gradually (behind a flag, with dual-reads + comparison).
3. **Contract** — once the new path is proven and nothing reads the old path, remove the old column/table/code.

Each phase is independently deployable and reversible. The system is always in a consistent, working state between phases.

**Backfill rules.** Backfills will fail partway. Design for re-running: idempotent (upsert by primary key, not blind insert), resumable (checkpoint state), throttled (sleep between batches, watch prod latency). Never run an un-throttled bulk copy on a live production database.

**Verification before trust.** Dual-read + reconcile. Checksum/row-count both stores. Sample-compare records. Do not cut over on faith. The promotion-price discrepancy above is a real class of failure — silent data drift that only surfaces on edge cases.

**Online (non-locking) DDL (Data Definition Language).** A naive `ALTER TABLE` can take a long write lock on a big table and cause an outage. Use online-DDL tooling (e.g., `pt-online-schema-change`, `gh-ost`, or Postgres native online DDL). Build indexes **concurrently** (`CREATE INDEX CONCURRENTLY` in Postgres). Add `NOT NULL` columns in steps: add nullable → backfill → add constraint.

**Gradual cutover.** Canary the read switch (1% → 10% → 50% → 100%) behind a feature flag. Watch error rate, latency, consistency metrics at each step. Soak for 30 minutes to hours at each step before proceeding. Contract last, after a soak period where rollback is still possible.

---

### What good looks like

- You plan the rollback *before* step one. At every phase of the migration above, there is an instant rollback path.
- You never combine an additive and a destructive change in one deploy (you renamed tables to `_deprecated` before dropping them, weeks later).
- Your backfill is idempotent, resumable, and throttled — you designed for failure, not the happy path.
- Shadow reads caught the promotion-price discrepancy before it became a customer-visible error.
- You use a canary percentage ramp, not a hard cutover.
- You contract (drop old tables) only after a multi-week soak with no incidents.
- The migration is boring — incremental, observable, reversible. No heroics.

---

### Pitfalls

- **No rollback plan.** The single most common migration failure — you commit before verifying and can't go back.
- **Combining additive + destructive in one deploy.** Dropping the old column in the same release that adds the new one — breaks rolling deploys and rollback.
- **Locking DDL (Data Definition Language) on a big table.** A naive `ALTER`/`CREATE INDEX` that takes a write lock and causes a write outage.
- **Backfill that overloads prod.** Un-throttled bulk copy that saturates the DB and causes a latency incident — or that isn't resumable and has to restart from zero.
- **Trusting the new store without reconciliation.** Cutting over without comparing old vs. new and discovering silent data corruption later.
- **Dual-write divergence.** A write succeeds to one store and fails to the other, and nobody notices — the stores silently drift.
- **Forgetting old/new code coexist.** Code that assumes only the new format, breaking instances still running old code during the rollout.
- **Big-bang rewrite.** Replacing a whole system at once with no incremental fallback — long no-value period, high overrun, often re-creates the old problems.
- **Contracting too early.** Removing the old path before the soak proves the new one, leaving no rollback if a rare bug surfaces.

---

## Core concepts

### The expand–migrate–contract pattern (the backbone of zero-downtime change)
Almost every safe online migration follows three phases:

1. **Expand** — add the new thing *alongside* the old, in a backward-compatible way (new column/table/field/service), without removing or breaking anything. Old code still works.
2. **Migrate** — **dual-write** to old and new, **backfill** historical data, and shift reads from old to new gradually (often behind a flag, with **dual-reads + comparison** to verify equivalence).
3. **Contract** — once the new path is proven and nothing reads the old path, remove the old column/table/code.

Each phase is independently deployable and reversible. The system is always in a consistent, working state between phases. This is why you *never* do "drop the old column in the same deploy that adds the new one" — it's not reversible and breaks any old instance still running.

### Dual-write, backfill, dual-read, cutover
- **Dual-write** — write to both old and new stores so the new store stays current while you migrate. Handle write failures carefully (a failed write to one store must not silently diverge them).
- **Backfill** — copy existing historical data into the new store, in batches, throttled to avoid overloading prod. Make it idempotent and resumable.
- **Dual-read / shadow read** — read from both, serve the old, and *compare* the new result to catch discrepancies before you trust it.
- **Cutover** — flip reads (then writes) to the new store, gradually (canary %), with an instant rollback path.

### Online (non-locking) schema changes
A naive `ALTER TABLE` can take a long lock on a big table and cause a write outage. Senior migrations avoid this:
- Use online-DDL (Data Definition Language) tooling (e.g., `pt-online-schema-change`, `gh-ost`, or the DB's native online DDL) that builds the change on a shadow copy and swaps it in.
- Adding a `NOT NULL` column with a default on a huge table, or adding a constraint, can lock — do it in steps: add nullable → backfill in batches → add constraint with validation deferred.
- Build indexes **concurrently** (e.g., Postgres `CREATE INDEX CONCURRENTLY`) so writes aren't blocked.

### Backward & forward compatibility
During a migration, old and new code (and old and new data formats) coexist. Both must tolerate each other:
- New code must read old-format data; old code must not choke on new fields it doesn't understand (tolerant reader).
- This is what makes rolling deploys and instant rollback safe — at every moment, whatever mix of versions is live, the system works.

### Strangler fig (for service/system rewrites)
For replacing a whole service or monolith, route requests through a façade that sends a growing slice of traffic to the new implementation while the old one handles the rest. Migrate capability by capability, compare outputs, and retire the legacy paths once proven. Incremental, reversible, value-delivering — the opposite of a big-bang rewrite.

---

## How to run a migration safely

1. **Plan the rollback first.** Before step one, know exactly how to undo each phase. A migration without a reverse plan is a gamble.
2. **Make it reversible at every phase.** Never combine an additive and a destructive change in one irreversible deploy.
3. **Idempotent, resumable, throttled backfills.** They will fail partway; design for re-running without double-applying and without melting prod.
4. **Verify before you trust.** Dual-read + reconcile; checksum/row-count both stores; sample-compare records. Don't cut over on faith.
5. **Cut over gradually.** Canary the read switch (1% → 10% → 100%) behind a flag; watch error/latency/consistency metrics at each step.
6. **Observe everything.** Per-phase dashboards: discrepancy counts, backfill progress, lag between stores, error rates.
7. **Contract last, and only after a soak period** during which you could still roll back.

---

## Key terms & definitions

- **Expand/contract (parallel change)** — add-new-then-remove-old pattern enabling backward-compatible, reversible migrations.
- **Dual-write / dual-read** — write to / read from both old and new during transition.
- **Backfill** — bulk-copy of historical data into the new store.
- **Shadow / dark read** — read the new path without serving it, to compare.
- **Cutover** — the moment serving switches from old to new.
- **Online DDL (Data Definition Language)** — schema change without long table locks.
- **Strangler fig** — incremental replacement of a system via a routing façade.
- **Reconciliation** — comparing old vs. new to prove equivalence (row counts, checksums, sampled diffs).
- **Flag day / big-bang** — a single hard cutover with no incremental path (the anti-pattern).
- **Two-way door** — a reversible decision; migrations should preserve reversibility as long as possible.
- **CDC (Change Data Capture)** — streaming database changes to replicate them elsewhere; an alternative to dual-write that avoids divergence at the cost of replication lag.

---

## Tradeoffs

- **Big-bang vs. incremental.** Big-bang (flag-day) is simpler to *plan* and avoids the complexity of dual-running, but has no safe rollback and a single catastrophic failure mode. Incremental costs more engineering (dual paths, reconciliation) but is reversible and low-risk. For anything live or important, incremental wins.
- **Downtime window vs. zero-downtime.** A short maintenance window is dramatically simpler and sometimes fine (internal tools, off-peak, small data). True zero-downtime is much harder (dual-write consistency, online DDL) and only worth it when downtime is genuinely unacceptable.
- **Dual-write consistency vs. complexity.** Keeping two stores consistent during writes is hard (partial failures, ordering). Alternatives: write to one and use **CDC (Change Data Capture)** to replicate to the other, which avoids dual-write divergence at the cost of replication lag.
- **Speed of cutover vs. soak time.** Cutting over fast frees you from maintaining two systems sooner; a longer soak (with rollback still possible) catches rare discrepancies. Don't contract too early.

---

## Common pitfalls & misconceptions

- **No rollback plan.** The single most common migration failure: you commit before verifying and can't go back.
- **Combining additive + destructive in one deploy.** Dropping the old column in the same release that adds the new one — breaks rolling deploys and rollback.
- **Locking DDL on a big table.** A naive `ALTER`/`CREATE INDEX` that takes a write lock and causes an outage.
- **Backfill that overloads prod.** Un-throttled bulk copy that saturates the DB and causes a latency incident — or that isn't resumable and has to restart from zero.
- **Trusting the new store without reconciliation.** Cutting over without comparing old vs. new and discovering silent data corruption later.
- **Dual-write divergence.** A write succeeds to one store and fails to the other, and nobody notices — the stores silently drift.
- **Forgetting old/new code coexist.** Code that assumes only the new format, breaking the instances still running old code during the rollout.
- **Big-bang rewrite.** Replacing a whole system at once with no incremental fallback — long no-value period, high overrun, often re-creates the old problems.
- **Contracting too early.** Removing the old path before the soak proves the new one, leaving no rollback if a rare bug surfaces.

---

## What interviewers probe

- **Do you keep it reversible?** Expand/contract, rollback at every phase, never additive+destructive together.
- **Zero-downtime mechanics.** Can you describe dual-write/backfill/dual-read/cutover and the consistency pitfalls?
- **Online DDL awareness.** Do you know a naive `ALTER` can lock, and how to avoid it (batching, concurrent index, online-DDL tools)?
- **Verification.** Do you reconcile (row counts, checksums, sampled diffs) before trusting the new store?
- **Operational safety.** Throttled, idempotent, resumable backfills; gradual canary cutover; per-phase observability.
- **Judgment on big-bang vs. incremental and downtime vs. zero-downtime** — and *when each is acceptable*.
- **Rollback discipline.** Do you plan the undo before you start?

---

## Quick-reference summary

1. **Expand → migrate → contract.** Add new alongside old, dual-write + backfill + shift reads, then remove old — each phase reversible.
2. **Never combine additive and destructive changes in one deploy.** Drop the old column only after the new path is proven.
3. **Old and new code/data coexist during rollout** — both directions must be compatible (tolerant readers).
4. **Backfills must be idempotent, resumable, and throttled.** They will fail partway; don't melt prod.
5. **Verify before you trust:** dual-read + reconcile (row counts, checksums, sampled diffs) before cutover.
6. **Cut over gradually** (canary %) behind a flag, with an instant rollback path.
7. **Avoid locking DDL** — batch changes, build indexes concurrently, use online-DDL tooling on large tables.
8. **Plan the rollback before step one;** contract last, after a soak period.
9. **For system rewrites, use the strangler fig**, not a big-bang rewrite.
10. **A maintenance window is a legitimate, simpler option** when brief downtime is acceptable — don't over-engineer zero-downtime when you don't need it.
