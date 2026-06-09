# Architecture Styles — Estimation Questions

[← Topic overview](../README.md)

> Topic: Monolith, microservices, event sourcing, CQRS.

State assumptions, show order-of-magnitude math, give the estimate. These drills size the *cost* of architectural choices.

**Constants:** 1 day ≈ 10⁵ s. 1 year ≈ 3×10⁷ s.

---

## E1. Event-store growth for an event-sourced ledger

**Assumptions**
- 1M accounts, average 5 financial events/account/day. Each event ≈ 300 bytes. Events are immutable and retained 7 years (compliance).

**Math**
- Events/day = 1M × 5 = 5M/day. Bytes/day = 5M × 300 B = **1.5 GB/day**.
- Per year = 1.5 GB × 365 ≈ **~550 GB/year**.
- 7-year retention ≈ 550 GB × 7 ≈ **~3.8 TB** (plus indexes ≈ ~5–6 TB).

**Estimate:** ~**4 TB raw, ~6 TB with indexes** over 7 years. Manageable on a single large store with tiered/cold storage for old streams + snapshots so reads don't replay everything. The takeaway: event sourcing trades storage for auditability — and storage is cheap relative to the compliance value.

---

## E2. Latency tax: monolith in-process call vs microservice network call

**Assumptions**
- A request touches 5 internal modules. In a monolith these are function calls (~1 µs each). In microservices each is a network RPC (~1 ms p50, ~10 ms p99 incl. serialization).

**Math**
- Monolith internal cost = 5 × 1 µs ≈ **5 µs** — negligible.
- Microservices (sequential) p50 = 5 × 1 ms = **5 ms**; p99, if calls are sequential and independent ~10 ms each ≈ **up to ~50 ms** tail.
- Fan-out parallel calls reduce wall-clock but the **tail** is bound by the slowest hop.

**Estimate:** Decomposition adds ~**5 ms p50 and a much heavier tail (~tens of ms)** purely from network hops on a 5-service path. The lesson: each synchronous hop adds latency and tail risk — minimize chatty inter-service calls (batch, cache, or keep tightly-coupled logic co-located).

---

## E3. CQRS read-model lag under write load

**Assumptions**
- Write side produces 2,000 events/sec at peak. A single projection worker applies ~5,000 events/sec to the read model. Burst lasts 60 s at 2× (4,000/sec).

**Math**
- Steady state: 2,000 in / 5,000 out → no backlog (drain rate > arrival).
- Burst: 4,000 in vs 5,000 out → still draining, lag stays near zero.
- If a worker stalls 10 s during the burst: backlog = 4,000 × 10 = 40,000 events; recovery at (5,000−4,000)=1,000/s net → **40 s to catch up**.

**Estimate:** Read model stays near-fresh in steady state; a 10 s projection stall creates ~**40 s of read staleness** before catch-up. Plan: keep projection throughput comfortably above peak write rate, parallelize projections by partition, and alert on projection lag (the key CQRS health metric).

---

## E4. Operational cost of going from 1 service to 30 microservices

**Assumptions**
- Each service needs: a CI/CD pipeline, a deploy/runtime footprint (min 2 instances for HA), monitoring/alerts, an on-call burden, and inter-service contracts.

**Math**
- Instances: 30 services × 2 (HA) = **60 instances minimum** vs 2–3 for a monolith (~20–30× footprint floor).
- Pipelines/dashboards/alert sets: ~30× the config surface.
- Inter-service contracts: up to N(N−1)/2 ≈ 30×29/2 = **435 potential pairwise integrations** to govern (in practice far fewer, but the coordination surface explodes).

**Estimate:** Microservices multiply the *operational* surface ~**20–30×** in baseline footprint and create a combinatorial integration/coordination surface. This quantifies the "distributed-systems tax" — justified only when team autonomy/independent scaling outweighs it.

---

## E5. Kafka partition/throughput sizing for an event backbone

**Assumptions**
- 50,000 events/sec peak, each ~1 KB. One partition sustains ~10 MB/s (~10k 1 KB msgs/s) for a consumer comfortably.

**Math**
- Aggregate throughput = 50,000 × 1 KB = **50 MB/s**.
- Partitions for parallelism = 50 MB/s ÷ 10 MB/s = **~5 minimum**; for headroom + consumer parallelism use ~**12–16 partitions**.
- Daily volume = 50,000 × 10⁵ = 5×10⁹ events ≈ **5 TB/day**; 7-day retention ≈ **~35 TB** across brokers (×replication factor 3 ≈ ~105 TB stored).

**Estimate:** ~**12–16 partitions** for the topic, ~**5 TB/day** ingest, ~**100 TB** stored at RF=3 over a week. Partition count caps consumer parallelism, so size it above current need but not absurdly high (rebalancing cost). The broker is now critical infra — provision and monitor it accordingly.
