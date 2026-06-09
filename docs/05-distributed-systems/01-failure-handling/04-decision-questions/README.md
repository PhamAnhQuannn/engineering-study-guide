# Failure Handling — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Partial failure, partitions, timeouts, backoff.

Each prompt names concrete options, gives a reasoned recommendation, and states **what would change the answer.**

---

### Dec1. Retry in the client vs retry in the service mesh/gateway vs no retries

- **A — Client retries:** closest to the user, knows the business intent (can pick idempotent ops).
- **B — Mesh/gateway retries:** uniform policy, centrally tunable, easy to add retry budgets.
- **C — No retries:** simplest; push responsibility to the user/upstream.

**Recommendation:** Retry at **exactly one layer**, and prefer the **mesh/gateway (B)** for internal RPC because you get consistent budgets, backoff, and breaker integration without every team reinventing it. Keep client retries (A) only for the *edge* (user → edge), since that hop has no mesh. Never stack retries at multiple internal layers (multiplicative amplification).

**What would change the answer:** If operations aren't uniformly idempotent, the mesh can't safely retry them blindly → push retry decisions to the client (A) where intent is known, or gate mesh retries on a method-level "retriable" annotation.

---

### Dec2. Circuit breaker vs aggressive timeouts alone

- **A — Timeouts only:** each call fails after T; simple.
- **B — Timeouts + circuit breaker:** after enough failures, fail *instantly* without even attempting the call.

**Recommendation:** **B.** Timeouts alone still let every request pay the full timeout cost during an outage, holding threads for T each — under high RPS that's enough to exhaust the pool. A breaker fails fast once the dependency is clearly down, freeing resources and relieving the struggling callee. Use both: timeout bounds individual calls; breaker bounds *aggregate* exposure.

**What would change the answer:** For very low-RPS calls or rare batch jobs, the breaker's benefit is marginal and its added state/complexity may not be worth it; a timeout + a couple of retries suffices.

---

### Dec3. Fail open vs fail closed for a dependency that's down

- **A — Fail open:** proceed without the dependency.
- **B — Fail closed:** reject the request.

**Recommendation:** Decide **per dependency by stakes.** Fail **closed** for integrity-critical checks (payment auth, fraud, authorization) where wrongly allowing is worse than an outage. Fail **open** for enrichment (recommendations, A/B config, analytics) where a degraded-but-working page beats an error.

**What would change the answer:** Regulatory or financial-loss exposure pushes toward fail-closed even for normally-soft dependencies; a business decision that "any downtime loses more money than the risk" pushes toward fail-open with compensating controls (e.g. cap exposure, reconcile later).

---

### Dec4. Bounded queue (reject on full) vs unbounded queue (absorb) vs no queue (synchronous)

- **A — Bounded:** backpressure; reject/return 503 when full.
- **B — Unbounded:** never rejects… until OOM.
- **C — No queue:** caller blocks synchronously.

**Recommendation:** **A — bounded**, essentially always. It converts overload into controlled, early rejection (load shedding) instead of latency creep then catastrophic OOM. Size the bound from your latency SLO and consumer throughput, and attach a per-item deadline so stale items are dropped.

**What would change the answer:** Nothing makes B correct in production; the only nuance is *where* to bound (in-memory vs a durable broker like Kafka, which is "bounded" by retention/disk and provides replay). For strict request/response with no buffering value, C (no queue) plus a concurrency limit can be simpler.

---

### Dec5. Synchronous request/response vs async via durable queue for a flaky downstream

- **A — Sync RPC** with retries/breaker.
- **B — Async:** enqueue to a durable broker, process with retries + DLQ.

**Recommendation:** If the caller doesn't need the result *inline* (e.g. "send email," "kick off provisioning"), go **async (B)**: the broker decouples availability, absorbs spikes, and lets you retry on your own schedule with a dead-letter queue for poison messages. If the user is waiting on the result (e.g. a price quote), you need **sync (A)** — async would force an awkward polling/callback UX.

**What would change the answer:** Strong end-to-end latency requirements force sync. Conversely, if the downstream is frequently down or rate-limited, even a "synchronous-feeling" flow benefits from async + websocket/poll for the result.

---

### Dec6. Active-passive (failover) vs active-active for HA

- **A — Active-passive:** standby takes over on failure; simpler consistency.
- **B — Active-active:** all replicas serve; better utilization and instant capacity.

**Recommendation:** **Active-active (B)** for stateless tiers always — no idle capacity, no failover delay. For *stateful* systems, active-passive (A) is often the pragmatic default because active-active multi-writer needs conflict resolution or cross-region consensus (latency cost). Use active-active state only when you can afford the consistency model (regional homing or a globally-replicated store).

**What would change the answer:** A hard requirement for zero-RTO writes across regions, plus tolerance for eventual consistency or willingness to pay cross-region quorum latency, justifies active-active state. Tight cost constraints or simple consistency needs favor active-passive.

---

### Dec7. Hedged requests (send to 2+ replicas, take first) vs single request with retry

- **A — Hedging:** issue a backup request if the first is slow past p95; take the winner.
- **B — Single + retry:** one request, retry on failure/timeout.

**Recommendation:** Use **hedging (A)** to crush *tail latency* on read-mostly, idempotent paths where a slow replica (not a dead one) is the problem — it directly attacks p99. Use **retry (B)** for transient *failures*. They solve different problems; hedging targets slowness, retry targets failure.

**What would change the answer:** Hedging adds load (extra requests) — under capacity pressure it can backfire, so cap the hedge fraction. For non-idempotent or expensive operations, hedging is unsafe/wasteful → retry only.
