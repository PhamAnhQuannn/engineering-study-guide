# Resilience Patterns — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Rate limiting, backpressure, circuit breaker, retries.

Named options, a reasoned recommendation, and "what would change the answer."

---

### DC1. Retry vs fail-fast on a downstream error

**Recommendation:** **Retry (with backoff + jitter, bounded)** for transient, retryable failures (timeouts, 5xx, 429) on **idempotent** operations — it improves success rates over blips. **Fail-fast** for non-retryable errors (4xx), non-idempotent operations without an idempotency key, or when a circuit breaker is open. Default: retry transient errors a few times, then fail fast and surface a fallback.

**What changes it:** Operation is idempotent + error is transient → retry. Non-idempotent without idempotency key → fail-fast (or add a key). Dependency clearly down (breaker open) → fail-fast with fallback.

---

### DC2. Token bucket vs leaky bucket vs sliding window for rate limiting

**Recommendation:** **Token bucket** as the default for APIs — bounds the average rate while allowing controlled bursts (good UX for legitimate spiky clients). **Leaky bucket** when a downstream needs strictly even pacing (no bursts). **Sliding window** when you need accurate per-window counts without fixed-window boundary spikes. Avoid plain fixed window for strict limits (2× burst at window edges).

**What changes it:** Want burst tolerance → token bucket. Protecting a fragile downstream needing smooth flow → leaky bucket. Need precise rolling counts → sliding window.

---

### DC3. Circuit breaker vs just relying on timeouts + retries

**Recommendation:** Use **both** — timeouts/retries handle *individual* call failures; the **circuit breaker** handles *sustained* failure by stopping calls entirely so you don't waste resources retrying a dead dependency and don't trample its recovery. Timeouts alone still let every request pay the full timeout cost during an outage; add a breaker once a dependency's failure can be system-threatening.

**What changes it:** Dependency rarely fails / failures are isolated → timeouts + retries may suffice. Dependency can fail hard and is on a hot path → add a circuit breaker + fallback. Many callers hammering a recovering service → breaker is essential.

---

### DC4. Fail-open vs fail-closed when the rate limiter / auth dependency is down

**Recommendation:** **Fail-open** (allow traffic) for availability-critical, lower-risk paths where rejecting valid users is worse than briefly losing protection — often with a coarse local fallback limit. **Fail-closed** (reject) for security/correctness-critical paths (auth, payment limits) where letting unchecked traffic through is unacceptable. Decide per endpoint by risk, and degrade to a local approximate limiter rather than no limit.

**What changes it:** Limiter protecting against abuse on a public API → fail-open with local fallback. Auth/security or financial guard → fail-closed. Regulatory exposure → fail-closed.

---

### DC5. Backpressure vs load shedding under overload

**Recommendation:** **Backpressure** when you have a controllable producer that can slow down (internal pipelines, streaming) — signal upstream and let it throttle, preserving all work. **Load shedding** when the producer can't be slowed (public traffic, end users) — drop/reject low-priority excess fast to keep the system within SLO. In practice combine: backpressure internally, shed at the edge.

**What changes it:** Producer can throttle (reactive streams, internal services) → backpressure. Uncontrollable external traffic → shed by priority. Hard SLO + can't slow producer → shed.

---

### DC6. Rate limit at the edge/gateway vs inside each service

**Recommendation:** **Edge/gateway** for per-client/quota/abuse limiting — central, before traffic spreads. **Internal** limits to protect *specific shared resources* (a DB connection pool, a fragile downstream) regardless of where traffic came from. Most robust systems do **both**: gateway for fairness/quotas, internal concurrency limits as a last line of defense.

**What changes it:** Per-customer quotas / abuse → edge. Protecting an internal bottleneck from internal callers → in-service limit. Defense in depth → both.

---

### DC7. Bounded queue (reject when full) vs unbounded queue (always accept)

**Recommendation:** **Bounded queue, always** — when full, reject (429/503) or apply backpressure. An **unbounded** queue is an anti-pattern: it hides overload until memory is exhausted and the process crashes, taking everything with it. Bound the queue to roughly one latency-SLO's worth of work and shed beyond that.

**What changes it:** Essentially never choose unbounded for in-memory queues. Durable broker queues (Kafka) can be effectively "unbounded" on disk, but consumers still need backpressure/lag handling — the in-memory caller path must stay bounded.
