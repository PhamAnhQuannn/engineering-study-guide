# Observability — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Logs, metrics, traces, alerting, SLO/SLA/SLI.

Observability is the ability to understand a system's *internal* state from its *external* outputs — to answer questions you didn't pre-plan, especially "why is it behaving like this?" The senior distinction: **monitoring** tells you whether known things are broken (known-unknowns); **observability** lets you investigate novel failures (unknown-unknowns).

> **🛒 Where we are in building ShopFast** — Last topic we understood [Consensus & Replication](../../05-consensus-replication/01-knowledge/README.md): how Postgres and Kafka maintain a single leader, replicate writes durably, and recover from node failures. ShopFast is now a correctly-built distributed system. But correctness is not enough — how do we *know* that orders are flowing, that inventory is decrementing, that a Kafka consumer isn't silently falling behind? This topic is the answer: the instrumentation, alerting, and SLO (Service Level Objective) framework that makes ShopFast's behaviour visible. **Next:** we've finished the Distributed Systems tier — [Design Principles](../../../06-code-quality-and-architecture/01-design-principles/01-knowledge/README.md) opens the Code Quality & Architecture tier.

---

## Teaching arc: seeing inside ShopFast

### What it is

**Observability** is the property of a system that lets you ask arbitrary questions about its internal state using only external outputs (logs, metrics, traces). A monitoring system answers: "Is the thing I defined as broken, broken?" Observability answers: "Something is wrong — what is it, and why?"

Analogy: a car dashboard is monitoring. The speedometer, fuel gauge, and engine warning light answer pre-defined questions. Observability is having a full engine diagnostics port — a mechanic can plug in a laptop and ask *any* question: "Why does the engine stutter at exactly 3,200 RPM on cold mornings?" without the car manufacturer having predicted that question in advance.

**ShopFast's observability need:** the canonical fact states *"observe why orders fail."* An order can fail for a dozen reasons — payment provider timeout, inventory out-of-stock, Kafka consumer falling behind, Postgres replica promotion mid-request, idempotency key collision. Without structured logs tied to trace IDs and SLO (Service Level Objective) burn-rate alerts, each failure is a detective story told by one engineer at 2 AM.

### What it looks like

```
ShopFast: tracing a failed order through the three pillars

1. METRIC fires the alert:
   error_rate{endpoint="/v1/orders"} > 1% for 5 min
   → page on-call: "order error budget burning fast"

2. TRACE shows WHERE the time went:
   trace_id: abc-123
   ├── POST /v1/orders         450 ms total
   │   ├── reserveInventory    12 ms  ✓
   │   ├── paymentProvider     412 ms  ← SLOW (circuit approaching open)
   │   └── insertOrder         8 ms   ✓

3. LOG shows WHAT exactly happened:
   {"time":"2026-06-10T02:14:01Z","trace_id":"abc-123",
    "level":"warn","msg":"payment timeout",
    "provider":"stripe","duration_ms":412,"threshold_ms":400,
    "idempotency_key":"order-7f3a-...","user_id":"u42"}

Linked by trace_id — metric told you something is wrong,
trace told you where, log told you what and for whom.
```

### The code that builds it

Structured logging + trace ID propagation — the minimum viable observability setup for ShopFast:

```typescript
// server: emit structured logs with trace ID on every request
import { trace } from "@opentelemetry/api";  // OTel (OpenTelemetry) SDK

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId ?? "none";

  // Structured JSON log — queryable, correlatable across services
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    trace_id: traceId,     // links this log line to the trace and to other logs
    service: "order-service",
    ...extra,
  }));
}

// In the checkout handler:
async function checkout(userId: string, idempotencyKey: string) {
  const start = Date.now();
  try {
    const result = await paymentProvider.charge(userId, idempotencyKey);
    log("info", "payment_success", { duration_ms: Date.now() - start });
    return result;
  } catch (err) {
    log("error", "payment_failure", {
      duration_ms: Date.now() - start,
      error: String(err),
      idempotency_key: idempotencyKey,
    });
    throw err;
  }
}
```

### The code that calls it

Emitting a counter metric and recording SLI (Service Level Indicator) data — what feeds the alerting dashboard:

```typescript
// server: Prometheus-style counter for the orders SLI
import { Counter, Histogram } from "prom-client";

const orderRequests = new Counter({
  name: "orders_requests_total",
  help: "Total order attempts",
  labelNames: ["status"],  // "success" | "error" — keep low-cardinality
});

const orderDuration = new Histogram({
  name: "orders_duration_seconds",
  help: "Order request duration",
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

async function placeOrderMetered(userId: string, productId: string, key: string) {
  const end = orderDuration.startTimer();
  try {
    const result = await placeOrder(userId, productId, key);
    orderRequests.inc({ status: "success" });   // feeds the SLI ratio
    return result;
  } catch (err) {
    orderRequests.inc({ status: "error" });      // error budget consumption
    throw err;
  } finally {
    end();  // records latency bucket — enables p99 calculation
  }
}
```

### Types & differences

| Pillar | Format | Strength | Weakness | ShopFast use |
|---|---|---|---|---|
| **Metrics** | Numeric time-series (counters, gauges, histograms) | Cheap, fast to query, great for alerting | Low detail, no per-request context | SLI ratios, SLO burn-rate alerts, consumer lag |
| **Logs** | Timestamped structured events (JSON) | High detail, arbitrary fields | Expensive at scale, no causal chain across services | Payment failure detail, idempotency key collisions |
| **Traces** | Spans forming a call tree, linked by trace ID | Shows *which hop* and *how long* across services | Sampling complexity, infra cost | Diagnosing slow checkout (payment vs DB vs inventory) |

| Signal | Use for |
|---|---|
| **SLI (Service Level Indicator)** | Measuring user happiness (e.g. % orders succeeding in < 500 ms) |
| **SLO (Service Level Objective)** | Internal target for that SLI (e.g. 99.9% over 30 days) |
| **SLA (Service Level Agreement)** | Customer contract (usually looser than SLO — you act before breach) |
| **Error budget** | 1 − SLO; 99.9% SLO = ~43 min/month of allowed downtime |

### Build it for real — ShopFast

**Decision — structured logs + trace IDs from day 1:** every log line includes `trace_id`, `service`, `user_id` (for order-related flows), and `duration_ms`. This costs nothing at launch but pays back enormously during the first production incident. Without it, correlating a user complaint to a specific request is guesswork.

**Decision — SLI/SLO for orders:** the canonical launch NFR (Non-Functional Requirement) states 99.9% availability. Translating: *SLI = proportion of `POST /v1/orders` that return 2xx within 2 s; SLO = 99.9% over 30 days.* Error budget = ~43 min/month. Alert rule: burn rate > 5× (consuming 5 months' budget per month) → page on-call immediately.

**Decision — consumer lag metric for Kafka:** the canonical fact states *"inventory updates via async events."* If the `InventoryWorker` falls behind, stock levels in the DB diverge from confirmed orders — silent oversell. A `consumer_lag` metric on the `order-events` topic, alerting when lag > 10,000 messages, catches this before it becomes a customer problem.

**Decision — percentile latency, not averages:** `orderDuration` histogram is stored as buckets. The dashboard shows p50/p95/p99, not mean. A p50 of 80 ms and p99 of 2,400 ms means 1% of customers wait 30× longer — invisible in the average, visible in the tail.

**REJECTED — alerting on CPU/memory:** CPU at 90% might mean a batch job, not a user-facing problem. Alerting on CPU creates noise and misses novel failures (a slow external API won't raise CPU but will raise p99 latency). Alert on symptoms (SLO burn) not causes (resource utilisation).

> **If you get this wrong:** on Black Friday, the payment provider slows to 1,800 ms response times. Orders start timing out. Without trace IDs, the on-call engineer sees "orders failing" in the dashboard and spends 40 minutes grepping logs across three services. With structured logs + traces, they open one trace, see "paymentProvider: 1,800 ms → circuit breaker opened," and escalate to the provider's status page in 3 minutes. The difference between a 3-minute and 43-minute incident is often just whether trace IDs were wired in before the launch.

### Scaling story

- **Now (monolith, ~1,800 peak QPS):** one Prometheus instance scraping one Node.js app; structured JSON logs to stdout → log aggregator (Loki or CloudWatch Logs); OpenTelemetry (OTel) SDK sending traces to Jaeger or OTLP (OpenTelemetry Protocol) endpoint. Cost: near zero. **Placeholder:** set trace IDs on every request from day 1, even before the services split, so the habit exists.
- **Growth signal:** log volume exceeds 1 GB/day (cost spike); trace sampling drops rare errors; on-call gets paged on CPU/memory noise.
- **At scale (services split, millions of orders/day):** dedicated observability stack (Grafana + Prometheus + Loki + Tempo, or Datadog/Honeycomb). Tail-based trace sampling (keeps 100% of error/slow traces, 1% of success). Error budget burn-rate alerting (multi-window: fast burn = acute outage, slow burn = gradual degradation). SLO dashboard shared with engineering leadership. Log tiering: hot (last 7 days, fast query) → cold (S3/GCS, cheap long-term). Metric cardinality budget enforced — no per-user-id labels in metrics.

---

## 1. The three pillars

### Metrics
- **Numeric, aggregated time series** (counters, gauges, histograms). Cheap to store, fast to query, great for dashboards and alerting.
- Cardinality is the cost driver: each unique label combination is a separate series. High-cardinality labels (user_id, request_id) explode storage — keep labels low-cardinality.
- Types: **counter** (monotonic — requests, errors), **gauge** (point-in-time — queue depth, memory), **histogram/summary** (distributions — latency buckets, enabling percentiles).
- Pull (Prometheus scrapes targets) vs push (StatsD/OTLP (OpenTelemetry Protocol)) collection models.

### Logs
- **Discrete, timestamped event records.** High detail, high cardinality, expensive at scale.
- **Structured logging** (JSON key-values) >> free-text: queryable, aggregatable, joinable with traces via correlation ids.
- Use **log levels** deliberately; include a **correlation/trace id** in every line to stitch a request's journey across services.
- Costly to retain — sample, tier (hot/cold storage), or aggregate.

### Traces
- **Distributed tracing** follows a single request across services as a tree of **spans** (each span = one operation with start/end + attributes), tied together by a **trace id** propagated via headers (W3C Trace Context standard).
- Answers "where did the time go?" and "which hop failed?" across a microservice call graph.
- **Sampling** is essential at scale: **head-based** (decide at request start, cheap, may miss rare errors) vs **tail-based** (decide after seeing the whole trace, keeps the interesting/slow/error traces, more infra).

**Together:** metric tells you *something is wrong*, trace tells you *where*, log tells you *what exactly*. Correlation ids link all three.

---

## 2. The golden signals (what to measure)

The **four golden signals** (Google SRE) for any user-facing service:
1. **Latency** — how long requests take (distinguish success vs error latency; track **percentiles**, not averages).
2. **Traffic** — demand (RPS (requests per second), throughput).
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

- **SLI (Service Level Indicator):** a measured quantity reflecting user happiness, e.g. "proportion of requests served < 300 ms" or "successful-request ratio." Good SLIs are user-centric ratios.
- **SLO (Service Level Objective):** the target for an SLI over a window, e.g. "99.9% of requests succeed over 30 days." Internal goal.
- **SLA (Service Level Agreement):** a *contract* with customers including consequences (refunds/credits) if breached. SLA is usually looser than the SLO (you alert/act before the contract breaks).
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
| SLI (Service Level Indicator) | Measured user-happiness metric (e.g. % requests < 300 ms). |
| SLO (Service Level Objective) | Internal target for an SLI over a time window. |
| SLA (Service Level Agreement) | External customer contract; usually looser than the SLO. |
| Error budget | Allowed unreliability (1 − SLO); a resource to spend on velocity. |
| Burn rate | Speed at which the error budget is being consumed. |
| Tail/head sampling | Decide which traces to keep after / before seeing the full trace. |
| Cardinality explosion | Runaway series count from high-cardinality labels. |
| OTel (OpenTelemetry) | Vendor-neutral SDK/protocol for emitting traces, metrics, and logs. |

---

## 7. Tradeoffs

- **Detail vs cost:** logs/traces are rich but expensive; metrics are cheap but low-detail. Use metrics for breadth + alerting, traces/logs for depth on demand. Sample aggressively.
- **Head vs tail sampling:** head is cheap but may drop the rare error trace you need; tail keeps the interesting traces but needs buffering/infra.
- **Cardinality vs insight:** more labels = more slice-ability but exponential cost; pick dimensions deliberately.
- **Tight vs loose SLOs (Service Level Objectives):** tighter SLOs delight users but shrink the error budget (less room to ship/experiment) and cost more (redundancy). Set SLOs from *user needs*, not vanity nines.
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
- **Golden signals:** Latency, Traffic, Errors, Saturation (saturation = leading indicator). RED (Rate, Errors, Duration) for services, USE (Utilization, Saturation, Errors) for resources.
- **Use percentiles (p95/p99), not averages**; don't average percentiles.
- **SLI (Service Level Indicator)** (measured) → **SLO (Service Level Objective)** (internal target) → **SLA (Service Level Agreement)** (contract). **Error budget = 1 − SLO**; 99.9% ≈ 43 min/month; spend the budget on velocity.
- **Alert on symptoms / budget burn rate**, not on causes; every page actionable + runbook to avoid fatigue.
- **Control cost** with sampling (prefer tail/always-keep-errors) and low metric cardinality.
- **Observability > monitoring:** investigate unknown-unknowns, not just check known thresholds.
