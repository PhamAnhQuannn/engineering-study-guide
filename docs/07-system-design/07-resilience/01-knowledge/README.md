# Resilience Patterns — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Rate limiting, backpressure, circuit breaker, retries.

Resilience is the system's ability to keep working — or degrade gracefully — when dependencies are slow, failing, or overloaded. In distributed systems failure is the norm, not the exception. Senior engineers design for partial failure deliberately: contain it, shed it, and recover automatically, without turning a small problem into a cascading outage.

> **🛒 Where we are in building ShopFast** — [Scaling](../../01-scaling/01-knowledge/README.md) gave us many app nodes, replicas, a [cache](../../02-caching/01-knowledge/README.md), and a payment provider call on checkout. More parts = more things that break. Last week the payment provider slowed to 10s and *every* checkout thread blocked, dragging the whole site down. This topic stops one slow dependency from sinking the ship. **Next:** put the whole playbook together on real problems → [Design Drills](../../07-design-drills/01-knowledge/README.md).

---

## Teaching arc: keeping ShopFast up when things break

### What it is
**Resilience** is designing so that *part* of the system failing doesn't take down the *whole* system. Think of a ship's **watertight compartments**: a hull breach floods one compartment, not the entire vessel, so the ship stays afloat. In software the "breach" is a slow or dead dependency (payment provider, a replica, the cache), and the compartments are timeouts, circuit breakers, and bulkheads that **contain** the damage.

### What it looks like
A **circuit breaker** is the signature pattern — it watches a dependency and "trips" to stop calling a dead one, like a household fuse:

```text
        failures < threshold              failures ≥ threshold
  ┌──────────────────────────┐      ┌──────────────────────────────┐
  │          CLOSED          │ ───▶ │            OPEN              │
  │  (call dependency, count │      │  (fail fast, don't call;     │
  │   failures)              │ ◀─── │   serve fallback)            │
  └──────────────────────────┘      └──────────────┬───────────────┘
            ▲  probe succeeds                       │ cool-off elapsed
            │              ┌──────────────────────┐ │
            └──────────────│      HALF-OPEN       │◀┘
                           │ (allow a few probes) │
                           └──────────────────────┘
```

### The code that builds it
The fragile call vs the resilient one — timeout, circuit breaker, and a fallback wrapped around the payment provider:

```typescript
// ❌ fragile: no timeout → a slow provider blocks this thread forever → cascade
const result = await paymentProvider.charge(order);

// ✅ resilient: bounded wait + circuit breaker + fallback
const breaker = new CircuitBreaker({ timeout: 2000, failureThreshold: 0.5, coolOff: 30_000 });

async function charge(order: Order) {
  return breaker.run(
    () => paymentProvider.charge(order),               // primary, hard-capped at 2s
    () => { queue.enqueue("retryCharge", order);        // fallback when breaker is OPEN:
            return { status: "pending" }; }             // accept order, settle payment async
  );
}
```

### The code that calls it
Retries belong on the *caller* — but only safe (idempotent) ones, with backoff + jitter so a struggling service isn't hammered:

```typescript
// retry an idempotent read with exponential backoff + jitter; bounded attempts
async function withRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); }
    catch (e) {
      if (attempt >= max || !isRetryable(e)) throw e;        // never retry 4xx / non-idempotent
      const backoff = 2 ** attempt * 100;
      await sleep(backoff + Math.random() * backoff);        // jitter: desync the herd
    }
  }
}
// checkout (a WRITE) is only safe to retry because of the Idempotency-Key from the API topic
```

### Types & differences
| Pattern | Stops | Reach for it when |
|---|---|---|
| **Timeout** | unbounded waits | every network call — non-negotiable |
| **Retry + backoff + jitter** | transient blips | idempotent ops only; cap attempts |
| **Circuit breaker** | hammering a dead dependency | a dependency can fail for a while (**ShopFast payments**) |
| **Bulkhead** | one failure starving all threads | isolate critical vs non-critical dependencies |
| **Rate limit / load shed** | overload collapse | protect shared resources, enforce fairness |
| **Backpressure** | unbounded buffering → OOM | a consumer can't keep up with producers |

### Build it for real — ShopFast
The checkout path calls an external payment provider we don't control. A slow provider is *more* dangerous than a down one: down fails instantly, slow holds threads until they're all gone (the outage we had). 

**Decision:** **2s timeout** on the provider call (its p99 is ~800ms), a **circuit breaker** that trips when half of recent calls fail and fails fast for 30s, and a **fallback** that accepts the order as `pending` and settles payment via a queue — so a provider blip degrades to "your order is confirmed, payment processing" instead of a site-wide outage. Retries are safe only because checkout carries the **idempotency key** from the [API topic](../../03-api-design/01-knowledge/README.md). **Rejected:** unbounded retries (would DDoS the recovering provider — a retry storm) and no-fallback fail-fast (correct but still loses the sale).

### Scaling story
- **Now (cheap):** timeouts on every outbound call + idempotent retries with backoff. *Placeholders we leave:* wrap each external dependency in a small client module so a circuit breaker/bulkhead can be added there later without touching callers. Cost: ~zero, it's library code.
- **Growth signal:** one slow dependency starts exhausting shared threads; retry traffic spikes during incidents (storm); a viral product floods one endpoint; the cache going down stampedes the DB.
- **At scale (millions+):** add **circuit breakers + fallbacks** on every external dependency; **bulkhead** thread/connection pools per dependency so checkout can't starve catalog; **rate-limit** at the API gateway (token bucket in Redis — see [Design Drills](../../07-design-drills/01-knowledge/README.md)); apply **backpressure + load shedding** at peak to serve most users well rather than crash. Together these stop the **cascading failure** that scaling's extra hops make more likely.

---

## Timeouts (the foundation)

Every network call **must** have a timeout. Without one, a slow dependency consumes a caller's thread/connection indefinitely, exhausting its resources and propagating the stall upstream.

- Set timeouts based on the dependency's p99 (99th-percentile latency), not optimistic averages.
- **Deadline propagation:** pass a remaining-time budget down the call chain so downstream calls don't exceed the overall request budget.
- A timeout is a *failure signal* — it feeds retries and circuit breakers.

## Retries

Re-attempt a failed/timed-out operation. Powerful but dangerous if naive.

- **Only retry idempotent operations** (or use idempotency keys) — otherwise you duplicate side effects.
- **Exponential backoff:** wait 2ⁿ × base between attempts so you don't hammer a struggling service.
- **Jitter:** randomize backoff so many clients don't retry in lockstep (avoids synchronized retry storms / thundering herd).
- **Cap attempts + total budget:** unbounded retries amplify load and cause **retry storms** that turn a blip into an outage.
- **Retry only retryable errors** (5xx, timeouts, 429-with-Retry-After), never 4xx client errors.

## Circuit Breaker

Wraps a dependency and stops calling it when it's clearly failing, giving it time to recover and failing fast for callers.

- **States:** **Closed** (normal, counting failures) → **Open** (failure threshold tripped; reject immediately for a cool-off period) → **Half-Open** (allow a trickle of probes; if they succeed, close; if they fail, re-open).
- Prevents a caller from wasting resources on a dead dependency and prevents pile-ups that cascade.
- Pair with a **fallback** (cached value, default, degraded response) for the open state.

## Bulkhead

Isolate resources so one failing dependency can't sink the whole ship (named after ship compartments).

- Separate thread pools / connection pools / queues per dependency, so saturation of one (a slow downstream) doesn't starve threads serving others.
- Limits the blast radius of a single failure.

## Rate Limiting & Throttling

Cap the request rate to protect a service (or enforce fairness/quotas).

- **Algorithms:**
  - **Token bucket:** tokens refill at a steady rate; each request consumes one; allows bursts up to bucket size. Most common.
  - **Leaky bucket:** processes at a fixed rate; smooths bursts into a steady outflow.
  - **Fixed window:** count per time window — simple but boundary spikes (2× at window edges).
  - **Sliding window (log/counter):** smooths the fixed-window boundary problem.
- **Where:** at the edge/API gateway (per client/IP/key), and internally to protect shared resources.
- Respond with **429 Too Many Requests** + `Retry-After` + rate-limit headers.

## Backpressure

When a consumer can't keep up, signal upstream to slow down rather than silently buffering until OOM.

- Mechanisms: bounded queues that reject/block when full, flow control (TCP, HTTP/2, reactive streams `request(n)`), returning 503/429.
- The alternative to backpressure is unbounded buffering → memory exhaustion → crash.

## Load Shedding

Under overload, deliberately drop or reject lower-priority work to keep the system alive for high-priority requests.

- Prioritize by request class; shed health-check-failing or excess traffic early.
- Better to serve 90% well than 100% badly (or crash).

## Graceful Degradation & Fallbacks

Provide reduced functionality instead of total failure: serve stale cache, a default, a simplified response, or disable a non-critical feature when its dependency is down.

## Redundancy & Failover

- **Replication** + automatic **failover** (active-passive or active-active) so a node/AZ (Availability Zone)/region loss doesn't take you down.
- **Health checks** drive removal of bad instances; distinguish liveness vs readiness.
- **Idempotency** makes failover/retry safe.

## Cascading failure & how to stop it

A failure spreads when: a slow dependency exhausts caller threads → callers slow/fail → *their* callers exhaust → outage climbs the stack. Defenses combine: **timeouts** (don't wait forever), **circuit breakers** (stop calling the dead), **bulkheads** (contain), **load shedding/backpressure** (shed excess), and **retry budgets + jitter** (don't amplify).

---

## Key terms & definitions

| Term | Definition |
|---|---|
| Timeout | Max time to wait for a call before failing. |
| Exponential backoff | Increasing wait between retries (2ⁿ). |
| Jitter | Randomization added to backoff to desynchronize retries. |
| Circuit breaker | Trips open to stop calling a failing dependency. |
| Half-open | Probe state that tests recovery before fully closing. |
| Bulkhead | Resource isolation limiting failure blast radius. |
| Token bucket | Burst-tolerant rate-limit algorithm. |
| Backpressure | Upstream signal to slow down when overloaded. |
| Load shedding | Dropping low-priority work under overload. |
| Retry storm | Synchronized retries amplifying load into an outage. |
| Graceful degradation | Reduced functionality instead of total failure. |
| Blast radius | Extent of impact from a single failure. |

---

## Tradeoffs

- **Retries improve success but amplify load** — bound them and use backoff+jitter + retry budgets.
- **Aggressive timeouts** fail fast but may abort slow-but-valid work; too-loose timeouts let stalls propagate.
- **Circuit breakers** protect callers but can over-trip (false positives) and reject during transient blips.
- **Rate limiting** protects the service but can reject legitimate bursts — tune limits + allow bursts (token bucket).
- **Load shedding** keeps you alive but drops real users — prioritize carefully.

---

## Common pitfalls & misconceptions

- **No timeouts** → the #1 cause of cascading failure.
- **Retrying non-idempotent operations** → duplicate charges/orders.
- **Retries without backoff/jitter** → retry storms that DDoS your own backend.
- **Circuit breaker without a fallback** → you fail fast but still give users an error.
- **Unbounded queues** → "buffering" that becomes an OOM crash instead of backpressure.
- **Rate limiting only at one layer** → internal hot paths still meltdown.
- **Treating the cache/dependency as always-up** → no degraded mode designed.

---

## What interviewers probe

- "What happens when downstream service X gets slow?" → timeouts + circuit breaker + bulkhead + fallback.
- "How do you retry safely?" → idempotency + backoff + jitter + caps/budget.
- "Explain the circuit breaker states."
- "Token bucket vs leaky bucket vs sliding window — when each?"
- "How do you prevent a cascading failure / retry storm?"
- "What's your degraded mode when the cache/DB/third-party is down?"
- "Backpressure vs load shedding — what's the difference?"

---

## Quick-reference summary

- **Timeouts on every call** are non-negotiable — they stop stalls from propagating.
- **Retry only idempotent ops, with exponential backoff + jitter + a budget/cap** to avoid retry storms.
- **Circuit breaker** (closed→open→half-open) fails fast and lets dependencies recover; always pair with a **fallback**.
- **Bulkheads** contain blast radius; **rate limiting/backpressure/load shedding** shed excess instead of collapsing.
- Design the **degraded mode** explicitly (stale cache, defaults); combine patterns to prevent **cascading failure**.
