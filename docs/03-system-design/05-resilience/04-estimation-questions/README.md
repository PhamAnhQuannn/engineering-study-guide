# Resilience Patterns — Estimation Questions

[← Topic overview](../README.md)

> Topic: Rate limiting, backpressure, circuit breaker, retries.

State assumptions, show order-of-magnitude math, give the estimate.

---

## E1. Retry amplification: how much extra load do retries add under partial failure?

**Assumptions**
- Baseline 10,000 RPS to a dependency. It starts failing 20% of requests. Policy: up to 3 attempts (1 original + 2 retries), only on failure.

**Math**
- Failures eligible for retry = 20% × 10,000 = 2,000.
- Retry 1 = 2,000; of those, 20% fail again → retry 2 = 400.
- Extra load = 2,000 + 400 = **~2,400 extra RPS** → total **~12,400 RPS** (~24% amplification).
- If failure rate climbs to 50%: extra ≈ 5,000 + 2,500 = 7,500 → total 17,500 (**75% amplification**) — exactly when the dependency is weakest.

**Estimate:** Retries add ~**24% load at 20% failure, ~75% at 50% failure** — amplification grows as the dependency degrades. This is why you need a **retry budget** (cap retries to, say, 10% of base traffic) and a **circuit breaker** to cut retries when failure is high.

---

## E2. Timeout-induced thread exhaustion: when does a caller collapse?

**Assumptions**
- Caller has a thread pool of 200. A downstream normally responds in 50 ms; it degrades to 5 s. Incoming rate 1,000 RPS.

**Math**
- Threads in use = arrival rate × service time (Little's Law). Normal: 1,000 × 0.05 = **50 threads** (fine, 200 pool).
- Degraded (5 s, no timeout): 1,000 × 5 = **5,000 threads needed** vs 200 available → pool exhausted in ~0.2 s; caller stops serving *all* requests.
- With a **500 ms timeout**: threads = 1,000 × 0.5 = **500 needed** — still over 200, but far less; with timeout 200 ms → 200 needed (at the edge).

**Estimate:** Without a timeout the caller collapses almost instantly (needs 5,000 threads, has 200). A tight timeout (≤200 ms here) keeps thread usage within the pool. This quantifies why **timeouts are the foundation** — they bound concurrency via Little's Law.

---

## E3. Token bucket sizing for an API allowing short bursts

**Assumptions**
- Limit: 100 req/min sustained per client = ~1.67 req/s refill. Want to allow a burst of up to 20 requests at once (e.g., a page that fires several calls).

**Math**
- Refill rate = 100/60 ≈ **1.67 tokens/sec**.
- Bucket capacity = desired burst = **20 tokens**.
- Time to refill a fully-drained bucket = 20 / 1.67 ≈ **12 s**.

**Estimate:** Configure **capacity = 20, refill = 1.67/s**. This permits a 20-request burst, then throttles to ~100/min sustained, refilling the burst allowance over ~12 s. The capacity controls burstiness; the refill rate controls the long-run average.

---

## E4. Circuit breaker cool-off: failed requests avoided while open

**Assumptions**
- A dependency is fully down for 60 s. Caller traffic = 2,000 RPS. Breaker opens after detecting failure and stays open with a 10 s cool-off, half-open probing periodically.

**Math**
- Without a breaker: all 2,000 RPS × 60 s = **120,000 requests** each wait for a timeout (say 1 s) → 120k wasted thread-seconds, likely caller collapse.
- With breaker open: after the first ~few hundred failures trip it, the remaining ~60 s of traffic (≈ 2,000 × ~55 s = **~110,000 requests**) **fail fast** (sub-ms) with a fallback instead of blocking on timeouts.

**Estimate:** The breaker converts ~**110,000 slow, thread-blocking failures into instant fast-fails** during the outage, preserving caller capacity and enabling a fallback. It also lets the dependency recover untrampled, then closes via half-open probes.

---

## E5. Load-shedding threshold: at what queue depth do you start dropping?

**Assumptions**
- Service processes 1,000 RPS. Bounded request queue. Target p99 latency budget = 500 ms. Each queued request waits ≈ queue_depth / throughput before processing.

**Math**
- Max tolerable wait = 500 ms. At 1,000 RPS, wait = depth / 1,000.
- Depth for 500 ms wait = 0.5 × 1,000 = **500 requests**.
- So set the queue cap ≈ 500; beyond that, latency SLO is already blown → **shed** (return 503) rather than queue further.

**Estimate:** Cap the queue at ~**500 requests** (one SLO's worth of work). Past that, additional requests can't meet the latency budget anyway, so **shed them fast** instead of buffering — this keeps served requests within SLO and prevents the unbounded-queue → OOM failure mode. Tune with a safety margin (e.g., shed at ~400).
