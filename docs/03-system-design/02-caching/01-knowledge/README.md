# Caching — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Redis, CDN, strategies, invalidation, TTL.

Caching stores a copy of data closer to where it's needed so repeat reads are faster and cheaper. It is usually the single highest-leverage scaling tool — a 90% hit rate cuts origin load 10×. The senior skill is choosing the right *write/read strategy*, *invalidation* approach, and *consistency* tradeoff for each surface, and knowing the failure modes (stampede, hot keys, staleness).

---

## Where caches live (the layers)

| Layer | Example | Scope | Notes |
|---|---|---|---|
| Client / browser | HTTP cache, localStorage | Per user | Controlled by `Cache-Control`, `ETag`. Free, but you can't invalidate. |
| CDN / edge | CloudFront, Fastly, Cloudflare | Global, shared | Best for static + cacheable GETs. Edge invalidation/purge available. |
| Reverse proxy | NGINX, Varnish | Per POP/cluster | Microcaching even of dynamic responses. |
| Application / distributed | Redis, Memcached | Shared across app nodes | The workhorse for app data, sessions, computed results. |
| In-process / local | Caffeine, Guava, LRU map | Per node | Nanosecond access, no network hop; risks inconsistency across nodes. |
| Database | buffer pool, materialized views | Per DB | Built-in; tune working set to fit RAM. |

A request ideally short-circuits at the *highest* layer it can.

---

## Read/write strategies

### Cache-aside (lazy loading) — most common
App checks cache; on miss, reads DB, populates cache, returns. Writes go to the DB and **invalidate/update** the cache.
- Pros: only caches what's used; cache failure doesn't block writes; simple.
- Cons: first request per key is a miss (cold); risk of stale data between DB write and cache update; stampede risk on popular keys.

### Read-through
App talks only to the cache; the cache library loads from DB on miss. Same effect as cache-aside but the loading logic is centralized in the cache layer.

### Write-through
Writes go to the cache, which synchronously writes to the DB. Cache is always fresh; write latency includes both hops.
- Pros: strong cache freshness; reads after write are warm.
- Cons: slower writes; caches data that may never be read.

### Write-behind (write-back)
Writes go to the cache and are flushed to the DB asynchronously (batched).
- Pros: very fast writes; absorbs write bursts.
- Cons: **data loss risk** if the cache dies before flush; complexity; ordering.

### Refresh-ahead
Proactively refresh hot keys before they expire to avoid a miss on expiry.

> **Senior framing:** cache-aside for general data; write-through when reads-after-write must be fresh; write-behind only when you can tolerate loss and need write absorption.

---

## TTL and eviction

- **TTL (time-to-live):** the safety net — even with perfect invalidation, a TTL bounds staleness. Choose per data volatility (config: minutes; prices: seconds; immutable assets: long + versioned URL).
- **Eviction policy** (when memory is full): **LRU** (least recently used, default), **LFU** (least frequently — better for skewed popularity), **FIFO**, **TTL-based**, **random**. Redis offers `allkeys-lru`, `allkeys-lfu`, `volatile-ttl`, etc.
- **Working set must fit:** if your hot set exceeds cache RAM, you thrash and the hit rate collapses.

---

## Invalidation — "one of the two hard problems"

The hard part isn't storing; it's knowing *when a cached copy is wrong.*

- **TTL expiry:** simplest, eventually consistent. Tune the staleness window.
- **Explicit invalidation/purge:** delete the key on write. Precise but you must find *every* key derived from the changed data (lists, aggregates, denormalized views).
- **Write-through update:** overwrite on write — avoids the delete-then-miss gap.
- **Versioned/keyed URLs:** change the key (e.g., `app.v3.js`, `product:42:v17`) so old entries are simply never requested again — immutable + cache-forever.
- **Event-driven / CDC:** publish change events; subscribers purge affected keys.

Pitfall: **delete + repopulate race** — invalidate, then a concurrent reader repopulates the *old* value just before the DB write lands. Mitigations: write-through, versioning, or short locks.

---

## Failure modes & defenses

- **Cache stampede / thundering herd:** a hot key expires and thousands of requests hit the DB simultaneously. Defenses: **request coalescing / single-flight** (one loader, others wait), **probabilistic early expiration**, **locks/leases**, **stale-while-revalidate** (serve stale, refresh in background).
- **Hot key:** one key gets disproportionate traffic, saturating a single shard. Defenses: local L1 cache in front of the distributed cache, key replication/splitting, client-side caching.
- **Cache penetration:** queries for keys that don't exist (often malicious) always miss and hit the DB. Defense: cache negative results (short TTL) or a **Bloom filter**.
- **Cache avalanche:** many keys expire at once (e.g., all set with the same TTL). Defense: **jitter** the TTLs.
- **Cold cache after restart/deploy:** the DB gets slammed until warm. Defense: warming, gradual rollout, or persistent cache (Redis RDB/AOF).

---

## Key terms & definitions

| Term | Definition |
|---|---|
| Hit rate | Fraction of reads served from cache. The headline metric. |
| Cache-aside | App manages cache; load-on-miss, invalidate-on-write. |
| Write-through / write-behind | Write synchronously / asynchronously through the cache. |
| TTL | Time-to-live before an entry is considered stale/expired. |
| Eviction policy | Rule for which entry to drop when full (LRU/LFU/…). |
| Stampede | Concurrent misses on a hot key hammering the origin. |
| Single-flight | Coalesce duplicate concurrent loads into one. |
| Stale-while-revalidate | Serve stale value while refreshing in background. |
| Negative caching | Cache "not found" to stop penetration. |
| ETag / If-None-Match | HTTP validators enabling 304 conditional responses. |

---

## What interviewers probe

- "Cache-aside vs write-through — when each?" and the staleness/latency tradeoff.
- "How do you invalidate?" — they want TTL + explicit + versioning, and awareness of the repopulate race.
- "A hot product goes viral — what breaks and how do you protect the cache/DB?" (hot key + stampede).
- "How do you pick a TTL?" — tie to data volatility and the cost of staleness.
- "What happens when the cache layer goes down?" — graceful degradation, capacity headroom, thundering herd on recovery.
- Consistency: "Is a stale read acceptable here?" — they want you to reason per surface, not blanket-cache.

---

## Quick-reference summary

- Cache at the **highest layer** the data allows (browser → CDN → Redis → local → DB).
- **Cache-aside** is the default; **write-through** for fresh reads-after-write; **write-behind** only if loss is tolerable.
- **TTL is the safety net; explicit/versioned invalidation is the precision tool** — combine them.
- Design against **stampede (single-flight/SWR), hot keys (L1), penetration (negative cache/Bloom), avalanche (TTL jitter)**.
- Always state the **staleness tolerance per surface** and the **plan for when the cache is down**.
