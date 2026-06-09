# Observability — Real-World Situations

[← Topic overview](../README.md)

> Topic: Logs, metrics, traces, alerting, SLO/SLA/SLI.

On-the-job scenarios: **Model/mitigate → Diagnose with data → Communicate → Root-cause fix → Prevention.**

---

### S1. p99 latency spikes 10× but p50 is flat

**Situation:** Dashboards show p99 jumped from 80 ms to 900 ms; p50 is unchanged at 40 ms. Users in a forum complain intermittently.

- **Mitigate:** Stabilize the tail — if it's a hot dependency, enable timeouts/hedging on that path; if a bad replica, drain it. Buy time while diagnosing.
- **Diagnose with data:** Flat p50 + blown p99 = a *subset* of requests is slow. Pull **traces** for the slow requests and look at span breakdown. Slice high-cardinality dimensions: is it one **shard/tenant** (hot partition), one **host** (GC pauses / degraded node), one **downstream** (a dependency's tail), or **retries**? The trace tree localizes the added time.
- **Communicate:** "1% of requests are slow due to a hot shard; p50 unaffected. Mitigation in progress." Set expectations honestly.
- **Root-cause fix:** Depending on finding — rebalance the hot shard, fix the GC/heap config, add a timeout+breaker on the slow dependency, or cap retries.
- **Prevention:** Alert on **p99 burn**, not just averages; add per-shard/per-tenant latency metrics; load-test with skewed key distributions.

---

### S2. Alert fatigue: the team is ignoring pages, then misses a real outage

**Situation:** On-call gets 40 pages/night, most non-actionable. A genuine outage's page is missed in the noise.

- **Mitigate:** Immediately silence the known-noisy, non-actionable alerts; designate the few real symptom alerts as page-worthy.
- **Diagnose with data:** Audit alert history — what fraction of pages led to action? Most are **cause-based** (CPU, memory, individual pod restarts) that self-resolve. This is classic **alert fatigue**.
- **Communicate:** Run a blameless review; agree that every page must be actionable with a runbook, or it's downgraded to a ticket/dashboard.
- **Root-cause fix:** Move to **symptom/SLO burn-rate alerting** (page on user-facing error/latency budget burn). Convert cause metrics to dashboards and non-paging tickets. Add runbooks to remaining pages.
- **Prevention:** Alert review as a standing ritual; a rule that adding a new page requires "what action does the responder take?" Track page actionability as a metric.

---

### S3. An incident happened but there's no data to explain it

**Situation:** A 20-minute outage self-resolved; the team can't determine the cause because there were no traces and logs lacked correlation ids.

- **Mitigate:** Restore service is already done; the immediate task is preventing recurrence blindness.
- **Diagnose with data:** Attempt reconstruction from what little exists (coarse metrics, scattered logs). The gap itself is the finding: **insufficient observability** (no traces, unstructured logs, no correlation ids).
- **Communicate:** In the post-mortem, flag the observability gap as a top action item — "we cannot currently diagnose this class of failure."
- **Root-cause fix:** Add **structured logging with a correlation/trace id** propagated across services, **distributed tracing** on the critical paths, and ensure error traces are always sampled/kept.
- **Prevention:** Treat observability as a launch requirement (golden signals + traces + correlation ids) before a service is considered production-ready; run game days to verify you *can* debug.

---

### S4. The metrics backend falls over from a cardinality explosion

**Situation:** After a deploy, Prometheus memory balloons and queries time out; dashboards go blank during an incident — exactly when you need them.

- **Mitigate:** Identify and drop the offending metric/label; restart the metrics backend; restore dashboards.
- **Diagnose with data:** Series count exploded right after the deploy. A new metric added a **high-cardinality label** (e.g. `user_id` or `request_path` with ids) → millions of series.
- **Communicate:** Note that monitoring blindness compounded the incident; prioritize the fix.
- **Root-cause fix:** Remove the high-cardinality label; move that per-request detail to **logs/traces**. Set per-metric cardinality limits/relabeling rules at ingestion.
- **Prevention:** Cardinality budget + linting in CI for new metrics; alert on series-count growth; educate teams that metric labels must be low-cardinality.

---

### S5. SLA breach surprises everyone — no early warning

**Situation:** A customer invokes the SLA for credits after a bad month; the team had no idea reliability was degrading until the contract breached.

- **Mitigate:** Honor the SLA, communicate with the customer, and stand up immediate SLO tracking to regain visibility.
- **Diagnose with data:** There were no **SLIs/SLOs** measured internally — only the looser external SLA, with no early-warning margin or error-budget tracking. Reliability eroded gradually (slow burn) unnoticed.
- **Communicate:** Brief leadership: the gap was a missing internal SLO tighter than the SLA, plus burn-rate alerting.
- **Root-cause fix:** Define **SLIs** (success ratio, latency threshold), set an **internal SLO tighter than the SLA**, track the **error budget**, and add **multi-window burn-rate alerts** so slow degradation pages well before the SLA is at risk.
- **Prevention:** Error-budget policy tied to change freezes; monthly SLO review; dashboards showing budget remaining vs the SLA cushion.

---

### S6. A deploy degrades a downstream, but only for one tenant

**Situation:** Overall error rate looks normal, yet a single enterprise customer reports failures after a release.

- **Mitigate:** If feasible, roll back or feature-flag off the change for that tenant; restore their service first.
- **Diagnose with data:** Aggregate metrics hide it because one tenant is a small fraction of traffic. **Slice by tenant** (high-cardinality dimension in traces/logs/wide events): the error rate for that tenant spiked post-deploy. Traces show a specific code path failing for their data shape.
- **Communicate:** Update the affected customer directly with status and ETA; note internally that aggregate dashboards masked a per-tenant regression.
- **Root-cause fix:** Fix the code path (e.g. an edge case in that tenant's config/data); re-roll forward.
- **Prevention:** Per-tenant SLIs for top customers; canary/staged rollouts; the ability to **slice telemetry by tenant** so localized regressions surface despite healthy aggregates.
