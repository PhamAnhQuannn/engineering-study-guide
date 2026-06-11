# Failure Handling — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Partial failure, partitions, timeouts, backoff.

Distributed systems are defined by **partial failure**: some components fail while others keep running, and you often cannot tell *which*. This is the core difference from a single process, where failure is total and observable. A senior engineer's job is to design so that partial failure degrades gracefully instead of cascading into total outage.

> **🛒 Where we are in building ShopFast** — Last topic we mastered [DB Operations](../../../04-databases/05-db-operations/01-knowledge/README.md): reading, writing, and transacting against Postgres. ShopFast now has a working data layer — but what happens when the payment provider goes down at checkout, or a replica stops responding? This topic adds the *resilience skin*: timeouts, retries, circuit breakers, and bulkheads that keep checkout alive even when dependencies fail. **Next:** now that we can survive failures, we must decide what *consistency guarantees* each ShopFast module needs — that's [Consistency & CAP](../../02-consistency-cap/01-knowledge/README.md).

---

## Teaching arc: keeping ShopFast alive when things break

### What it is

**Partial failure** is the defining property of distributed systems: one node, service, or network link dies while everything else keeps running. Unlike a local crash — which is total and visible — a remote failure is *ambiguous*. You called the payment provider and heard nothing back. Did it receive the request and process it? Did it crash before processing? Is it just slow?

Think of it like ordering at a drive-through by walkie-talkie with bad reception. You said "large coffee" and got no reply. Did they hear you? Did they start making it? Do you shout again and risk getting two coffees (and being charged twice)? That ambiguity — and the cost of guessing wrong — is exactly the failure-handling problem.

### What it looks like

The simplest illustration: a timeout converting ambiguity into a decision, paired with a circuit breaker that stops hammering a dying dependency.

```
ShopFast checkout timeline:

POST /v1/orders
│
├─→ [1] call payment provider (2 s timeout)
│     ├─ RESPONDS in 50 ms  → happy path ✓
│     ├─ RESPONDS in 2.1 s  → timeout fires → mark order "pending"
│     └─ DEAD (circuit open) → fail fast in 1 ms → mark order "pending"
│
└─→ queue worker retries settlement later (idempotency key prevents double-charge)

Circuit breaker state machine:
  CLOSED ──(5 failures in 10 s)──→ OPEN ──(30 s cooldown)──→ HALF-OPEN
     ↑                                                              │
     └──────────────── probe succeeds ────────────────────────────┘
```

### The code that builds it

A minimal circuit breaker wrapping ShopFast's payment call. This is the *server-side* guard that protects the checkout path:

```typescript
// server: circuit-breaker wrapper around the payment provider
type State = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  private state: State = "CLOSED";
  private failures = 0;
  private openedAt = 0;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt > 30_000) {
        this.state = "HALF_OPEN";     // cooldown elapsed → probe
      } else {
        throw new Error("circuit open"); // fail fast — no network call
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= 5) {
      this.state = "OPEN";
      this.openedAt = Date.now();  // start cooldown clock
    }
  }
}

const paymentBreaker = new CircuitBreaker();
```

### The code that calls it

The checkout handler: uses the circuit breaker, enforces a hard timeout, and falls back gracefully instead of letting a payment hiccup take down the whole store:

```typescript
// server: checkout handler with timeout + circuit-breaker + fallback
import { promiseWithTimeout } from "./utils"; // rejects after N ms

async function checkout(userId: string, idempotencyKey: string) {
  try {
    // 2 s hard cap on the payment call (ShopFast canonical timeout)
    const result = await promiseWithTimeout(
      paymentBreaker.call(() => paymentProvider.charge(userId, idempotencyKey)),
      2_000
    );
    return { status: "confirmed", ...result };
  } catch {
    // Circuit open or timeout → degrade gracefully
    await orderQueue.enqueue({ userId, idempotencyKey }); // settle async
    return { status: "pending" };  // never 500 the customer
  }
}
```

### Types & differences

| Pattern | One-line | Reach for it when |
|---|---|---|
| **Timeout** | Hard deadline on every call | Always — without it, one slow call holds a thread forever |
| **Retry + backoff + jitter** | Re-attempt with growing, randomised delay | Transient blips on idempotent operations; pair with a retry budget |
| **Circuit breaker** | Fast-fail while a dependency recovers | The dependency has sustained failures; you want to stop the pile-on |
| **Bulkhead** | Separate resource pools per dependency | One slow dependency must not drain all threads/connections |
| **Load shedding** | Reject low-priority work early | Protecting capacity for high-priority requests under overload |
| **Backpressure** | Signal upstream to slow down | Preventing an unbounded queue from converting throughput problems into OOM |
| **Hedged request** | Send to multiple replicas, take first reply | Cutting tail latency on read-heavy, idempotent calls |

### Build it for real — ShopFast

ShopFast's checkout path calls the payment provider synchronously. The payment provider is third-party, sometimes slow, and occasionally down. From the canonical system facts: *"Timeout on every call (payment provider 2 s); circuit breaker + fallback (accept order `pending`, settle via queue); retries only with idempotency + backoff + jitter."*

**Decision:** 2-second hard timeout on every payment call. Circuit breaker (threshold: 5 failures / 10 s, cooldown: 30 s) wraps the provider. On open circuit or timeout, the order lands in `status = pending` and a queue worker retries settlement later using the same `Idempotency-Key` (see [API Design](../../../03-system-design/03-api-design/01-knowledge/README.md) for why the key prevents double-charging).

**Bulkhead:** a separate thread/connection pool for the payment provider so a payment storm cannot exhaust catalog-read threads. The `catalog` browsing path must stay available even while checkout degrades.

**REJECTED — naive retry on checkout:** retrying `POST /charge` without idempotency keys causes double-charges. Retrying at every layer (checkout handler → HTTP client → provider SDK) multiplies load: 3 retries × 3 layers = 27× the original requests during an outage.

> **If you get this wrong:** a payment provider that slows to 5 s response time, with no circuit breaker and 50 concurrent checkouts, fills the web server's thread pool in seconds. Every other endpoint — catalog browsing, cart additions — starts timing out too. A single third-party dependency takes the entire store offline. This is *cascading failure*: the most common cause of total outages in distributed systems.

### Scaling story

- **Now (monolith, ~1,800 peak read QPS):** one timeout + one circuit breaker instance in the process. Cost: essentially free. Placeholders already in place: idempotency keys on payment (prevents double-charge on retry), order status `pending` + queue (enables async settlement). The queue is the escape valve.
- **Growth signal:** p99 (99th-percentile latency) on checkout climbs; circuit breaker trips more than once per day; alert fires on error-budget burn (see [Observability](../../06-observability/01-knowledge/README.md)).
- **At scale (services split):** bulkheads become network-level isolation (separate Kubernetes pods/namespaces per service); circuit breakers move into a service mesh (Istio/Envoy) or library (Resilience4j/Polly). Retry budgets enforced globally. Deadline propagation via gRPC context so a 500 ms top-level budget propagates down the call chain — no downstream call ever waits longer than the upstream caller will.

---

## 1. Core concepts

### The fundamental problem: you cannot distinguish "slow" from "dead"
When node A calls node B and gets no response, A cannot know whether:
- B never received the request (network drop on the way out),
- B processed it but the response was lost (network drop on the way back),
- B is slow (GC pause, overload) and will reply eventually,
- B has crashed.

This ambiguity is the root of nearly every hard distributed-systems bug. **Timeouts convert this ambiguity into a decision**, but the decision can be wrong (you time out a request that actually succeeded → duplicate work).

### The 8 fallacies of distributed computing
Classic list every senior should be able to recite, because each is a design trap:
1. The network is reliable.
2. Latency is zero.
3. Bandwidth is infinite.
4. The network is secure.
5. Topology doesn't change.
6. There is one administrator.
7. Transport cost is zero.
8. The network is homogeneous.

### Failure types
- **Crash-stop (fail-stop):** node halts and stays halted. Easiest to reason about.
- **Crash-recovery:** node crashes, then comes back — possibly with stale state, possibly replaying work.
- **Omission:** messages are dropped (send-omission or receive-omission).
- **Timing/performance:** responses arrive too late to be useful (a "slow" node behaves like a partial failure).
- **Byzantine:** node behaves arbitrarily/maliciously (lies, sends conflicting messages). Rare outside adversarial/blockchain contexts; expensive to tolerate (need 3f+1 nodes to tolerate f Byzantine faults).

### Network partition (split-brain)
A partition splits the cluster into groups that can each talk internally but not across the divide. The danger is **split-brain**: two halves both think they're the leader/authoritative and accept conflicting writes. Mitigations: quorum (majority wins, minority steps down), fencing tokens, and STONITH ("shoot the other node in the head").

---

## 2. How failure handling works under the hood

### Timeouts
Every remote call needs a deadline. Key distinctions:
- **Connection timeout** vs **request/read timeout** vs **overall deadline**.
- **Deadline propagation:** pass the remaining budget down the call chain (gRPC (Google Remote Procedure Call) does this natively). If the top-level request has 500 ms left, a downstream call should not be allowed to wait 2 s. Without propagation you get "work that no one is waiting for" — wasted capacity during overload.
- **Setting the value:** base it on the latency distribution, not the mean. A common heuristic is p99 + headroom, but a too-tight timeout amplifies load (retries) while a too-loose one ties up resources. There is no universally correct value; it's a tradeoff you tune.

### Retries and backoff
Retrying is the first instinct, and it's dangerous when naive:
- **Exponential backoff:** wait `base * 2^attempt`, capped. Prevents hammering a recovering service.
- **Jitter:** add randomness so that N clients that failed simultaneously don't retry in lockstep (a "thundering herd"). *Full jitter* (`random(0, cap)`) is usually best; equal jitter and decorrelated jitter are variants.
- **Retry budgets / token buckets:** cap retries as a *fraction* of total requests (e.g. ≤10%) so retries can't double or triple offered load during an incident. This is more robust than per-request retry counts.
- **Only retry idempotent or safe operations** — or make the operation idempotent (idempotency keys) before retrying. Retrying a non-idempotent `POST /charge` can double-charge.
- **Retry amplification:** in a deep call chain, retries multiply. 3 retries at each of 4 layers = 3⁴ = 81× the original load. Prefer retrying at *one* layer (usually the edge or a single well-chosen tier).

### Circuit breakers
A state machine wrapping a dependency:
- **Closed:** calls flow; failures are counted.
- **Open:** after a failure threshold, calls fail fast (no network call) for a cooldown — protecting both the caller (fast failure, freed threads) and the callee (no pile-on while it recovers).
- **Half-open:** after cooldown, allow a trickle of probe requests; success → close, failure → re-open.

This stops a slow/dead dependency from exhausting the caller's thread pool and cascading.

### Bulkheads
Isolate resources so one failure can't sink the whole ship. Examples: separate connection pools / thread pools per dependency; separate the "checkout" path from the "recommendations" path so a recommendations outage can't consume all threads and take down checkout.

### Load shedding & backpressure
Under overload, you must drop or slow work *deliberately* rather than collapse:
- **Load shedding:** reject excess requests early (return 429/503) to protect the requests you do accept. Prioritize by tier (shed low-value traffic first).
- **Backpressure:** signal upstream to slow down (bounded queues that block/reject, TCP flow control, reactive streams). Unbounded queues are an anti-pattern — they convert a throughput problem into a latency-then-OOM (out-of-memory) problem.

### Failure detection
- **Heartbeats / health checks:** periodic liveness signals. A missed heartbeat is *suspicion*, not proof, of death.
- **Phi-accrual failure detector:** outputs a continuous suspicion level (φ) instead of a binary up/down, adapting to observed network variance (used by Cassandra, Akka).
- **Health check types:** *liveness* (am I alive? restart if not) vs *readiness* (can I serve traffic? remove from LB (load balancer) if not). Conflating them causes restart loops.

---

## 3. Key terms & definitions

| Term | Definition |
|---|---|
| Partial failure | Some components fail while others continue; failure may be invisible to peers. |
| Split-brain | A partition where two sides both act as authoritative, causing divergent state. |
| Fencing token | A monotonically increasing token that lets a resource reject writes from a stale leader. |
| Thundering herd | Many clients retrying/reconnecting simultaneously, overwhelming a recovering service. |
| Cascading failure | One component's failure overloads its callers, which fail and overload theirs, etc. |
| Metastable failure | System stuck in a degraded high-load state that persists even after the trigger is gone (e.g. retry storm sustaining itself). |
| Gray failure | Component appears healthy to its own health check but is failing real requests (differential observability). |
| Idempotency | Performing an operation N times has the same effect as performing it once. |
| Backpressure | Mechanism by which a slow consumer signals producers to slow down. |
| Load shedding | Deliberately rejecting requests to preserve capacity for the rest. |
| Quorum | A majority (or configured threshold) of nodes required to make progress safely. |
| Hedged request | Send the same request to multiple replicas; take the first response to cut tail latency. |

---

## 4. Tradeoffs

- **Timeout tight vs loose:** tight → more false-positive failures and retries (more load); loose → resources held longer, slower failure detection. Tune to the latency distribution and the cost of duplicate work.
- **Retry vs fail fast:** retries improve success rate for transient blips but amplify load during real outages. Retry budgets bound the damage.
- **Fail open vs fail closed:** when a dependency (e.g. authz, fraud check) is down, do you allow the request (fail open — availability, but risk) or block it (fail closed — safety, but outage)? Depends on the security/business stakes.
- **Strong failure detection vs false positives:** aggressive detection evicts slow-but-alive nodes (churn, data movement); lax detection serves stale/dead nodes longer.
- **Redundancy cost vs availability:** more replicas / multi-AZ (Availability Zone) / multi-region buy availability at real money and complexity (consistency gets harder).

---

## 5. Common pitfalls & misconceptions

- **"Retries make things reliable."** Naive retries *cause* outages (retry storms, metastable failures). Always pair with backoff, jitter, budgets, and idempotency.
- **Unbounded queues "absorb" spikes.** They hide backpressure until memory runs out, then you OOM (out-of-memory crash) and lose everything. Bound them.
- **Treating timeout = failure.** A timed-out request may have succeeded server-side. Non-idempotent retries after timeout duplicate effects.
- **One global timeout for all calls.** Different dependencies have different latency profiles; propagate deadlines instead.
- **Health check that only checks `GET /` returns 200.** Gray failures slip through. Health checks should exercise real dependencies (but beware: deep health checks can cause correlated mass-unhealthy events).
- **Ignoring correlated failure.** "We have 3 replicas" means little if all 3 are in one AZ (Availability Zone), share one config push, or depend on one downstream. Failures correlate.
- **Retrying at every layer.** Multiplicative amplification. Pick one retry layer.
- **No jitter.** Synchronized clients create periodic load spikes that look like a DDoS (Distributed Denial of Service) of your own making.

---

## 6. What interviewers probe

- *"A downstream service starts responding in 5 s instead of 50 ms. Walk me through what happens to the rest of the system, and how you'd contain it."* (Looking for: thread-pool exhaustion → cascading failure → circuit breaker + timeout + bulkhead.)
- *"How do you set a timeout? Why not just make it large?"* (Latency distribution, resource holding, deadline propagation.)
- *"Your client retries on failure. What could go wrong at scale?"* (Retry storms, amplification, idempotency, budgets, jitter.)
- *"Network partition between two DCs — how do you avoid split-brain?"* (Quorum, fencing, CAP (Consistency, Availability, Partition-tolerance) tradeoff: choose C or A.)
- *"What's a metastable failure and how do you get out of one?"* (Self-sustaining overload; recovery needs shedding load / breaking the feedback loop, not just removing the trigger.)
- *"Fail open or fail closed for your auth dependency?"* (Reasoning about safety vs availability stakes.)

---

## 7. Quick-reference summary

- **You can't tell slow from dead** → timeouts force a (sometimes wrong) decision → make operations idempotent.
- **Timeouts:** per-dependency, based on latency distribution, with **deadline propagation**.
- **Retries:** exponential backoff + **jitter** + **retry budget**; only on idempotent ops; retry at one layer.
- **Circuit breaker:** closed → open → half-open; fail fast to stop cascades.
- **Bulkheads:** isolate pools so one dependency can't drain all resources.
- **Overload:** **shed load** (reject early) and apply **backpressure** (bounded queues); never unbounded queues.
- **Partitions:** quorum + fencing tokens to prevent split-brain.
- **Failure detection:** heartbeats/phi-accrual; separate liveness vs readiness; watch for **gray failure**.
- **Beware:** retry amplification, thundering herds, metastable failures, correlated failures.
