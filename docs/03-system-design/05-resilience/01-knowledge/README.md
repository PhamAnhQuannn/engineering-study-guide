# Resilience Patterns — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Rate limiting, backpressure, circuit breaker, retries.

Resilience is the system's ability to keep working — or degrade gracefully — when dependencies are slow, failing, or overloaded. In distributed systems failure is the norm, not the exception. Senior engineers design for partial failure deliberately: contain it, shed it, and recover automatically, without turning a small problem into a cascading outage.

---

## Timeouts (the foundation)

Every network call **must** have a timeout. Without one, a slow dependency consumes a caller's thread/connection indefinitely, exhausting its resources and propagating the stall upstream.

- Set timeouts based on the dependency's p99, not optimistic averages.
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

- **Replication** + automatic **failover** (active-passive or active-active) so a node/AZ/region loss doesn't take you down.
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
