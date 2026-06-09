# Resilience Patterns — System Design Questions

[← Topic overview](../README.md)

> Topic: Rate limiting, backpressure, circuit breaker, retries.

Structured prompts: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## D1. Design a distributed rate limiter for a public API

**Requirements / Scale**
- Enforce per-API-key limits (e.g., 1,000 req/min) across a fleet of stateless gateway nodes. 10k keys, ~17k RPS aggregate ceiling. Must be accurate-ish, low-latency (<1 ms overhead), and fail open or closed by policy.

**High-level design**
- **Token bucket** per key (allows bursts), state in **Redis** so all gateway nodes share one view.
- Each request: atomic Lua script in Redis decrements tokens + refills based on elapsed time; reject with **429 + Retry-After** if empty.
- Optionally a **local L1** token cache per node (approximate) to cut Redis hops for hot keys, reconciled periodically.

**Data model**
- `rl:{key}` → `{tokens, last_refill_ts}` in Redis (hash); ~50 bytes/key → sub-MB total.

**Scaling & bottlenecks**
- Redis is the shared counter → single hot key per high-traffic client; mitigate with local L1 + sharded counters.
- ~2 Redis ops/request at 17k RPS ≈ 34k ops/s — fine for one node; cluster if needed.

**Tradeoffs & failure modes**
- Accuracy vs latency: local L1 is faster but approximate (slight over-allowance).
- **Fail-open vs fail-closed** if Redis is down: fail-open keeps the API available but unprotected; fail-closed protects backends but rejects valid traffic. Choose per risk (usually fail-open with a local fallback limit).
- Fixed-window alternative is simpler but has boundary spikes — prefer token/sliding window.

---

## D2. Design resilient calls to an unreliable third-party (payment processor)

**Requirements / Scale**
- Your checkout calls an external processor that occasionally times out or returns 5xx. Must not double-charge, must degrade gracefully, must recover automatically.

**High-level design**
- **Timeout** on every call (set to processor p99 + margin).
- **Retries** with exponential backoff + jitter, **bounded** (e.g., 3 attempts), only on timeouts/5xx — and only safe because each charge carries an **idempotency key** (no double charge).
- **Circuit breaker** around the processor: trips open on sustained failures, fails fast, half-opens to probe recovery.
- **Bulkhead:** dedicated thread/connection pool so processor slowness can't starve the rest of checkout.
- **Fallback:** queue the payment for async retry + tell the user "processing," rather than hard-failing the order.

**Data model**
- `payment_attempts(idempotency_key UNIQUE, status, processor_ref, attempts, next_retry_at)`.

**Scaling & bottlenecks**
- Async retry queue absorbs processor outages; workers drain with backoff.
- Idempotency store on the hot path must be fast + consistent.

**Tradeoffs & failure modes**
- Open breaker → some payments deferred (async) rather than instantly confirmed — acceptable degraded mode.
- Idempotency window expiry → document and reconcile.
- Poison/permanently-failing payments → dead-letter + manual review.

---

## D3. Design overload protection for a service facing a traffic spike (flash sale)

**Requirements / Scale**
- Steady 1k RPS, sale drives 10–20k RPS in seconds. Must stay up; prefer serving most users well over crashing for all.

**High-level design**
- **Rate limiting** at the edge (per IP/user) to cap abusive/bot traffic.
- **Load shedding** by priority: shed/queue low-value requests (e.g., recommendations) to protect the critical checkout path; return 503 + Retry-After for shed traffic.
- **Backpressure:** bounded queues; when full, reject fast rather than buffering to OOM.
- **Autoscaling** pre-warmed (scheduled) for the known event + reactive buffer.
- **Async** the heavy work (order placement → queue → workers) so the request path stays fast.
- **Circuit breakers** on downstreams so a saturated dependency doesn't cascade.

**Data model**
- Priority/class tag per request; queue with bounded depth; metrics on queue depth + shed rate.

**Scaling & bottlenecks**
- The stateful tier (DB writes, inventory) is the real wall → cache reads, queue writes, optimistic concurrency on stock.
- Scale-up lag vs the seconds-long spike → pre-warm, don't rely solely on reactive autoscaling.

**Tradeoffs & failure modes**
- Shedding drops real users → prioritize transparently (queue page / "try again").
- Over-aggressive rate limits block legitimate buyers → tune + allow bursts (token bucket).
- Inventory oversell under contention → reserve with atomic decrement / conditional update.
