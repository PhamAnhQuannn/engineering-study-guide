# Caching — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Redis, CDN (Content Delivery Network), strategies, invalidation, TTL (Time To Live).

Caching stores a copy of data closer to where it's needed so repeat reads are faster and cheaper. It is usually the single highest-leverage scaling tool — a 90% hit rate cuts origin load 10×. The senior skill is choosing the right *write/read strategy*, *invalidation* approach, and *consistency* tradeoff for each surface, and knowing the failure modes (stampede, hot keys, staleness).

> **🛒 Where we are in building ShopFast** — Last topic we exposed [REST APIs](../../03-api-design/01-knowledge/README.md). `GET /products/:id` is now the hottest path — the *same* popular products are fetched millions of times, every read hitting Postgres. The DB is sweating. This topic puts a cache in front so most reads never touch it. **Next:** even cached, traffic grows past one box — that's [Scaling](../../01-scaling/01-knowledge/README.md).

---

## Teaching arc: caching the ShopFast catalog

### What it is
A **cache** is a small, fast copy of data kept close to whoever needs it, so you don't repeat expensive work. It's the sticky-note on your monitor with the wifi password — instead of walking to the router and reading the label every time (the slow DB query), you glance at the note (the cache). The catch: if someone changes the password, your note is now *wrong* — which is why **invalidation** is the hard part.

### What it looks like
The **cache-aside** read path — check the fast copy first, fall back to the DB on a miss:

```text
                    ┌────── HIT (≈1 ms) ──────────────────────────┐
client → app → Redis?                                              → response
                    └─ MISS → Postgres (≈30 ms) → write into Redis ┘
```

A 90% hit rate means 9 of 10 reads end at the first box and never wake the database.

### The code that builds it
Cache-aside wrapped around the catalog read from the last two topics. This *is* the cache:

```typescript
// cache-aside: look in Redis; on miss load from DB and backfill
async function getProductCached(id: string): Promise<Product | null> {
  const key = `product:${id}`;
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);                    // HIT — skip the DB entirely

  const product = await catalog.getProduct(id);       // MISS — the slow path
  if (product) {
    const ttl = 60 + Math.floor(Math.random() * 30);  // 60s + jitter (avoids avalanche)
    await redis.set(key, JSON.stringify(product), "EX", ttl);
  }
  return product;
}

// on write, invalidate so the next read repopulates fresh
async function updateProduct(id: string, patch: Partial<Product>) {
  await catalog.update(id, patch);
  await redis.del(`product:${id}`);                   // the hard part: kill the stale copy
}
```

### The code that calls it
The endpoint from the API topic now calls the cached version — **one line changes**, the caller is otherwise oblivious to the cache:

```typescript
app.get("/v1/products/:id", async (req, res) => {
  const product = await getProductCached(req.params.id);   // was: catalog.getProduct(...)
  if (!product) return res.status(404).json({ type: "not_found", title: "No such product" });
  res.set("Cache-Control", "public, max-age=60");          // also lets the CDN cache it
  res.json(product);
});
```

### Types & differences
| Strategy | How | Reach for it when |
|---|---|---|
| **Cache-aside** | app loads on miss, invalidates on write | general data; the default (**ShopFast catalog**) |
| **Read-through** | cache lib loads on miss | want load logic centralized in the cache layer |
| **Write-through** | write hits cache + DB synchronously | reads-after-write must be fresh |
| **Write-behind** | write cache now, flush to DB async | need write absorption AND can tolerate loss |
| **Refresh-ahead** | refresh hot keys before expiry | predictable hot keys, want zero miss latency |

### Build it for real — ShopFast
Catalog data is **read-dominated and rarely changes** (price/stock update occasionally; name/description almost never). A stale price for a few seconds is acceptable; losing an order is not. 

**Decision:** **cache-aside in Redis** for product reads (only caches what's actually requested, and a Redis outage degrades to slower-but-correct DB reads rather than blocking writes) + **CDN for product images** (static, huge, perfect at the edge). TTL of ~60s with **jitter** bounds staleness and prevents synchronized expiry. **Rejected:** write-behind (we can't tolerate losing a price write on a cache crash) and caching *everything* blindly (cart/checkout need fresh data — we cache per surface, not globally).

> **If we skipped TTL jitter:** with every `product:{id}` set to the same flat 60s, a batch of hot keys expires in the *same second*, dumping thousands of identical reads onto Postgres at once — a **stampede that can topple the very DB the cache exists to protect**. Jitter spreads expiries so misses trickle instead of flood.

### Scaling story
- **Now (cheap):** one Redis node, cache-aside, TTL+jitter. *Placeholders we leave:* a consistent key scheme (`product:{id}`) and `Cache-Control` headers so a CDN can be slotted in front later with no app change. Cost: one small Redis.
- **Growth signal:** hit rate sags below ~90% (working set outgrew RAM); a product goes **viral** → one **hot key** saturates a single Redis shard; a key expires under load → **stampede** of identical DB queries; p99 spikes on cache restarts (cold cache).
- **At scale (millions+):** add an **L1 in-process cache** in front of Redis for hot keys; **single-flight / stale-while-revalidate** to kill stampedes; **negative-cache** missing ids (penetration); put a **CDN** in front of cacheable GETs to offload the edge. When even this isn't enough, the bottleneck moves to the data tier itself → [Scaling](../../01-scaling/01-knowledge/README.md) (replicas/sharding) and protect it all with [Resilience](../../05-resilience/01-knowledge/README.md) patterns.

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
- **Event-driven / CDC (Change Data Capture):** publish change events; subscribers purge affected keys.

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
- Design against **stampede (single-flight/SWR — Stale-While-Revalidate), hot keys (L1), penetration (negative cache/Bloom), avalanche (TTL jitter)**.
- Always state the **staleness tolerance per surface** and the **plan for when the cache is down**.
