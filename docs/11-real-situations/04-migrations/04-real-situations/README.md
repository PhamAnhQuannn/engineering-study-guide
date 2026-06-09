# Migration Scenarios — Real-World Situations

[← Topic overview](../README.md)

> Topic: Big rewrites, data migration, zero downtime.

On-the-job migration scenarios. For each: **model the approach (phased, reversible plan) → execute/diagnose with data (reconcile, observe) → communicate → handle the failure/root-cause → prevention.** The senior signal: boring, incremental, verified migrations with a rollback at every step — and the composure to abort safely when reconciliation says "don't trust it yet."

---

### S1. The migration that drifted — old and new stores disagree

**Scenario:** Mid-migration, you're dual-writing user data to old (source of truth) and new stores. Reconciliation shows ~0.3% of records differ between the two. Cutover is next week.

- **Approach:** Do **not** cut over with known drift — that ships corruption. Pause the cutover; the drift is a signal the migration isn't safe yet.
- **Diagnose with data:** Sample the diverging records and find the pattern. They share a trait: writes during a brief downstream outage failed to the new store but succeeded to the old one (dual-write partial failure), and there was no repair. The dual-write had no transactional guarantee.
- **Communicate:** Tell stakeholders the cutover slips until drift is ~0, with the reason ("data-integrity risk, here's the repair plan"). Honesty here protects trust far more than hitting a date with corrupt data.
- **Root-cause fix:** Switch from app-level dual-write to CDC-based replication (faithful to the source log, no dual-write race), or add a transactional outbox. Run a reconciliation/repair job to fix the diverged records. Re-verify until diffs reach ~0.
- **Prevention:** Continuous reconciliation as a gate — never cut over while diffs exist. Prefer CDC over dual-write for future migrations; alert on store-to-store drift in real time.

---

### S2. The `ALTER TABLE` that locked prod

**Scenario:** A teammate ran a "quick" `ALTER TABLE orders ADD COLUMN ... NOT NULL DEFAULT ...` on a 2 TB table during business hours. Writes are now blocked; checkout is failing.

- **Mitigate first (it's an incident):** Cancel/kill the running DDL if it's still holding the lock and hasn't committed; that releases writes. Declare a SEV, communicate impact.
- **Diagnose:** The statement forced a full table rewrite under an exclusive lock — a known foot-gun for adding a defaulted/NOT NULL column on a large table in this engine/version.
- **Communicate:** Status update on the write outage; ETA tied to lock release, not to completing the migration.
- **Root-cause fix:** Redo the change the safe way — add the column **nullable** (metadata-only, instant), backfill in throttled batches, then add the constraint with a non-blocking validate step. Use online-DDL tooling (`gh-ost`/`pt-osc`) if needed.
- **Prevention:** A **migration-safety review/CI gate** that flags destructive or locking operations (DROP, NOT NULL, defaulted columns, blocking index builds) before deploy; require a lock-budget assessment and a backfill plan for any change on a large table; run migrations off-peak with a kill switch.

---

### S3. The backfill that caused a latency incident

**Scenario:** Your overnight backfill job for a new store is running, and the primary DB's p99 latency has tripled — the live app is now slow. The backfill is at 20% after 6 hours.

- **Mitigate:** Throttle or pause the backfill immediately — the live system takes priority. Latency should recover once you stop competing for I/O.
- **Diagnose:** The backfill ran a tight loop of large batched reads/writes with no rate limit, saturating I/O and bloating the table with dead tuples. It also wasn't resumable, so a restart would lose progress.
- **Communicate:** Note that the migration timeline extends because the backfill must run gentler; reassure stakeholders the live system is recovered.
- **Root-cause fix:** Re-implement the backfill as throttled (rate-limited, small batches by PK range), **idempotent** (`WHERE new_col IS NULL`), and **resumable** (checkpoint progress), yielding to prod traffic. Schedule heavy batches off-peak. Run `VACUUM` to reclaim bloat.
- **Prevention:** Backfill jobs must be throttled, idempotent, and resumable by standard; load-test the backfill against a prod-sized replica first; monitor DB saturation and auto-pause the backfill if prod latency breaches an SLO.

---

### S4. The cutover that surfaced a rare bug

**Scenario:** You flipped reads to the new service at 100% in one go. Most traffic is fine, but a specific (rare) query pattern returns wrong results, and a few customers report bad data.

- **Mitigate:** Roll back the read switch via the flag — instantly point reads back at the old, proven store. Because you kept the old path, this is a one-flag rollback. Impact stops.
- **Diagnose:** The new store handled the common case but mishandled an edge query (e.g., a filter that relied on a behavior of the old store's indexing/collation). It only showed under real traffic, not in reconciliation samples that didn't include that pattern.
- **Communicate:** Notify affected customers, confirm data wasn't corrupted (reads were wrong, not writes — verify), and explain the rollback.
- **Root-cause fix:** Fix the edge-case handling in the new store, add that pattern to the reconciliation/test set, then re-attempt cutover **gradually** (canary 1% → 100%) this time.
- **Prevention:** Always canary the read cutover behind a flag; expand reconciliation to cover edge/long-tail query patterns, not just the common case; keep the old path through a soak so rollback stays cheap.

---

### S5. The stalled rewrite (strangler that's stuck at 60%)

**Scenario:** A strangler-fig migration off the monolith stalled a year ago at ~60%. The team now maintains *two* systems indefinitely, paying double the operational cost, and morale is low.

- **Approach:** This is a classic migration failure mode — losing momentum leaves you in the worst state (both systems, none of the benefits). Treat finishing it as a first-class project, not background work.
- **Diagnose with data:** Identify the remaining 40% — which capabilities, why they stalled (hard data coupling? a risky capability everyone avoided? deprioritized for features?). Quantify the cost of running both systems (infra, on-call, slowed changes) to justify finishing.
- **Communicate:** Make the "double-cost limbo" visible to leadership in money/velocity terms; get the migration's completion funded and time-boxed rather than perpetually deprioritized.
- **Root-cause fix:** Re-plan the remaining capabilities into a sequenced, milestone-driven finish; tackle the hardest data-coupling pieces deliberately (expand/contract per capability) rather than leaving them forever.
- **Prevention:** For future migrations, treat them as committed projects with an explicit end date and a "no perpetual dual-running" rule; track migration progress as a t4 metric; don't start the next migration before finishing the current one.

---

### S6. The cloud DB cutover where replication broke at the last minute

**Scenario:** You're minutes from cutting over from on-prem to a managed cloud DB. The plan: bulk-loaded, replicating the delta, lag near zero. Just before cutover, replication breaks and lag starts climbing.

- **Mitigate / decide:** Do **not** cut over with growing lag — you'd lose the un-replicated writes. Abort the cutover, keep serving from the source (no downtime taken yet because the source is still primary), and fix replication first. Aborting safely is the senior move; forcing the cutover risks data loss.
- **Diagnose:** Find why replication broke — a network blip, a too-large transaction, an unsupported statement, or running out of binlog retention. Check whether the target is still consistent up to the break point.
- **Communicate:** Tell stakeholders the cutover is postponed (not failed) with the reason; reassure that no data was lost precisely *because* you didn't force it.
- **Root-cause fix:** Repair replication, let lag drain back to ~0, re-run reconciliation (row counts + checksums) to confirm fidelity, then re-attempt the short cutover window.
- **Prevention:** Alert on replication lag and breakage; ensure adequate binlog/WAL retention; rehearse the cutover on a staging copy; always have a defined abort criterion ("if lag > X or replication is broken, abort") and keep a fail-back path until the soak proves the target.
