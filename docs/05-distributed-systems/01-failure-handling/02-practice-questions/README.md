# Failure Handling — Practice Questions

[← Topic overview](../README.md)

> Topic: Partial failure, partitions, timeouts, backoff.

A mix of recall, "explain to a junior," and multiple-choice. Answers are complete and senior-level.

---

### Q1. Why is partial failure the defining property of distributed systems?

**Answer:** In a single process, failure is total and observable — the process is either running or it crashed, and you know which. In a distributed system, one node can fail while others keep running, and a caller frequently *cannot tell* whether a callee crashed, is slow, or simply had its response lost on the network. This ambiguity ("can't distinguish slow from dead") is the source of most hard distributed bugs: you can't make a clean local decision because you have incomplete, possibly stale, information about remote state. Every reliability mechanism — timeouts, retries, quorums, failure detectors — exists to cope with this ambiguity.

---

### Q2. Explain timeouts and deadline propagation to a junior.

**Answer:** A timeout is the maximum time you'll wait for a remote call before giving up. You need one on *every* network call, because without it a slow dependency can tie up your thread/connection forever, and those held resources eventually exhaust and take you down too.

Deadline propagation means passing the *remaining* time budget down the call chain. If a user request has a 500 ms budget and you've already spent 300 ms, the next call downstream should be told "you have 200 ms," not given a fresh independent timeout. Otherwise you do work that nobody is waiting for anymore — the user already got an error, but your servers are still busy computing a response that will be thrown away. gRPC propagates deadlines automatically; in other stacks you pass the budget explicitly.

---

### Q3. What is a retry storm, and how do you prevent one?

**Answer:** A retry storm is when a dependency slows down or fails, all its clients start retrying, and the *added* retry traffic keeps the dependency overloaded so it never recovers — a self-sustaining (metastable) failure. Prevention:
- **Exponential backoff with jitter** so retries spread out instead of arriving in synchronized waves.
- **Retry budgets** (e.g. retries capped at 10% of total requests) so retry traffic can't multiply offered load.
- **Circuit breakers** that fail fast when a dependency is clearly down, removing retry pressure entirely.
- **Retry at one layer only**, because retrying at every layer of a deep call chain multiplies load (3 retries × 4 layers = 81×).

---

### Q4. Distinguish liveness and readiness health checks. What breaks if you conflate them?

**Answer:** *Liveness* answers "is this process alive?" — if it fails, the orchestrator restarts the pod. *Readiness* answers "can this process serve traffic right now?" — if it fails, the load balancer stops routing to it but does **not** restart it. Conflating them is dangerous: e.g. if a pod is temporarily unable to serve because a downstream dependency is slow, a readiness failure correctly pulls it from the LB until the dependency recovers. But if that same check is wired as *liveness*, the orchestrator restarts the pod — and since the dependency is still down, the fresh pod also fails, causing a restart loop that worsens the outage and loses warm caches/in-flight work.

---

### Q5. What is split-brain and how do quorums and fencing tokens prevent it?

**Answer:** Split-brain happens during a network partition when both sides of the divide believe they are the authoritative leader and each accepts writes, producing divergent, conflicting state that's painful to reconcile. **Quorum** prevents it by requiring a majority to make progress: only the partition containing >N/2 nodes can elect a leader and accept writes; the minority side steps down (becomes read-only or unavailable). **Fencing tokens** add a second layer: each leader is issued a monotonically increasing token; shared resources (a storage layer, a lock service) reject any write carrying a token lower than the highest they've seen — so even a stale leader that *thinks* it's still in charge gets its writes rejected.

---

### Q6. When should you fail open vs fail closed?

**Answer:** When a dependency you call is down, *failing open* means proceeding without it (favoring availability); *failing closed* means blocking the request (favoring safety/correctness). The choice is risk-driven:
- **Fail closed** for security/financial integrity: if a fraud-check or payment-authorization service is down, allowing the transaction could be catastrophic.
- **Fail open** for non-critical enrichment: if a personalization/recommendations service is down, serve the page without recommendations rather than erroring.

The senior move is to make this an explicit, documented decision per dependency, not an accident of how the code happens to handle exceptions.

---

### Q7. Why are unbounded queues an anti-pattern under overload?

**Answer:** An unbounded queue looks like it "absorbs" traffic spikes, but it actually hides the problem until it's catastrophic. When producers outpace consumers, the queue grows without limit: latency climbs (items wait longer and longer behind a growing backlog), and eventually memory is exhausted and the process OOM-crashes — losing the *entire* backlog at once. A **bounded** queue instead applies backpressure: when full, it blocks or rejects producers, which propagates the "slow down" signal upstream and lets you shed load in a controlled way. You want to fail a few requests early rather than collapse entirely later.

---

### Q8. What is a gray failure? Why is it hard to detect?

**Answer:** A gray failure is when a component appears healthy to its own monitoring/health check but is actually failing real requests — for example, a node that answers `GET /healthz` with 200 instantly but times out on actual queries because a disk is degraded or a connection pool is exhausted for the real workload. It's hard to detect because of **differential observability**: the system's view of itself differs from its users' view. Detection requires checking from the *caller's* perspective (real request success rates, client-side error metrics) rather than trusting shallow self-reported health.

---

### Q9 (MCQ). Which jitter strategy is generally recommended for retry backoff?

A. No jitter — pure exponential is deterministic and easy to reason about
B. Full jitter — `sleep = random(0, base * 2^attempt)` capped
C. Fixed delay with no exponential growth
D. Maximum jitter only on the first retry

**Answer: B.** Full jitter spreads retries across the whole window, best de-correlating synchronized clients and minimizing both collisions and total completion time in AWS's well-known analysis. No jitter (A) causes synchronized retry waves (thundering herd). Fixed delay (C) doesn't relieve a recovering service. (D) only de-correlates one attempt.

---

### Q10 (MCQ). A downstream service's p99 latency jumps from 50 ms to 5 s. Without protection, the *first* thing to fail in the caller is typically:

A. The database
B. The caller's thread/connection pool (exhaustion)
C. DNS resolution
D. The load balancer's TLS termination

**Answer: B.** Threads/connections block waiting on the slow dependency; with a fixed pool they all get consumed, so the caller can't serve *any* request — a cascading failure. This is exactly what circuit breakers, timeouts, and bulkheads exist to prevent.

---

### Q11 (MCQ). You retry a `POST /payments` after a timeout, but the original request actually succeeded server-side. The clean fix is:

A. Increase the timeout so it never expires
B. Make the endpoint idempotent via an idempotency key the server deduplicates on
C. Never retry payments at all
D. Add more retries with backoff

**Answer: B.** The ambiguity (timeout ≠ failure) is inherent; the durable fix is idempotency. The client sends a stable idempotency key; the server records it and returns the prior result on a duplicate, so the retry is safe. (A) just moves the boundary; (C) gives up on transient-failure recovery; (D) makes duplication *more* likely.

---

### Q12. Explain a metastable failure and how recovery differs from a normal outage.

**Answer:** A metastable failure is a system stuck in a degraded, high-load stable state that *persists even after the original trigger is gone*, because a feedback loop now sustains it. Classic example: a brief latency blip triggers retries; retries add load; added load keeps latency high; high latency keeps retries firing. Removing the original trigger doesn't help — the loop is self-sustaining. Recovery therefore requires **breaking the feedback loop**, not just fixing the trigger: shed load aggressively (return 429s), drop retries (open circuit breakers, flush retry queues), or temporarily scale capacity to outrun the loop. Once the loop is broken and the system returns to a healthy stable state, you can restore normal traffic. Prevention is better: retry budgets, backpressure, and load shedding stop the loop from forming.
