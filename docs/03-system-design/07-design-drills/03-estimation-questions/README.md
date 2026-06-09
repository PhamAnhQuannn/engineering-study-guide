# Design Drills — Estimation Questions

[← Topic overview](../README.md)

> Topic: URL shortener, feed, chat, rate limiter, notifications.

Capacity drills for the canonical problems. State assumptions, show the math, give the estimate. (1 day ≈ 10⁵ s; peak ≈ 2–3×.)

---

## E1. URL shortener: QPS, storage, and key space

**Assumptions**
- 100M new URLs/month; read:write ≈ 100:1. Mapping ≈ 500 bytes. Short code 7 base62 chars.

**Math**
- Writes: 100M/month ÷ (30 × 10⁵) ≈ **~33 writes/s** avg; peak ~100/s.
- Reads (redirects): 100× writes ≈ **~3,300 reads/s** avg; peak ~10,000/s → cache-dominated.
- Storage: 100M × 500 B = **50 GB/month**; ~600 GB/year; over 5 years ~3 TB.
- Key space: 62⁷ ≈ **3.5 × 10¹²** codes — at 100M/month it lasts ~**3,000 years**. 7 chars is plenty.

**Estimate:** ~**33 writes/s, ~3,300 reads/s** (peak ~3×), **50 GB/month**, and a 7-char code space that never runs out. The read-heavy profile means the design is dominated by **caching/CDN**, not write capacity.

---

## E2. News feed: fan-out write amplification

**Assumptions**
- 300M users; average user has 200 followers; posts 2×/day. A celebrity has 50M followers.

**Math**
- Normal-user fan-out writes/day = 300M × 2 posts × 200 followers = **120B feed writes/day** ÷ 10⁵ = **~1.2M feed writes/s** (push model).
- One celebrity post = 50M fan-out writes in a burst → impractical to push synchronously.
- Hybrid: pull celebrity posts at read time instead → eliminates the 50M-write spikes.

**Estimate:** Pure fan-out-on-write implies ~**1.2M feed writes/s** plus unmanageable **50M-write celebrity bursts** — which is exactly why the answer is **hybrid fan-out** (push for the ~200-follower majority, pull for mega-accounts). The estimate *is* the justification for the architecture.

---

## E3. Chat: concurrent connections and message throughput

**Assumptions**
- 500M DAU, 10% online concurrently at peak. Each online user sends ~1 message/min. Message ≈ 200 bytes, retained 1 year.

**Math**
- Concurrent connections = 10% × 500M = **50M WebSocket connections** at peak.
- If a gateway holds ~100k connections → **~500 gateway nodes** needed.
- Messages/s = 50M × (1/60) ≈ **~830,000 messages/s** sent.
- Storage/day = 830k × 86,400 × 200 B ≈ **~14 TB/day** → ~5 PB/year (×RF for replication).

**Estimate:** ~**50M concurrent sockets (~500 gateways)**, ~**830k msgs/s**, ~**14 TB/day**. The dominant challenges are managing tens of millions of persistent connections (gateway tier + registry) and PB-scale history storage (wide-column, sharded by conversation).

---

## E4. Rate limiter: Redis load and memory

**Assumptions**
- 1M active clients, each limited to 100 req/min. Bucket state ≈ 50 bytes. ~2 Redis ops/request.

**Math**
- Aggregate authorized ceiling = 1M × 100/min = 100M/min ≈ **~1.67M RPS** if all maxed (usually far less).
- Redis ops = ~2 × actual RPS; at, say, 200k RPS real traffic → 400k ops/s (one node handles ~100k+; cluster ~4–6 nodes).
- Memory = 1M × 50 B = **50 MB** — trivial.

**Estimate:** Rate-limit **state is ~50 MB** (negligible); the constraint is **Redis ops throughput** (~2 per request), needing a small cluster at high RPS, plus an **L1 local cache** for hot clients to shave Redis load. The authorized ceiling (~1.67M RPS) is the number to size *backends* for.

---

## E5. Notification system: delivery volume with retry amplification

**Assumptions**
- 10M users, average 3 notifications/user/day across channels = 30M/day. First-attempt success 95%; failures retry up to 3× with backoff.

**Math**
- First attempts = 30M/day ÷ 10⁵ = **~300/s** avg; peak ~1,000/s.
- Failures (5%) = 1.5M/day; retried ~2 extra times avg ≈ 3M retry attempts → total ≈ **33M attempts/day** (~10% amplification).
- Provider calls/s peak ≈ ~1,100/s across channels → must respect per-provider rate limits (split into per-channel queues).

**Estimate:** ~**30M notifications/day (~300/s avg, ~1k/s peak)** with ~**10% retry amplification** to ~33M attempts. Size worker pools for the peak per channel, throttle to provider limits, keep consumers **idempotent** (at-least-once), and route persistent failures to a **dead-letter queue**.
