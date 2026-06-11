# Resilience Patterns — Practice Questions

[← Topic overview](../README.md)

> Topic: Rate limiting, backpressure, circuit breaker, retries.

Mix of recall, "explain to a junior," and MCQs.

---

### Q1. Why must every network call have a timeout?

**Answer:** Without a timeout, a slow or hung dependency holds the caller's thread/connection open indefinitely. As requests pile up, the caller exhausts its thread pool / connection pool and itself becomes slow or unavailable — and *its* callers do the same, climbing the stack into a **cascading failure**. A timeout converts an indefinite hang into a fast, bounded failure you can handle (retry, circuit break, fall back). Set it based on the dependency's p99, and propagate a deadline so downstream calls respect the overall budget.

---

### Q2. Explain the circuit breaker pattern and its three states.

**Answer:** A circuit breaker wraps a dependency and stops calling it when it's clearly failing. **Closed** = normal operation; it counts failures. When failures cross a threshold it trips to **Open** = reject calls immediately (fail fast) for a cool-off period, sparing the caller and the struggling dependency. After the cool-off it goes **Half-Open** = allow a few probe requests; if they succeed it returns to Closed, if they fail it re-Opens. It prevents wasting resources on a dead dependency and stops pile-ups from cascading. Always pair it with a fallback for the open state.

---

### Q3. How do you retry safely? Name the four things you must get right.

**Answer:** (1) **Idempotency** — only retry idempotent operations, or use idempotency keys, so retries don't duplicate side effects. (2) **Exponential backoff** — increase the wait between attempts so you don't hammer a recovering service. (3) **Jitter** — randomize the backoff so many clients don't retry in lockstep (avoiding a synchronized retry storm). (4) **Caps / retry budget** — limit attempts and total retry volume so retries can't amplify load into a self-inflicted DDoS. Also: only retry retryable errors (5xx/timeouts), never 4xx.

---

### Q4. Explain backpressure to a junior. How does it differ from just buffering?

**Answer:** Backpressure is a fast consumer telling a slow-down signal back to the producer: "I'm full, slow down." Picture a checkout line where the cashier raises a hand to stop more people joining until they catch up. Plain **buffering** instead keeps accepting work into a queue — but an *unbounded* queue grows until it exhausts memory and the process crashes. Backpressure uses **bounded** queues that reject/block when full, or flow-control mechanisms (TCP windows, HTTP/2, reactive `request(n)`), so the system stays stable under overload instead of melting down.

---

### Q5. Token bucket vs leaky bucket — what's the difference?

**Answer:** **Token bucket:** tokens refill at a fixed rate into a bucket of capacity N; each request consumes a token; requests are allowed as long as tokens exist. This permits **bursts** up to N while bounding the average rate. **Leaky bucket:** requests enter a queue and are processed (leak out) at a fixed rate, **smoothing** bursts into a steady outflow (excess overflows/drops). Token bucket is burst-friendly (good for APIs that should tolerate short spikes); leaky bucket enforces a strict steady rate (good for protecting a downstream that needs even pacing).

---

### Q6. What is a retry storm and how do you prevent it?

**Answer:** A retry storm is when many clients retry a failing service simultaneously — often in lockstep right after a blip — multiplying load and pushing a recovering service back over the edge (or DDoSing your own backend). Prevention: **exponential backoff** (spread retries over time), **jitter** (desynchronize clients), **bounded attempts + a retry budget** (cap the total retry traffic as a fraction of normal), and **circuit breakers** (stop retrying a clearly-dead dependency). Together these ensure retries help recovery instead of amplifying the outage.

---

### Q7. What is the bulkhead pattern and what does it protect against?

**Answer:** Bulkheads isolate resources (separate thread pools, connection pools, or queues per dependency) so that saturation of one dependency can't consume all the shared resources and starve everything else. Named after watertight ship compartments: a breach in one doesn't sink the ship. Example: if calls to a slow third-party share the same thread pool as your core DB calls, the slow third-party can exhaust all threads and take down DB-served traffic too. A dedicated pool for the third-party contains the blast radius.

---

### Q8. The cache (Redis) goes down. How do you keep the system resilient?

**Answer:** Wrap cache calls in a **circuit breaker** so they fail fast instead of timing out (avoiding thread pile-up). Provide a **fallback** to the origin DB, but protect the DB with **single-flight** and ensure it has **headroom** for the miss surge (or shed/limit traffic). Run Redis **HA** (replica + Sentinel/cluster) to avoid total loss in the first place, and **warm gradually** on recovery to avoid a thundering herd. The principle: design the degraded mode deliberately rather than assuming the cache is always up.

---

### Q9 (MCQ). Which operation is safe to automatically retry without extra safeguards?

A. POST /charges (create a payment)
B. GET /orders/42
C. POST /orders (create an order)
D. PATCH /profile

**Answer: B.** GET is idempotent and side-effect-free, so retries are safe. The POST/PATCH writes need idempotency keys to be retry-safe.

---

### Q10 (MCQ). A circuit breaker in the Half-Open state will:

A. Reject all requests immediately
B. Allow all requests through normally
C. Allow a limited number of probe requests to test recovery
D. Permanently disable the dependency

**Answer: C.** Half-open sends a trickle of probes; success closes the breaker, failure re-opens it.

---

### Q11 (MCQ). The correct HTTP response when a client exceeds its rate limit is:

A. 500 with no headers
B. 429 with a Retry-After header
C. 403 Forbidden
D. 200 with an empty body

**Answer: B.** 429 Too Many Requests plus Retry-After tells the client to back off and when to try again.

---

### Q12 (MCQ). The main risk of an *unbounded* in-memory queue used to "absorb" load is:

A. It increases cache hit rate
B. It can grow until the process runs out of memory and crashes
C. It enforces strict ordering
D. It reduces latency under all conditions

**Answer: B.** Unbounded buffering defers the problem until OOM. Bounded queues + backpressure are the resilient choice.

---

### Q13. Walk through how a single slow dependency can cause a full outage, and which patterns stop it.

**Answer:** A downstream dependency slows to, say, 5 s per call. Callers without timeouts wait the full 5 s, so their threads stay busy; as traffic continues, the caller's thread/connection pool fills, and it can no longer serve *any* request — including ones not using that dependency. Its upstream callers then experience the same stall, and the failure **cascades** up the stack into a full outage. Stopping it: **timeouts** (cap the wait so threads free up), **bulkheads** (isolate the slow dependency's pool so other traffic is unaffected), a **circuit breaker** (stop calling the slow dependency entirely and fail fast with a fallback), and **load shedding/backpressure** (reject excess so the caller doesn't drown). The combination contains the blast radius to just the affected feature.
