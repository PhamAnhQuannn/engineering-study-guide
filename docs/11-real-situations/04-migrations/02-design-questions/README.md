# Migration Scenarios — System Design Questions

[← Topic overview](../README.md)

> Topic: Big rewrites, data migration, zero downtime.

Each prompt is a migration design exercise. Structure your answer: **Requirements/Scale → High-level design (phases) → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.** The recurring backbone is expand → migrate → contract, with reconciliation and a rollback at every phase.

---

### DQ1. Zero-downtime split of a monolithic `users` table into a separate Profile Service

**Requirements / Scale:** 200M users, ~50k writes/s and ~500k reads/s on user data. The monolith reads/writes `users` directly via SQL joins. Goal: extract profile data into a new service with its own datastore, **no downtime**, no data loss, reversible until proven.

**High-level design (expand → migrate → contract):**
1. **Expand:** Stand up the Profile Service + its datastore. The monolith keeps `users` as source of truth. Add a profile API the monolith *can* call but doesn't yet.
2. **Migrate — dual-write:** On every user write, the monolith writes to `users` *and* calls the Profile Service (or, safer, emits a change event consumed by the Profile Service via CDC to avoid dual-write divergence). Backfill 200M existing users into the new store in throttled, resumable batches.
3. **Migrate — dual-read + reconcile:** Read from `users` (served) and shadow-read from the Profile Service; compare and log discrepancies until they're ~zero.
4. **Cutover:** Behind a flag, shift reads to the Profile Service gradually (1% → 100%), watching error/latency/consistency. Then shift writes (Profile Service becomes source of truth).
5. **Contract:** After a soak with rollback still possible, stop writing profile columns in `users` and eventually drop them.

**Data model:** Profile Service owns `profile(user_id PK, display_name, bio, avatar_url, prefs, updated_at, version)`. The monolith retains `users` with auth/identity columns; profile columns are removed only in the contract phase. Keep `user_id` as the stable join key across the boundary.

**Scaling & bottlenecks:** Backfill must be throttled (batch by `user_id` range, rate-limited) so it doesn't saturate the prod DB. The Profile Service read path needs caching to absorb 500k reads/s. CDC pipeline lag is a bottleneck — monitor replication lag. Cross-service joins the monolith used to do in SQL now become API calls — watch for N+1 and add batch endpoints.

**Tradeoffs & failure modes:** CDC-based replication avoids dual-write divergence but introduces eventual consistency (lag); dual-write is more immediately consistent but risks partial-write divergence — prefer CDC + reconciliation here. Failure modes: dual-write divergence (mitigate with reconciliation + repair job), backfill overload (throttle), cutover surfacing a rare bug (gradual canary + instant flag rollback). Don't contract until reconciliation has been clean through a full soak.

---

### DQ2. Migrate a 5 TB table to a new Postgres schema (add a NOT NULL column, change a type) with no write outage

**Requirements / Scale:** A 5 TB, 3-billion-row `orders` table. You must add a `currency NOT NULL` column and widen `amount` from `INT` (cents) to `BIGINT`. Writes ~10k/s, can't be blocked.

**High-level design:**
1. **Add columns nullable, no default:** `ALTER TABLE orders ADD COLUMN currency TEXT;` and `ADD COLUMN amount_big BIGINT;` — these are fast metadata-only ops (no rewrite) when nullable with no volatile default.
2. **Dual-write at the app layer:** New writes populate `currency` and `amount_big` alongside the old `amount`.
3. **Backfill in batches:** Update historical rows in chunks (e.g., 10k rows/batch, by PK range), throttled, idempotent (`WHERE amount_big IS NULL`), pausable. Monitor replication lag and dead-tuple bloat; `VACUUM` as needed.
4. **Add the constraint without a long lock:** Once backfilled, add `NOT NULL` via a validated `CHECK` constraint added `NOT VALID` then `VALIDATE CONSTRAINT` (which takes only a `SHARE UPDATE` lock, not a full table lock), or set `NOT NULL` using the constraint-first technique.
5. **Cutover reads** to `amount_big`; **contract** by dropping the old `amount` after a soak.

**Data model:** Transitional state has both `amount` and `amount_big`, both `currency` nullable→not-null. Use online-DDL tooling (`gh-ost`/`pt-osc`) if even the metadata ops or index builds risk locking on your version.

**Scaling & bottlenecks:** The backfill is the long pole — at 3B rows it may run for days; it must be resumable and throttled so it doesn't cause replication lag or bloat. Build any new index `CONCURRENTLY`. Avoid a single giant `UPDATE` (it locks rows, bloats WAL, and can't be paused).

**Tradeoffs & failure modes:** Adding a `DEFAULT` with the column would force a full table rewrite on old Postgres → outage; avoid by adding nullable then backfilling. Failure modes: backfill saturating I/O (throttle), the `NOT VALID`→`VALIDATE` step still scanning the table (acceptable, no exclusive lock), running out of disk from bloat (monitor + vacuum). Rollback is trivial in early phases (drop the new nullable columns); harder after cutover (keep the old column until soak proves the new one).

---

### DQ3. Migrate from a self-hosted SQL database to a managed cloud database, minimizing downtime

**Requirements / Scale:** 2 TB OLTP database, must move from on-prem MySQL to a managed cloud equivalent. Target: minutes of downtime, not hours; zero data loss.

**High-level design:**
1. **Expand:** Provision the managed target. Take a consistent snapshot/dump of the source and restore it into the target (the bulk load).
2. **Migrate — replicate the delta:** Set up replication (binlog/CDC) from source → target so changes since the snapshot stream continuously; let it catch up until replication lag is ~0.
3. **Verify:** Reconcile — compare row counts and checksums per table; sample-compare records. Run the app in read-only shadow mode against the target if possible.
4. **Cutover (the short window):** Briefly stop writes to the source (or put the app in read-only), let the last delta drain to the target (lag → 0), flip the app's connection string / DNS to the target, resume writes. This is the only downtime — seconds to a couple of minutes.
5. **Keep reverse replication ready:** Optionally replicate target → source during the soak so you can fail *back* if the new DB misbehaves. Decommission source after the soak.

**Data model:** Unchanged (it's a like-for-like move); the focus is data fidelity and connection cutover, not schema change. Watch for engine-specific differences (collations, auto-increment, timezone handling).

**Scaling & bottlenecks:** Initial bulk load of 2 TB is the long pole — do it ahead of time; only the *delta* matters at cutover. Replication lag must reach ~0 before cutover, else the window grows. Network bandwidth between on-prem and cloud bounds the load/replication speed.

**Tradeoffs & failure modes:** A pure dump-and-restore with a long maintenance window is simpler but means hours of downtime — replication-based cutover trades complexity for a tiny window. Failure modes: replication breaking mid-stream (monitor + alert on lag), connection cutover missing some clients (use DNS/proxy with low TTL, drain connections), subtle engine differences corrupting data (caught by reconciliation). Always keep a fail-back path until the soak proves the target.

---

### DQ4. Rewrite a legacy monolith into services without a big-bang flag day

**Requirements / Scale:** A 10-year-old monolith handling all business logic; the team wants to modernize onto services but can't afford a multi-month freeze or a risky cutover.

**High-level design (strangler fig):**
1. **Façade/router in front of the monolith:** All traffic flows through a routing layer (API gateway / reverse proxy) that *can* send requests to either the monolith or a new service.
2. **Carve off one capability at a time:** Pick a bounded, low-risk capability (e.g., notifications). Build it as a new service. Route just that capability's traffic to it; the monolith handles everything else.
3. **Dual-run + compare** for the carved capability: shadow the new service's output against the monolith's before serving it, to prove equivalence.
4. **Migrate its data** (expand/contract per capability) so the new service owns its data with a clean boundary.
5. **Retire the legacy path** for that capability once proven; repeat for the next capability until the monolith is hollowed out (or kept as a thin core).

**Data model:** Each extracted service gets its own datastore and a clear ownership boundary; cross-service access goes through APIs/events, never shared tables. Define contracts (API/event schemas) explicitly per boundary.

**Scaling & bottlenecks:** The façade/router becomes a critical shared component — must be highly available. Data decoupling is the hard part — breaking shared-DB joins into API calls or denormalized reads can create N+1 or latency; mitigate with batch APIs, caching, and async events. Coordinating dual-running across many capabilities is operational overhead.

**Tradeoffs & failure modes:** Strangler is slower than a rewrite *on paper* and you maintain two systems during the transition, but it's reversible, delivers value continuously, and avoids the catastrophic flag-day failure mode. Failure modes: an extracted service diverging from monolith behavior (caught by dual-run comparison), the façade becoming a bottleneck/SPOF (make it redundant), the migration stalling half-done (a real risk — keep momentum, don't leave it perpetually 60% migrated). Capture *why* the monolith rotted so the new services don't repeat it.
