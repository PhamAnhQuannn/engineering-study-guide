# Failure Handling — Real-World Situations

[← Topic overview](../README.md)

> Topic: Partial failure, partitions, timeouts, backoff.

On-the-job scenarios. Each follows: **Model the approach / mitigate → Diagnose with data → Communicate → Root-cause fix → Prevention.**

---

### S1. A dependency slows down and your whole service goes down with it

**Situation:** Checkout API starts returning 100% errors. The DB and checkout code look fine; the only change is the *fraud-check* service got slow (p99 50 ms → 6 s).

- **Mitigate:** Trip the circuit breaker for the fraud dependency (or push config to do so) so checkout fails fast instead of blocking. If fraud is non-critical for low-value carts, temporarily **fail open** below a threshold. Restore checkout availability first.
- **Diagnose with data:** Thread-pool/connection-pool saturation metrics show all workers blocked on fraud calls. Traces show 6 s spans on the fraud hop. This is a **cascading failure** from thread exhaustion, not a checkout bug.
- **Communicate:** Status page: "Checkout degraded due to a downstream dependency; mitigations applied." Tell the fraud team with the trace evidence.
- **Root-cause fix:** Add **per-dependency timeouts** (fraud call ≤ 300 ms), a **circuit breaker**, and a **bulkhead** (separate pool for fraud calls) so fraud can never consume checkout's whole pool again.
- **Prevention:** Game-day latency injection on every critical dependency; alert on pool saturation, not just error rate.

---

### S2. A retry storm turns a 30-second blip into a 2-hour outage

**Situation:** A 30 s DB hiccup recovers, but the service stays at 100% CPU and high latency long after. Removing load doesn't help.

- **Mitigate:** This is a **metastable failure** — a self-sustaining retry loop. Break the loop: enable aggressive **load shedding** (return 429s), open breakers to drop in-flight retries, and/or briefly scale out to outrun the loop. Only then ramp traffic back.
- **Diagnose with data:** Request rate to the DB is 4× the user request rate → retries are amplifying load. Logs show backoff with **no jitter** (synchronized retry waves) and retries at three call layers.
- **Communicate:** Incident channel: explain it's a feedback loop, not a capacity shortage, so people don't "just add nodes" (which can feed the loop).
- **Root-cause fix:** Add **full jitter**, a **retry budget** (cap retries at 10% of traffic), and consolidate retries to a single layer.
- **Prevention:** Load tests that include the failure-and-recovery transient, not just steady state; dashboards comparing offered load vs retry load.

---

### S3. Split-brain after a network partition between two data centers

**Situation:** A link between DC-A and DC-B flaps. Afterward, some records have conflicting values; both DCs accepted writes for the same keys.

- **Mitigate:** Stop the bleeding — make one side authoritative (the one with quorum / more recent fencing token), set the other read-only. Freeze conflicting writes.
- **Diagnose with data:** Version vectors / fencing tokens show two divergent write histories for the same keys during the partition window. Both sides had a "leader."
- **Communicate:** Tell stakeholders which records may be affected and the reconciliation plan; this often has data-correctness, not just availability, implications.
- **Root-cause fix:** Reconcile divergent records (business rules / last-writer-wins / merge). Move the cluster to **quorum-based leadership** (majority required to accept writes) plus **fencing tokens** so a minority partition can't elect its own leader.
- **Prevention:** Never allow writes without quorum; chaos-test partitions; ensure the data store's config actually requires majority (a common misconfig is allowing minority writes for "availability").

---

### S4. Health checks pass but users get errors (gray failure)

**Situation:** Dashboards are green, `/healthz` returns 200 everywhere, but support tickets and client-side error rates spike.

- **Mitigate:** Trust the *user-facing* signal — pull suspect hosts from the LB even though they self-report healthy. Drain and restart degraded nodes.
- **Diagnose with data:** Client-side / synthetic-probe success rate is far below server-reported health. A subset of nodes have exhausted DB connection pools or degraded disks — `/healthz` doesn't touch those, so it lies (**gray failure / differential observability**).
- **Communicate:** Flag that server-side health is unreliable here; decisions should follow real request success rates.
- **Root-cause fix:** Make health checks **exercise real dependencies** (a lightweight real query), and add **outlier detection** at the LB based on actual error rates, not just heartbeat.
- **Prevention:** Always monitor from the caller's perspective (RUM, synthetic canaries hitting real paths), not only self-reported liveness.

---

### S5. A timeout-then-retry double-charged customers

**Situation:** Finance reports duplicate charges. The charge service retries on timeout; some original requests had actually succeeded at the PSP.

- **Mitigate:** Pause automatic retries on the payment path. Identify and refund duplicates by matching PSP references.
- **Diagnose with data:** Correlate timed-out requests with PSP records: the original charge succeeded, the response was lost, the retry created a *second* PSP charge. **Timeout ≠ failure.**
- **Communicate:** Proactively notify affected customers and refund; tell leadership the scope and the fix timeline.
- **Root-cause fix:** Introduce **idempotency keys**: client sends a stable key per attempt; server dedups (insert-if-absent) and, on a retry after a lost response, queries the PSP by that key instead of charging again.
- **Prevention:** Treat *all* mutating, externally-visible operations as needing idempotency before any retry is allowed; add a reconciliation job that diffs the ledger vs PSP daily.

---

### S6. A correlated failure takes out all three "redundant" replicas at once

**Situation:** A service has 3 replicas "for redundancy" yet went fully down in one event.

- **Mitigate:** Restore service (roll back the change / restart). Buy time with cached/degraded responses if possible.
- **Diagnose with data:** All 3 replicas were in the *same AZ*, shared the *same config push*, and depended on the *same* downstream — so the "redundancy" was an illusion; the failure was **correlated**, not independent.
- **Communicate:** Be honest that redundancy was nominal, not real; lay out the spread-the-risk plan.
- **Root-cause fix:** Spread replicas across **AZs/failure domains**, stagger config rollouts (canary), and remove the shared single dependency or make it itself redundant.
- **Prevention:** Track *failure-domain diversity* as an explicit SLO input; in design reviews, ask "what's the single thing whose failure takes all replicas down?"
