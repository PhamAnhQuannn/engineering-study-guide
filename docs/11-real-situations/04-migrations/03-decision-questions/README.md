# Migration Scenarios — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Big rewrites, data migration, zero downtime.

Each prompt is a migration fork. Give the reasoned recommendation, then **what would change the answer**. The through-line: stay reversible, verify before trusting, and don't over-engineer zero-downtime when a window is fine.

---

### D1. Big-bang flag-day cutover vs. incremental migration

**Context:** Moving a live, important system to a new store/platform.

- **A — One big cutover during a maintenance window.**
- **B — Incremental: dual-write, backfill, gradual read cutover.**

**Recommendation:** **B for anything live and important.** Big-bang has no safe rollback and one catastrophic failure mode; if anything's wrong at the flag day, you're stuck mid-outage. Incremental (expand → migrate → contract) is reversible at every phase and lets you verify before trusting.

**What would change the answer:** For a small dataset, an internal tool, or an off-peak system where a brief downtime window is genuinely acceptable, a simple dump-restore-cutover (A) is far cheaper and the complexity of dual-running isn't justified. Match the rigor to the stakes.

---

### D2. Dual-write vs. change-data-capture (CDC) to keep two stores in sync

**Context:** During migration you need the new store to track the old one.

- **A — Application dual-write to both stores.**
- **B — Write to the old store; CDC replicates to the new.**

**Recommendation:** **B (CDC) for most cases.** Dual-write is prone to **divergence**: a write succeeds to one store and fails to the other (partial failure, ordering, retries) and the stores silently drift. CDC reads the source's commit log, so the new store is a faithful (eventually-consistent) replica with no dual-write race. Add reconciliation either way.

**What would change the answer:** If you need the new store **strongly consistent immediately** (no replication lag tolerable) and can wrap both writes in a reliable mechanism (e.g., transactional outbox), dual-write may be warranted — but you're taking on real complexity. CDC + reconciliation is the safer default.

---

### D3. Zero-downtime migration vs. a short maintenance window

**Context:** Deciding how much engineering to invest.

- **A — Engineer true zero-downtime (dual-write, online DDL, gradual cutover).**
- **B — Take a short, scheduled maintenance window.**

**Recommendation:** **It depends on whether downtime is actually unacceptable.** Zero-downtime is significantly harder and riskier to build. If a 10-minute off-peak window is tolerable for the business, take it (B) — it's simpler, cheaper, and *less* error-prone. Reserve full zero-downtime (A) for systems where any downtime is genuinely unacceptable (payments, high-traffic consumer apps with global users).

**What would change the answer:** A 24/7 global product with no low-traffic window, SLA penalties, or revenue-per-minute that dwarfs the engineering cost pushes hard toward A. A B2B tool used 9–5 in one timezone makes B obvious.

---

### D4. Add a column with a DEFAULT vs. nullable-then-backfill (large table)

**Context:** Adding a `NOT NULL` column to a multi-TB table on a busy DB.

- **A — `ADD COLUMN ... NOT NULL DEFAULT x` in one statement.**
- **B — Add nullable → backfill in batches → add the constraint.**

**Recommendation:** **B.** On many DB versions, adding a column with a default (or a `NOT NULL`) forces a full table rewrite under a lock — a write outage on a big table. Add it nullable (fast, metadata-only), backfill in throttled batches, then validate the constraint with a non-blocking technique. (Some modern Postgres versions make constant defaults cheap, but B is the universally safe playbook.)

**What would change the answer:** On a small table, or a DB/version where the operation is provably metadata-only and instant, A is fine and simpler. Verify the lock behavior for *your* engine and version before choosing A.

---

### D5. Strangler-fig rewrite vs. full rewrite from scratch

**Context:** Replacing a legacy system everyone wants gone.

- **A — Strangler fig: route slices to the new system incrementally.**
- **B — Build the replacement fully, then cut over.**

**Recommendation:** **A.** A full rewrite is the highest-risk path: a long no-value period, high overrun probability, and it usually re-creates the original complexity (which was essential, not accidental). Strangler delivers value continuously, stays reversible, and de-risks via per-capability dual-running and comparison.

**What would change the answer:** A full rewrite can win only if the system is small enough to rebuild quickly *and* the platform is truly dead (EOL runtime, fundamentally wrong datastore) such that incremental coexistence is impossible. Even then, prefer migrating capability-by-capability if at all feasible.

---

### D6. Cut over all at once vs. canary the read switch

**Context:** The new store is backfilled and reconciled. Time to switch reads.

- **A — Flip 100% of reads to the new store.**
- **B — Canary: 1% → 10% → 50% → 100%, watching metrics.**

**Recommendation:** **B.** Reconciliation reduces but doesn't eliminate the chance of a rare, traffic-pattern-dependent bug that only shows under real load. A gradual, flagged cutover bounds the blast radius and gives you an instant rollback at each step. The cost is a slightly longer cutover; the benefit is not turning a subtle bug into a full outage.

**What would change the answer:** If the system is tiny, the change trivially verifiable, and flag infrastructure doesn't exist, a single flip with a tested rollback is acceptable. The bigger the traffic and blast radius, the more non-negotiable the canary.

---

### D7. Contract (drop the old path) now vs. soak first

**Context:** Cutover succeeded; the new store is serving 100%. Drop the old column/table now?

- **A — Drop the old path immediately to simplify.**
- **B — Soak for a defined period with rollback still possible, then drop.**

**Recommendation:** **B.** Dropping the old path is the one truly **irreversible** step — once it's gone, you can't roll back if a rare bug surfaces days later. Keep the old path (read-only, or just retained) through a soak period long enough to cover your traffic cycles, then contract. The cost of keeping it a bit longer is trivial; the cost of dropping too early is unrecoverable.

**What would change the answer:** If keeping the old path is itself causing harm (cost, security exposure, ongoing dual-write divergence) and the new path is thoroughly verified, shorten the soak — but never skip it entirely on an important system.

---

### D8. Stop-the-world backfill vs. throttled online backfill

**Context:** You must copy billions of historical rows into the new store while prod is live.

- **A — Run the backfill as fast as possible to finish sooner.**
- **B — Throttle it (rate-limited batches), accept a longer runtime.**

**Recommendation:** **B.** An un-throttled bulk copy saturates DB I/O, spikes replication lag, and causes a latency incident on the live system — turning a migration into an outage. Backfill in small, idempotent, resumable, rate-limited batches that yield to production traffic, even if it runs for days. Finishing slower beats taking prod down.

**What would change the answer:** If there's a genuine low-traffic maintenance window and the dataset fits, a faster bulk load within that window is fine. The constraint is *never harm live traffic* — throttle whenever the backfill competes with prod.
