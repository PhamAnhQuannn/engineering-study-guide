# Observability — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Logs, metrics, traces, alerting, SLO/SLA/SLI.

Named options, a reasoned recommendation, and **what would change the answer.**

---

### Dec1. Metrics vs logs vs traces — where do you invest first for a new service?

- **A — Metrics first** (golden signals + dashboards + alerts).
- **B — Logs first** (structured logs with correlation ids).
- **C — Traces first** (full distributed tracing).

**Recommendation:** **Metrics first (A).** The golden signals (latency, traffic, errors, saturation) give you alerting and a health overview for the lowest cost and cardinality — you can't operate without knowing *that* something's wrong. Add **structured logs with correlation ids (B)** next for diagnosis, then **traces (C)** once you have enough services that cross-service latency attribution is the hard problem.

**What would change the answer:** A deep microservice mesh from day one (10+ services per request) makes traces (C) urgent earlier, because metrics alone can't tell you *which* hop is slow. A simple monolith can defer tracing a long time.

---

### Dec2. Alert on symptoms (SLO burn) vs alert on causes (CPU/memory/disk)

- **A — Symptom/SLO-based** paging.
- **B — Cause/resource-based** paging.

**Recommendation:** **Page on symptoms (A)** — user-facing error rate and latency / error-budget burn. They fire exactly when users hurt, regardless of cause, and avoid noise. Keep cause metrics (B) on **dashboards for diagnosis**, and at most as *low-severity tickets* (e.g. "disk 80% full, will fill in 3 days") — predictive, not paging.

**What would change the answer:** Some causes are genuinely predictive and actionable before user impact (disk about to fill, certificate expiring, quota nearly exhausted) — those warrant their own (often non-paging) alerts. But the *primary* page is always the symptom.

---

### Dec3. Head-based vs tail-based trace sampling

- **A — Head-based** (decide at start, e.g. keep 1%).
- **B — Tail-based** (decide after the full trace; keep errors/slow).

**Recommendation:** **Tail-based (B)** when you can afford the infrastructure, because it guarantees you keep the traces that matter (errors, high latency) while downsampling boring successes — the best signal-per-byte. Use **head-based (A)** when simplicity/cost dominates and you can't run the buffering infra, ideally with a rule to **always keep error traces**.

**What would change the answer:** Low trace volume → just keep everything (no sampling needed). Very high volume with strict cost limits and no tail infra → head-based with error-biasing.

---

### Dec4. Tight SLO (e.g. 99.99%) vs looser SLO (99.9%)

- **A — 99.99%** (~52 min/year budget).
- **B — 99.9%** (~8.8 h/year budget).

**Recommendation:** Set the SLO from **actual user/business need**, not vanity. **99.9% (B)** is plenty for most internal and many user-facing services and leaves a healthy error budget for shipping. Reserve **99.99% (A)** for genuinely critical paths (payments, auth) where the cost (multi-region redundancy, change freezes, on-call intensity) is justified.

**What would change the answer:** A revenue-critical or contractually-bound path (SLA penalties, regulatory) justifies tighter SLOs. For everything else, tighter nines mostly buy cost and reduced velocity for marginal user benefit.

---

### Dec5. Build observability (Prometheus/Grafana/Jaeger/Loki) vs buy (Datadog/Honeycomb/New Relic)

- **A — Build/self-host** open-source stack.
- **B — Buy** a managed SaaS platform.

**Recommendation:** **Buy (B)** for most teams, especially small/medium ones: observability is undifferentiated heavy lifting, and SaaS gives correlated metrics/logs/traces, retention, and on-call integrations without you operating a storage-heavy system. **Build (A)** when scale makes SaaS bills enormous, you have strong platform/SRE staffing, or data-residency/compliance forbids shipping telemetry externally.

**What would change the answer:** Massive telemetry volume (SaaS cost explodes with cardinality/retention) and a dedicated platform team tip toward self-hosting. Strict data-sovereignty rules force self-hosting. Otherwise, buy and focus on the product.

---

### Dec6. High-cardinality dimensions in metrics vs in logs/traces

- **A — Put user_id/request_id as metric labels** for slice-ability.
- **B — Keep metrics low-cardinality; put per-request detail in logs/traces.**

**Recommendation:** **B**, firmly. High-cardinality labels in metrics cause **cardinality explosion** that can take down your metrics backend and balloon cost. Keep metric labels bounded (status, endpoint, region); push per-request/per-user detail into **traces and structured logs**, which are built for high cardinality and queried on demand.

**What would change the answer:** Almost nothing for traditional metrics. (Newer "wide event"/columnar observability tools — e.g. Honeycomb — *are* designed for high-cardinality events; if you're on one of those, the metrics-vs-events distinction blurs and high cardinality is the point.)

---

### Dec7. Single multi-window burn-rate alert vs many static-threshold alerts

- **A — Multi-window, multi-burn-rate** SLO alerting (fast-burn + slow-burn).
- **B — Many static threshold** alerts (error rate > 1%, latency > 500 ms, etc.).

**Recommendation:** **A.** Multi-window burn-rate alerting pages quickly for acute outages (fast burn) *and* catches slow degradation (slow burn) while suppressing flapping false positives — far less noise for far better coverage. A pile of static thresholds (B) is brittle, noisy, and causes alert fatigue (which gets real alerts ignored).

**What would change the answer:** For a brand-new service without enough traffic to compute stable burn rates, a couple of simple static alerts are a pragmatic starting point until you have SLO data; migrate to burn-rate once traffic is meaningful.
