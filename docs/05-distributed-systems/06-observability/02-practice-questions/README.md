# Observability — Practice Questions

[← Topic overview](../README.md)

> Topic: Logs, metrics, traces, alerting, SLO/SLA/SLI.

Recall, "explain to a junior," and MCQs with an answer key.

---

### Q1. What's the difference between monitoring and observability?

**Answer:** **Monitoring** is checking for *known* failure conditions — predefined dashboards and threshold alerts that tell you whether the things you anticipated breaking are broken (known-unknowns). **Observability** is the property of being able to ask *new, unplanned* questions about your system's internal state from its external outputs — to investigate failures you never anticipated (unknown-unknowns). Monitoring answers "is the database CPU high?"; observability answers "why are checkout requests from one region suddenly slow?" — a question you didn't pre-build a dashboard for. Observability requires high-cardinality, richly-dimensioned data (traces, structured logs, wide events) you can slice arbitrarily.

---

### Q2. Explain the three pillars and when you reach for each.

**Answer:**
- **Metrics** — cheap numeric time series. Use for dashboards, trends, and **alerting**; they tell you *that* something is wrong (error rate up, latency up).
- **Traces** — a request's path across services as spans. Use to find *where* the problem is — which service/hop is slow or failing in a distributed call chain.
- **Logs** — detailed timestamped events. Use to find *what exactly* happened — the specific error, payload, or code path.

Flow: a metric alert fires → a trace localizes the slow/failing service → logs (joined by the trace id) reveal the exact cause.

---

### Q3. Why percentiles instead of averages? Give a concrete example.

**Answer:** Averages mask the tail. Suppose 99% of requests take 50 ms and 1% take 5 s. The **average** is ~100 ms — looks fine — but **1 in 100 users** waits 5 seconds, which is where churn, timeouts, and cascading failures originate. Percentiles expose this: p50 = 50 ms, p99 = 5 s makes the tail visible. You track p50/p95/p99/p99.9 because user pain and system instability live in the tail, and a healthy average can hide a broken p99. (Also: never *average* percentiles across hosts — it's statistically invalid; compute them from histograms.)

---

### Q4. Define SLI, SLO, SLA, and error budget. How much downtime does a 99.9% SLO allow?

**Answer:**
- **SLI (Indicator):** a measured signal of user happiness, e.g. "fraction of requests served successfully under 300 ms."
- **SLO (Objective):** the internal target for that SLI over a window, e.g. "99.9% over 30 days."
- **SLA (Agreement):** a customer-facing *contract* with penalties if breached; usually looser than the SLO so you have margin.
- **Error budget:** `1 − SLO` — the allowed unreliability. For 99.9%, that's 0.1% → about **43 minutes per month** (or ~8.8 hours/year) of allowed downtime/errors.

The error budget turns reliability into a spendable resource: budget left → ship features fast; budget gone → freeze risky changes and stabilize.

---

### Q5. Explain "alert on symptoms, not causes" to a junior.

**Answer:** A cause-based alert pages you on an internal metric like "CPU at 90%." But high CPU might be perfectly fine (efficient use), and meanwhile a totally different cause could be hurting users with CPU at 40%. So cause alerts are *noisy* (page when nothing's wrong) and *incomplete* (miss failures they didn't anticipate). A **symptom-based** alert pages on what users actually experience: "error rate above X" or "latency SLO burning too fast." Those fire when — and only when — users are hurting, regardless of the underlying cause. You still *graph* causes (CPU, memory) to help diagnose once paged, but you **page** on symptoms.

---

### Q6. What is cardinality and why does it matter for metrics?

**Answer:** Cardinality is the number of unique combinations of label values on a metric — each combination is a separate stored time series. A metric `http_requests_total{method, status, endpoint}` with 5 methods × 6 statuses × 50 endpoints = 1,500 series. Add a high-cardinality label like `user_id` (millions of values) and you get millions of series — exploding storage, memory, and query cost, potentially crashing your metrics backend. The rule: keep metric labels **low-cardinality** (bounded sets); push high-cardinality, per-request detail (user_id, request_id, trace_id) into **logs/traces**, not metric labels.

---

### Q7. Head-based vs tail-based trace sampling — tradeoff?

**Answer:** **Head-based sampling** decides whether to keep a trace at its *start* (e.g. keep 1%), before knowing the outcome. It's cheap and simple but **may drop the rare slow/error traces** you most want to see. **Tail-based sampling** buffers spans and decides *after* the full trace completes, so it can **keep all errors and slow traces** and downsample the boring fast-success ones — far better signal, but it needs infrastructure to buffer in-flight traces and more compute. At scale, teams often use tail-based (or hybrid) sampling specifically so error/latency outliers are never lost.

---

### Q8 (MCQ). Which is the best primary alert for a user-facing API?

A. CPU utilization > 80%
B. Error-budget burn rate too high (symptom/SLO-based)
C. Number of running pods < 3
D. Disk I/O wait > 50%

**Answer: B.** Burn-rate (symptom/SLO) alerting pages when users are actually being hurt and you're consuming the reliability budget too fast — actionable and low-noise. A, C, D are cause/resource metrics: useful for *diagnosis* on a dashboard but poor as primary pages (noisy, may miss real user impact).

---

### Q9 (MCQ). A 99.99% availability SLO corresponds to roughly how much downtime per year?

A. ~8.8 hours
B. ~52 minutes
C. ~5 minutes
D. ~3.65 days

**Answer: B.** 99.99% ("four nines") ≈ **52 minutes/year**. (99.9% ≈ 8.8 h/yr = A; 99.999% ≈ 5 min/yr = C; 99% ≈ 3.65 days/yr = D.)

---

### Q10 (MCQ). Your p99 latency spikes 10× but p50 is unchanged. The most likely culprit is:

A. The entire service is uniformly slower
B. A subset of requests/instances is slow (hot shard, GC pauses, one bad dependency, or a slow tenant)
C. The clock is wrong
D. Traffic dropped to zero

**Answer: B.** Unchanged p50 with a blown p99 means *most* requests are fine but a *minority* are very slow — classic tail problem: a hot shard/partition, GC/stop-the-world pauses, a single degraded replica, retries, or one slow downstream affecting a fraction of requests. Uniform slowdown (A) would move p50 too.

---

### Q11. How would you investigate a latency regression spanning 20 microservices that you've never seen before?

**Answer:** This is exactly what observability (not just monitoring) is for:
1. **Confirm and scope** with metrics: which endpoint/SLI regressed, when, and for whom (region, tenant, version)? Did it correlate with a deploy?
2. **Localize with distributed traces:** pull traces for the slow requests and look at the span breakdown — *which hop* grew? The trace tree shows where the added time lives across the 20 services.
3. **Drill into the culprit service's logs** (joined by trace id) and its **saturation** metrics (CPU, pool, queue depth) to find the cause — a slow query, a saturated pool, a downstream timeout, a GC storm.
4. **Slice high-cardinality dimensions** (tenant, version, host) to see if it's a subset (hot shard, canary, one bad node).
5. **Correlate with change events** (deploys, config, feature flags) to find the trigger.

The key tools are **correlation ids tying logs + traces together** and the ability to slice by arbitrary dimensions — without those, 20-service debugging is guesswork.

---

### Q12. What is an error-budget policy and why does it matter organizationally?

**Answer:** An error-budget policy is a pre-agreed rule for what happens as you consume the budget (1 − SLO): e.g. "if the monthly error budget is exhausted, we **freeze risky feature launches** and redirect effort to reliability until the budget recovers." It matters because it resolves the classic dev-vs-ops tension *objectively*: when budget remains, developers are free to ship fast and take risks (reliability is "good enough"); when it's spent, everyone agrees to slow down — no arguing, no heroics. It turns reliability from a vague aspiration into a measurable, shared currency that aligns velocity and stability incentives across the org.
