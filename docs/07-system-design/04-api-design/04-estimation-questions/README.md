# API Design — Estimation Questions

[← Topic overview](../README.md)

> Topic: REST, GraphQL, gRPC, versioning, idempotency.

State assumptions, show order-of-magnitude math, give the estimate.

**Constants:** 1 day ≈ 10⁵ s. Peak ≈ 2–3× average.

---

## E1. Storage for an idempotency-key store at 200 RPS of writes, 24h retention

**Assumptions**
- 200 write RPS, each needs an idempotency record. Record ≈ 1 KB (key, request hash, response snapshot, status, timestamps). Retain 24h.

**Math**
- Records/day = 200 × 10⁵ = **20M/day** (using 10⁵ s/day; ~17M with exact 86,400 — same order).
- Storage = 20M × 1 KB = **20 GB** live at any time (24h window).
- With index + overhead ≈ ~30 GB.

**Estimate:** ~**20–30 GB** for the idempotency store. Fits in Redis (with persistence) or a dedicated DB table with a TTL/cleanup job. Note: response snapshots dominate size — store a compact result, not the full payload, if you can.

---

## E2. Payload bandwidth: REST over-fetching vs GraphQL field selection on mobile

**Assumptions**
- 1M mobile users, 100 list requests/user/day. REST returns a 5 KB object but the screen needs only ~500 bytes of it. GraphQL fetches just the 500 bytes.

**Math**
- Requests/day = 1M × 100 = 100M.
- REST egress = 100M × 5 KB = **500 GB/day**.
- GraphQL egress = 100M × 0.5 KB = **50 GB/day**.
- Savings = **10× (450 GB/day)**.

**Estimate:** Field selection cuts egress ~**10×** (500→50 GB/day) for this over-fetch-heavy mobile workload — the core bandwidth argument for GraphQL (or REST sparse fieldsets). On metered mobile networks this is also a UX/battery win.

---

## E3. gRPC vs JSON/REST payload size for an internal hot path

**Assumptions**
- An internal RPC carries a message that's ~2 KB as JSON. Protobuf binary is typically ~3–5× smaller and avoids field-name repetition; assume ~0.5 KB. Path runs at 50,000 RPS internally.

**Math**
- JSON bytes/sec = 50,000 × 2 KB = **100 MB/s** ≈ 800 Mbps.
- Protobuf bytes/sec = 50,000 × 0.5 KB = **25 MB/s** ≈ 200 Mbps.
- Plus HTTP/2 multiplexing avoids per-call connection overhead.

**Estimate:** gRPC/protobuf cuts intra-mesh bandwidth ~**4×** (800→200 Mbps) on this hot path, plus lower CPU for (de)serialization and connection reuse. This is why high-throughput internal calls favor gRPC over JSON/REST.

---

## E4. Rate-limit capacity: tokens needed for 10k API clients

**Assumptions**
- 10k API keys, each allowed 100 req/min. Token-bucket state per key ≈ 50 bytes in Redis.

**Math**
- Peak allowed throughput if all maxed = 10k × 100/min = 1M/min ≈ **~17k RPS** ceiling.
- Rate-limit state memory = 10k × 50 B = **500 KB** — negligible.
- Redis ops = ~2 per request (check + decrement) → at 17k RPS that's ~34k Redis ops/s, trivial for one node.

**Estimate:** Rate-limit state is **sub-MB** and Redis-cheap; the real planning number is the **~17k RPS aggregate ceiling** you've authorized — size the backend for that, not for unbounded traffic. The limiter protects the service; the backend must still handle the sanctioned peak.

---

## E5. Webhook delivery volume + retry amplification

**Assumptions**
- 500k business events/day generate webhooks. Delivery success rate 95% first try; failures retry up to 5× with backoff.

**Math**
- First attempts = 500k.
- Failed (5%) = 25k, each retried on average ~2 extra times before giving up → ~50k retry attempts.
- Total delivery attempts ≈ 500k + 50k = **~550k/day** (~6/s avg, ~18/s peak).

**Estimate:** ~**550k delivery attempts/day** (~10% amplification from retries). Size the webhook worker pool for the ~18/s peak with backoff, ensure consumers are idempotent (at-least-once), and cap retries to avoid unbounded amplification on a persistently-down endpoint.
