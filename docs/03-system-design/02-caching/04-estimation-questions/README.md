# Caching — Estimation Questions

[← Topic overview](../README.md)

> Topic: Redis, CDN, strategies, invalidation, TTL.

State assumptions, show order-of-magnitude math, give the estimate.

**Constants:** 1 day ≈ 10⁵ s. 1M/day ≈ ~12/s. Cache RAM is the scarce resource — size the *working set*.

---

## E1. How much Redis memory to cache the hot working set of a 100M-row table?

**Assumptions**
- 100M rows, each cached object ≈ 1 KB (serialized).
- Access is skewed: ~5% of rows are "hot" and account for most reads (power law).
- Redis overhead ≈ 1.5× the raw value size (keys, pointers, fragmentation).

**Math**
- Hot rows = 5% × 100M = 5M objects.
- Raw = 5M × 1 KB = **5 GB**. With overhead ≈ 5 GB × 1.5 = **~7.5 GB**.
- Caching *all* rows would be 100M × 1 KB × 1.5 ≈ 150 GB — wasteful; the skew is the point.

**Estimate:** A **~8–16 GB** Redis node (with headroom for spikes + eviction churn) holds the hot set. Use `allkeys-lfu` so the cache naturally keeps the frequently-read 5%.

---

## E2. What cache hit rate do you need to keep DB reads under 1,000 QPS?

**Assumptions**
- Total read traffic = 10,000 reads/sec.
- DB can comfortably serve 1,000 read QPS at target latency.

**Math**
- Allowed misses = 1,000 / 10,000 = 0.10 → miss rate ≤ 10%.
- Required **hit rate ≥ 90%**.
- At 95% hit rate, DB sees 500 QPS (2× headroom); at 99%, only 100 QPS.

**Estimate:** Target **≥ 90% hit rate**, design for 95%+ to leave headroom. The jump from 90%→99% cuts origin load 10×, which is why hit-rate tuning beats adding DB replicas.

---

## E3. CDN savings: origin bandwidth for a static-heavy site

**Assumptions**
- 1M page views/day, each pulls ~2 MB of assets (mostly cacheable).
- CDN hit rate 95%.

**Math**
- Total egress = 1M × 2 MB = **2 TB/day**.
- Origin egress = 5% × 2 TB = **100 GB/day** ≈ ~10 Mbps average.
- Without CDN, origin would serve the full 2 TB/day ≈ ~200 Mbps avg, 3× at peak.

**Estimate:** CDN cuts origin egress from **2 TB/day to ~100 GB/day** (20×). Origin bandwidth drops from hundreds of Mbps to ~10 Mbps — the dominant reason a CDN pays for itself.

---

## E4. Stampede risk: requests hitting the DB when a hot key expires

**Assumptions**
- Hot key receives 5,000 RPS. Cache miss → DB recompute takes 200 ms. TTL expiry with no protection.

**Math**
- Requests arriving during the 200 ms recompute window = 5,000 × 0.2 = **1,000 simultaneous misses**, all hitting the DB for the same key.
- With **single-flight**, only **1** request loads; the other 999 wait → DB sees 1 query, not 1,000.

**Estimate:** Unprotected, each expiry causes a ~**1,000-query burst** on one key; single-flight/SWR reduces that to **1**. This quantifies why stampede protection is mandatory for hot keys, not optional.

---

## E5. Memory + TTL for caching user sessions

**Assumptions**
- 10M registered users; ~10% (1M) active concurrently. Session blob ≈ 2 KB. Idle TTL = 30 min.

**Math**
- Active sessions in cache = 1M × 2 KB = **2 GB** raw; ×1.5 overhead ≈ **3 GB**.
- Eviction is mostly handled by the 30-min TTL — idle sessions expire automatically, so steady-state ≈ active set, not total users.

**Estimate:** A **~4 GB** Redis (HA pair) holds the active session working set comfortably. The TTL — not eviction — bounds memory, since it tracks concurrency (1M) rather than total accounts (10M).
