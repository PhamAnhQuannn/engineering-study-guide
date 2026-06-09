# Observability — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Logs, metrics, traces, alerting, SLO/SLA/SLI.

Observability is the ability to understand a system's *internal* state from its *external* outputs — to answer questions you didn't pre-plan, especially "why is it behaving like this?" The senior distinction: **monitoring** tells you whether known things are broken (known-unknowns); **observability** lets you investigate novel failures (unknown-unknowns).

---

## 1. The three pillars

### Metrics
- **Numeric, aggregated time series** (counters, gauges, histograms). Cheap to store, fast to query, great for dashboards and alerting.
- Cardinality is the cost driver: each unique label combination is a separate series. High-cardinality labels (user_id, request_id) explode storage — keep labels low-cardinality.
- Types: **counter** (monotonic — requests, errors), **gauge** (point-in-time — queue depth, memory), **histogram/summary** (distributions — latency buckets, enabling percentiles).
- Pull (Prometheus scrapes targets) vs push (StatsD/OTLP) collection models.

### Logs
- **Discrete, timestamped event records.** High detail, high cardinality, expensive at scale.
- **Structured logging** (JSON key-values) >> free-text: queryable, aggregatable, joinable with traces via correlation ids.
- Use **log levels** deliberately; include a **correlation/trace id** in every line to stitch a request's journey across services.
- Costly to retain — sample, tier (hot/cold storage), or aggregate.

### Traces
- **Distributed tracing** follows a single request across services as a tree of **spans** (each span = one operation with start/end + attributes), tied together by a **trace id** propagated via headers (W3C Trace Context).
- Answers "where did the time go?" and "which hop failed?" across a microservice call graph.
- **Sampling** is essential at scale: **head-based** (decide at request start, cheap, may miss rare errors) vs **tail-based** (decide after seeing the whole trace, keeps the interesting/slow/error traces, more infra).

**Together:** metric tells you *something is wrong*, trace tells you *where*, log tells you *what exactly*. Correlation ids link all three.

---

## 2. The golden signals (what to measure)

The **four golden signals** (Google SRE) for any user-facing service:
1. **Latency** — how long requests take (distinguish success vs error latency; track **percentiles**, not averages).
2. **Traffic** — demand (RPS, throughput).
3. **Errors** — rate of failed requests (explicit 5xx, implicit wrong-content, policy failures).
4. **Saturation** — how "full" the system is (CPU, memory, queue depth, connection pool) — the leading indicator of impending trouble.

Related framework: **USE** (Utilization, Saturation, Errors) for resources; **RED** (Rate, Errors, Duration) for request-driven services.

---

## 3. Percentiles, not averages

- Averages hide tail latency. A p50 of 50 ms with a p99 of 5 s means 1% of users have a terrible experience — invisible in the mean.
- Track **p50/p90/p95/p99/p99.9**. The tail is where users churn and where cascading failures start.
- **Percentiles don't average/add across services** — you can't sum p99s. Use histograms and compute percentiles from buckets; beware aggregating pre-computed percentiles.

---

## 4. SLI / SLO / SLA / error budgets

- **SLI (Indicator):** a measured quantity reflecting user happiness, e.g. "proportion of requests served < 300 ms" or "successful-request ratio." Good SLIs are user-centric ratios.
- **SLO (Objective):** the target for an SLI over a window, e.g. "99.9% of requests succeed over 30 days." Internal goal.
- **SLA (Agreement):** a *contract* with customers including consequences (refunds/credits) if breached. SLA is usually looser than the SLO (you alert/act before the contract breaks).
- **Error budget:** `100% − SLO`. A 99.9% SLO allows 0.1% failures ≈ **~43 minutes/month** of downtime budget. The budget reframes reliability as a *resource*: if budget remains, ship fast and take risks; if it's exhausted, freeze risky changes and focus on stability. It aligns dev (velocity) and ops (reliability) incentives.

**Availability cheat-sheet (downtime/year):** 99% ≈ 3.65 days; 99.9% ("three nines") ≈ 8.8 h; 99.99% ≈ 52.6 min; 99.999% ("five nines") ≈ 5.3 min.

---

## 5. Alerting

- **Alert on symptoms, not causes** — page on "users are seeing errors / high latency" (SLO burn), not on "CPU is 90%" (which may be fine). Cause-based alerts create noise and miss novel failures.
- **Error-budget burn-rate alerting:** page when you're consuming the budget too fast (e.g. multi-window, multi-burn-rate: a fast-burn alert for acute outages + a slow-burn alert for gradual degradation). Reduces false pages while catching real problems.
- **Actionable & ownable:** every page must require human action and have a clear owner + runbook. Non-actionable alerts → **alert fatigue** → ignored real alerts.
- **Page vs ticket vs log:** page (wake someone) only for urgent user-impacting issues; lower-severity → ticket; informational → dashboard/log.

---

## 6. Key terms

| Term | Definition |
|---|---|
| Observability vs monitoring | Investigate unknown-unknowns vs detect known failure conditions. |
| Cardinality | Number of unique label/series combinations; the cost driver for metrics. |
| Span / trace | One operation / the full tree of spans for a request across services. |
| Correlation (trace) id | Identifier propagated across services to stitch logs/traces together. |
| Golden signals | Latency, Traffic, Errors, Saturation. |
| SLI / SLO / SLA | Measured indicator / internal target / external contract. |
| Error budget | Allowed unreliability (1 − SLO); a resource to spend on velocity. |
| Burn rate | Speed at which the error budget is being consumed. |
| Tail/head sampling | Decide which traces to keep after / before seeing the full trace. |
| Cardinality explosion | Runaway series count from high-cardinality labels. |

---

## 7. Tradeoffs

- **Detail vs cost:** logs/traces are rich but expensive; metrics are cheap but low-detail. Use metrics for breadth + alerting, traces/logs for depth on demand. Sample aggressively.
- **Head vs tail sampling:** head is cheap but may drop the rare error trace you need; tail keeps the interesting traces but needs buffering/infra.
- **Cardinality vs insight:** more labels = more slice-ability but exponential cost; pick dimensions deliberately.
- **Tight vs loose SLOs:** tighter SLOs delight users but shrink the error budget (less room to ship/experiment) and cost more (redundancy). Set SLOs from *user needs*, not vanity nines.
- **More alerts vs signal:** more coverage vs alert fatigue. Symptom-based + burn-rate alerting balances this.

---

## 8. Common pitfalls & misconceptions

- **Averages instead of percentiles** — hides the tail that actually hurts users.
- **Alerting on causes (CPU/memory)** — noisy, misses novel failures; alert on user-facing symptoms/SLO burn.
- **Cardinality explosion** — putting user_id/request_id in metric labels blows up storage and cost.
- **Logs without correlation ids** — can't reconstruct a request across services; logging becomes archaeology.
- **"We have dashboards" ≠ observability** — dashboards answer known questions; observability is about asking *new* questions of high-cardinality data.
- **Vanity SLOs (five nines for everything)** — astronomically expensive and usually unnecessary; pick SLOs the business actually needs.
- **Sampling away errors** — naive head sampling drops rare error traces; use tail-based or always-sample errors.
- **No error budget policy** — SLOs with no consequence are ignored; tie budget exhaustion to a change-freeze decision.
- **Aggregating percentiles** — averaging p99s across hosts/services is statistically invalid; aggregate from histograms.

---

## 9. What interviewers probe

- *"Three pillars — when do you reach for each?"*
- *"Why percentiles over averages? What's wrong with alerting on a 200 ms *average*?"*
- *"Define SLI/SLO/SLA and error budget. How big is a 99.9% budget?"*
- *"Your p99 latency spiked but p50 is flat — what does that tell you, and how do you investigate?"* (Tail issue: a subset/dependency/GC/hot shard; trace + saturation metrics.)
- *"Design alerting that pages on real problems but doesn't cause fatigue."* (Symptom + burn-rate, multi-window.)
- *"What is cardinality and why do you care?"*
- *"How would you debug a latency regression you've never seen before across 20 services?"* (Traces + correlation ids = the observability story.)

---

## 10. Quick-reference summary

- **Three pillars:** **metrics** (cheap, aggregate, alert), **logs** (detailed events, structured + correlation id), **traces** (cross-service request path). Link via trace ids.
- **Golden signals:** Latency, Traffic, Errors, Saturation (saturation = leading indicator). RED for services, USE for resources.
- **Use percentiles (p95/p99), not averages**; don't average percentiles.
- **SLI** (measured) → **SLO** (internal target) → **SLA** (contract). **Error budget = 1 − SLO**; 99.9% ≈ 43 min/month; spend the budget on velocity.
- **Alert on symptoms / budget burn rate**, not on causes; every page actionable + runbook to avoid fatigue.
- **Control cost** with sampling (prefer tail/always-keep-errors) and low metric cardinality.
- **Observability > monitoring:** investigate unknown-unknowns, not just check known thresholds.
