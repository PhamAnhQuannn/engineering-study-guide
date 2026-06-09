# Migration Scenarios — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Big rewrites, data migration, zero downtime.

Migrations — moving from one schema, datastore, service, or platform to another — are where senior engineers most visibly prove they can manage risk. The defining constraints are that the system usually must stay **live** during the move, the data must end up **correct and consistent**, and the change must be **reversible** until it's proven. The hallmark of a good migration is that it's *boring*: incremental, reversible, observable, and dual-running long enough to verify before cutover. Big-bang flag-day migrations are the anti-pattern.

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
- Use online-DDL tooling (e.g., `pt-online-schema-change`, `gh-ost`, or the DB's native online DDL) that builds the change on a shadow copy and swaps it in.
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
- **Online DDL** — schema change without long table locks.
- **Strangler fig** — incremental replacement of a system via a routing façade.
- **Reconciliation** — comparing old vs. new to prove equivalence (row counts, checksums, sampled diffs).
- **Flag day / big-bang** — a single hard cutover with no incremental path (the anti-pattern).
- **Two-way door** — a reversible decision; migrations should preserve reversibility as long as possible.

---

## Tradeoffs

- **Big-bang vs. incremental.** Big-bang (flag-day) is simpler to *plan* and avoids the complexity of dual-running, but has no safe rollback and a single catastrophic failure mode. Incremental costs more engineering (dual paths, reconciliation) but is reversible and low-risk. For anything live or important, incremental wins.
- **Downtime window vs. zero-downtime.** A short maintenance window is dramatically simpler and sometimes fine (internal tools, off-peak, small data). True zero-downtime is much harder (dual-write consistency, online DDL) and only worth it when downtime is genuinely unacceptable.
- **Dual-write consistency vs. complexity.** Keeping two stores consistent during writes is hard (partial failures, ordering). Alternatives: write to one and use **change data capture (CDC)** to replicate to the other, which avoids dual-write divergence at the cost of replication lag.
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
