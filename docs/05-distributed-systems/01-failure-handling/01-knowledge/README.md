# Failure Handling — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Partial failure, partitions, timeouts, backoff.

Distributed systems are defined by **partial failure**: some components fail while others keep running, and you often cannot tell *which*. This is the core difference from a single process, where failure is total and observable. A senior engineer's job is to design so that partial failure degrades gracefully instead of cascading into total outage.

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
- **Deadline propagation:** pass the remaining budget down the call chain (gRPC does this natively). If the top-level request has 500 ms left, a downstream call should not be allowed to wait 2 s. Without propagation you get "work that no one is waiting for" — wasted capacity during overload.
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
- **Backpressure:** signal upstream to slow down (bounded queues that block/reject, TCP flow control, reactive streams). Unbounded queues are an anti-pattern — they convert a throughput problem into a latency-then-OOM problem.

### Failure detection
- **Heartbeats / health checks:** periodic liveness signals. A missed heartbeat is *suspicion*, not proof, of death.
- **Phi-accrual failure detector:** outputs a continuous suspicion level (φ) instead of a binary up/down, adapting to observed network variance (used by Cassandra, Akka).
- **Health check types:** *liveness* (am I alive? restart if not) vs *readiness* (can I serve traffic? remove from LB if not). Conflating them causes restart loops.

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
- **Redundancy cost vs availability:** more replicas / multi-AZ / multi-region buy availability at real money and complexity (consistency gets harder).

---

## 5. Common pitfalls & misconceptions

- **"Retries make things reliable."** Naive retries *cause* outages (retry storms, metastable failures). Always pair with backoff, jitter, budgets, and idempotency.
- **Unbounded queues "absorb" spikes.** They hide backpressure until memory runs out, then you OOM and lose everything. Bound them.
- **Treating timeout = failure.** A timed-out request may have succeeded server-side. Non-idempotent retries after timeout duplicate effects.
- **One global timeout for all calls.** Different dependencies have different latency profiles; propagate deadlines instead.
- **Health check that only checks `GET /` returns 200.** Gray failures slip through. Health checks should exercise real dependencies (but beware: deep health checks can cause correlated mass-unhealthy events).
- **Ignoring correlated failure.** "We have 3 replicas" means little if all 3 are in one AZ, share one config push, or depend on one downstream. Failures correlate.
- **Retrying at every layer.** Multiplicative amplification. Pick one retry layer.
- **No jitter.** Synchronized clients create periodic load spikes that look like a DDoS of your own making.

---

## 6. What interviewers probe

- *"A downstream service starts responding in 5 s instead of 50 ms. Walk me through what happens to the rest of the system, and how you'd contain it."* (Looking for: thread-pool exhaustion → cascading failure → circuit breaker + timeout + bulkhead.)
- *"How do you set a timeout? Why not just make it large?"* (Latency distribution, resource holding, deadline propagation.)
- *"Your client retries on failure. What could go wrong at scale?"* (Retry storms, amplification, idempotency, budgets, jitter.)
- *"Network partition between two DCs — how do you avoid split-brain?"* (Quorum, fencing, CAP tradeoff: choose C or A.)
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
