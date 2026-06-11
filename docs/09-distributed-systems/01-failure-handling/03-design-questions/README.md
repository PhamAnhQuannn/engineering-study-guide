# Failure Handling — System Design Questions

[← Topic overview](../README.md)

> Topic: Partial failure, partitions, timeouts, backoff.

Each prompt is structured: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.** The focus throughout is *how the system behaves when things break*.

---

## D1. Design a resilient API gateway / service mesh sidecar for a 200-service estate

**Requirements / Scale**
- 200 internal microservices, ~500k internal RPC/s at peak.
- Must contain failures so one bad service can't cascade.
- Per-route timeouts, retries, circuit breaking, load shedding, and observability.

**High-level design**
- A **sidecar proxy** (Envoy-style) on every pod intercepts all inbound/outbound traffic. Control plane pushes config (timeouts, retry policy, outlier detection).
- **Per-route timeout** with **deadline propagation** via a header (`grpc-timeout` / `x-deadline`). Each hop subtracts elapsed time; a hop with no budget left fails fast.
- **Retry policy** at the *caller's* sidecar only: max 1–2 retries, exponential backoff + full jitter, **retry budget** (≤10% of requests), retry only on idempotent methods / `RETRIABLE` status codes.
- **Circuit breaking / outlier detection:** eject an upstream host from the LB pool after consecutive 5xx/timeouts; probe before re-admitting (half-open).
- **Load shedding:** sidecar enforces concurrency limits (e.g. adaptive concurrency / LIFO queue with a short deadline); excess → 503 with `Retry-After`.
- **Bulkheads:** separate connection pools per upstream cluster.

**Data model (config + state)**
- Route config: `{ route, upstream, timeout_ms, retries, retry_budget, breaker_thresholds }`.
- Per-upstream runtime state: rolling error rate, ejected hosts, in-flight count, concurrency limit.

**Scaling & bottlenecks**
- Control-plane config push must be incremental (xDS) — a full push storm to 200 services can itself cause a self-inflicted incident.
- Telemetry volume (per-request metrics × 500k/s) is a cost/cardinality bottleneck; sample traces, aggregate metrics.

**Tradeoffs & failure modes**
- Sidecars add ~1 ms latency and memory per pod — real cost at scale, but worth it for uniform policy.
- *Failure mode:* misconfigured retry policy on a non-idempotent route → duplicate side effects. Mitigate with idempotency keys and method-level retry gating.
- *Failure mode:* control-plane outage → mesh keeps running on last-known config (must fail static, not fail closed).

---

## D2. Design a multi-region active-active service that survives a full region outage

**Requirements / Scale**
- Global user base; target 99.99% availability; survive losing one of 3 regions.
- RTO ≤ a few minutes; bounded RPO for replicated data.

**High-level design**
- **Traffic routing:** GeoDNS / anycast + health-checked global load balancer routes users to the nearest healthy region. Health checks evaluate *real* request success, not just `/healthz` (avoid gray-failure blind spots).
- **Stateless tier** is trivially active-active. The hard part is **state**.
- **State options:** (a) regional partitioning — each user "homed" to a region, with async cross-region replication for failover; or (b) a globally-replicated store (Spanner/Cosmos/Dynamo global tables) accepting the consistency cost.
- **Failover:** on region loss, the global LB drains the dead region; homed users are re-routed and served from the replica. **Fencing** ensures the failed region, if it returns, can't resume as primary for partitions that have moved.

**Data model**
- `user → home_region`, replication lag metrics per region pair, per-record version/fencing token for conflict resolution.

**Scaling & bottlenecks**
- Cross-region replication bandwidth and lag; lag bounds your RPO.
- DNS TTLs gate failover speed — keep them low (but not so low you DDoS the resolver).

**Tradeoffs & failure modes**
- Active-active + strong consistency across regions → high write latency (cross-region quorum). Many teams choose regional homing + eventual cross-region consistency.
- *Failure mode:* split-brain if both regions accept writes for the same partition during a partition. Mitigate with single-writer-per-partition + fencing, or a consensus-backed store.
- *Failure mode:* "failover that never failed back" leaves capacity stranded; rehearse failback in game days.

---

## D3. Design retry + idempotency for a payment-charge flow

**Requirements / Scale**
- Charges must be **exactly-once in effect** even though the network gives at-most/at-least-once delivery.
- Clients (mobile, web) retry aggressively on timeouts.

**High-level design**
- Client generates a stable **idempotency key** per logical charge attempt and sends it on every retry of *that* attempt.
- The charge service performs an **insert-if-absent** of `(idempotency_key, request_hash)` in a transaction *before* calling the PSP. If the key exists with a completed result, return the stored result (dedup). If it exists but is in-flight, return "in progress" / make the caller poll.
- The actual PSP call is wrapped so that the outcome (success/fail + PSP reference) is persisted atomically with the key state.
- Retries use exponential backoff + jitter and a retry budget; the circuit breaker on the PSP prevents pile-on.

**Data model**
```
idempotency_records(
  key PK,
  request_hash,          -- detect key reuse with different body (reject)
  state ENUM(in_flight, succeeded, failed),
  psp_reference,
  response_body,
  created_at, expires_at
)
```

**Scaling & bottlenecks**
- The dedup table is on the hot path of every charge; it must be highly available and low-latency (often the same OLTP DB as the ledger, to share the transaction).
- Key TTL: keep keys long enough to cover all client retry windows (hours/days), then expire.

**Tradeoffs & failure modes**
- *Failure mode:* timeout *after* the PSP charged but *before* persisting state → on retry, we must reconcile with the PSP (query by idempotency key, which good PSPs also support) rather than charge again.
- *Failure mode:* key reuse with a different body (client bug) — reject with 409 to avoid silently returning a wrong cached result.
- Tradeoff: strict exactly-once needs the dedup write in the *same* transaction as the effect; cross-system effects need the saga/outbox pattern instead.
