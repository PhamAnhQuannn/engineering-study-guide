# Caching — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Redis, CDN, strategies, invalidation, TTL.

Named options, a reasoned recommendation, and "what would change the answer."

---

### DC1. Cache-aside vs write-through vs write-behind

**Recommendation:** **Cache-aside** as the default — caches only what's read and tolerates cache outages (writes still hit the DB). **Write-through** when read-after-write must be fresh and writes aren't latency-critical. **Write-behind** only when you must absorb write bursts and can tolerate possible data loss.

**What changes it:** Strict freshness after writes → write-through. Write-heavy with loss tolerance (metrics, counters) → write-behind. General read-heavy app → cache-aside.

---

### DC2. Redis vs Memcached for a distributed cache

**Recommendation:** **Redis** for almost all new work — richer data types (sorted sets, hashes, streams), persistence options, pub/sub, Lua, clustering, and it's effectively a superset for caching. **Memcached** only when you want a dead-simple multithreaded LRU string cache with minimal memory overhead at very high throughput.

**What changes it:** Need data structures, persistence, or pub/sub → Redis. Pure ephemeral string KV at extreme scale with multi-core per node → Memcached can edge it on raw throughput/memory efficiency.

---

### DC3. Local (in-process) cache vs distributed cache vs both (L1/L2)

**Recommendation:** **Both (tiered L1 local + L2 Redis)** for hot, read-heavy data — L1 gives nanosecond, network-free reads and absorbs hot keys; L2 gives a shared, larger, consistent-ish layer. Pure **distributed** when consistency across nodes matters more than the extra hop. Pure **local** only for small, node-agnostic, staleness-tolerant data.

**What changes it:** Hot-key pressure on Redis → add L1. Strong cross-node consistency need → avoid local (it drifts per node). Tiny dataset, low churn → local alone is fine.

---

### DC4. TTL-only invalidation vs explicit/event-driven invalidation

**Recommendation:** **Combine.** Use **explicit/event-driven** invalidation for precision and immediacy where correctness matters, with a **TTL backstop** so any missed event self-heals. TTL-only is acceptable when bounded staleness is fine and the system must stay simple.

**What changes it:** Corrections/privacy changes must appear fast → explicit/event-driven. Simple, staleness-tolerant data → TTL-only. High write volume causing purge storms → favor TTL + versioning over mass purges.

---

### DC5. Cache at the CDN/edge vs application layer (Redis)

**Recommendation:** **CDN/edge** for cacheable GETs, static assets, and anonymous/shared responses — it offloads traffic before it reaches your infra and cuts latency globally. **Redis/app** for personalized, authenticated, or fine-grained data the CDN can't safely cache. Most systems use **both**: CDN for the shared shell, Redis for per-user data.

**What changes it:** Highly personalized responses → app cache (or edge compute with care). Global latency-sensitive static content → CDN. Need precise programmatic invalidation → Redis is easier than CDN purge.

---

### DC6. Long TTL + explicit purge vs short TTL + no purge

**Recommendation:** **Long TTL + explicit purge** when you can reliably emit invalidation events and freshness matters — you get high hit rates *and* correctness. **Short TTL + no purge** when invalidation is hard to wire and bounded staleness is acceptable — simpler, but lower hit rate and more origin load.

**What changes it:** Reliable change events available → long TTL + purge. Can't reliably detect changes / want simplicity → short TTL. Immutable content → infinite TTL + versioned keys (best of both).

---

### DC7. Stale-while-revalidate vs block-on-miss for hot reads

**Recommendation:** **Stale-while-revalidate** for hot, latency-sensitive reads where slightly-stale is acceptable — users never wait for recompute, and the origin sees one refresh instead of a stampede. **Block-on-miss** (with single-flight) when correctness forbids serving stale data.

**What changes it:** UX demands fast responses + staleness OK → SWR. Financial/correctness-critical reads → block-on-miss with single-flight. Either way, add single-flight to prevent stampede.
