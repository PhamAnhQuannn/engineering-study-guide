# Caching — Practice Questions

[← Topic overview](../README.md)

> Topic: Redis, CDN, strategies, invalidation, TTL.

Mix of recall, "explain to a junior," and MCQs. Answer before peeking.

---

### Q1. Explain cache-aside to a junior. What's the gotcha?

**Answer:** With cache-aside, the application checks the cache first. On a hit it returns immediately; on a miss it reads the database, stores the result in the cache, then returns it. Writes go to the DB and then invalidate (delete) the cached key. It's like checking your desk drawer before walking to the filing cabinet. The gotcha is the **first request for any key is always a miss** (cold start), and there's a **race**: if you delete-then-let-readers-repopulate, a concurrent reader can write the *old* value back into the cache right before the new DB write lands, leaving you stale. Mitigate with write-through updates, key versioning, or short locks.

---

### Q2. Cache-aside vs write-through — when do you pick each?

**Answer:** **Cache-aside** caches only what's actually read, survives cache outages gracefully (writes still go to the DB), and is the general default. **Write-through** writes through the cache to the DB synchronously, so the cache is always fresh and reads immediately after a write are warm — at the cost of slower writes and caching data that may never be read. Use write-through when read-after-write freshness matters (e.g., a user editing then viewing their profile); use cache-aside for general read-heavy data.

---

### Q3. How do you choose a TTL?

**Answer:** Tie it to **data volatility and the cost of staleness**. Immutable/versioned assets → effectively infinite (with versioned URLs). Slowly changing config → minutes to hours. Volatile data like stock/price → seconds. The TTL is a *safety net* that bounds how wrong a cache can be even when explicit invalidation fails or misses a key. Also add **jitter** so many keys don't expire simultaneously (avalanche).

---

### Q4. What is a cache stampede and how do you prevent it?

**Answer:** A stampede (thundering herd) happens when a hot key expires and many concurrent requests all miss and hit the origin DB at once, possibly overloading it. Prevention: **single-flight / request coalescing** (one request loads, the rest wait for the result), **stale-while-revalidate** (serve the stale value while one worker refreshes), **probabilistic early expiration** (refresh a bit before TTL, spread across requests), and **locks/leases** so only one loader runs per key.

---

### Q5. What's the difference between a hot key and a stampede?

**Answer:** A **hot key** is a sustained skew — one key (a viral product, a celebrity profile) gets a huge share of traffic, saturating the single cache shard/node that owns it, even with a high hit rate. A **stampede** is a transient surge of *misses* on a key, typically right after it expires. Hot key → fix with an L1 in-process cache, key replication/splitting. Stampede → fix with coalescing/SWR. They often co-occur (a hot key's expiry causes a big stampede).

---

### Q6. What is negative caching and why does it matter?

**Answer:** Negative caching stores the result "this key does not exist" for a short TTL. It defends against **cache penetration** — repeated lookups (often malicious or buggy) for non-existent keys that always miss the cache and hammer the DB. A short-TTL negative entry (or a Bloom filter to pre-check existence) stops those queries from reaching the origin. Keep negative TTLs short so legitimately-created keys appear quickly.

---

### Q7. Why version asset URLs (e.g., `app.a1b2c3.js`) instead of purging the CDN?

**Answer:** Versioned/content-hashed URLs make each version a *distinct key*, so you can cache them effectively forever (`Cache-Control: max-age=31536000, immutable`). Deploying a new version emits a new URL; clients fetch it naturally and old entries are simply never requested again. This avoids slow/global CDN purges and purge-race issues. The HTML referencing the asset has a short TTL so the new filename propagates quickly.

---

### Q8 (MCQ). Which strategy gives the strongest read-after-write freshness?

A. Cache-aside with long TTL
B. Write-through
C. Write-behind
D. Refresh-ahead

**Answer: B.** Write-through updates the cache synchronously with the DB write, so a subsequent read is fresh. Write-behind risks loss and lag; cache-aside leaves a stale window; refresh-ahead targets expiry, not writes.

---

### Q9 (MCQ). All your keys were set with `TTL = 3600`. At hour boundaries the DB spikes hard. The fix is:

A. Increase TTL to 7200
B. Switch to LFU eviction
C. Add random jitter to each TTL
D. Move the cache closer to the app

**Answer: C.** This is a cache **avalanche** from synchronized expiry. Jittering TTLs spreads expiries over time. The others don't address simultaneous expiry.

---

### Q10 (MCQ). Best defense against a single viral product key saturating one Redis node:

A. Lower the TTL
B. An in-process L1 cache in front of Redis
C. Switch from LRU to FIFO
D. Add a read replica to the DB

**Answer: B.** A hot key overwhelms the node that owns it; a per-app-node L1 cache absorbs most reads before they reach Redis. TTL/eviction/DB replicas don't relieve the single-shard hot spot.

---

### Q11 (MCQ). `ETag` + `If-None-Match` primarily enable:

A. Encrypting cached responses
B. 304 Not Modified responses that skip re-sending the body
C. Sharding the cache by key
D. Write-behind flushing

**Answer: B.** ETags are HTTP validators; a matching `If-None-Match` lets the server return 304 with no body, saving bandwidth while confirming freshness.

---

### Q12. The cache layer (Redis) goes completely down. What happens and how do you survive it?

**Answer:** With cache-aside, every read becomes a miss and falls through to the DB — which may not have capacity for the full load, causing a cascading overload (a thundering herd on the origin). Survival: (1) **provision DB headroom** or a fallback read path for cache-down scenarios; (2) **circuit-breaker** around the cache so calls fail fast instead of timing out; (3) run Redis **HA** (replica + Sentinel/cluster) to avoid total loss; (4) **single-flight** on the DB path to limit duplicate loads during recovery; (5) **warm gradually** on recovery to avoid re-stampeding. The key insight: an over-reliant system treats cache as load-bearing — design the degraded mode deliberately.
