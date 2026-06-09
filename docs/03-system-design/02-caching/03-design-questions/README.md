# Caching — System Design Questions

[← Topic overview](../README.md)

> Topic: Redis, CDN, strategies, invalidation, TTL.

Structured prompts: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## D1. Design a caching layer for a news/article site (read-heavy, occasional edits)

**Requirements / Scale**
- 10M DAU, ~50M article reads/day (~600 RPS avg, ~2k peak). Articles rarely change after publish; breaking news may be edited.
- p99 < 100 ms; tolerate seconds of staleness for body, but corrections should appear within ~1 min.

**High-level design**
- **CDN** caches rendered article pages + assets at the edge (the bulk of traffic).
- **Redis** caches the assembled article object and rendered fragments for cache misses / personalized shells.
- **Cache-aside** for article objects; **versioned URLs** for static assets.
- Edits publish a **purge event** (CDN purge by URL/tag + Redis key delete) for that article.

**Data model**
- Redis: `article:{id}` → JSON (title, body, author, version), TTL 5 min.
- CDN: cache key = path; surrogate-key/tag = `article-{id}` for targeted purge.

**Scaling & bottlenecks**
- CDN absorbs 90%+ of reads; origin sees a small fraction.
- A breaking story is a **hot key** → add per-node L1 cache + SWR so the origin isn't stampeded on expiry.
- TTL jitter to avoid avalanche.

**Tradeoffs & failure modes**
- Stale body for up to TTL — acceptable; corrections trigger explicit purge for immediacy.
- Purge lag across CDN POPs → use surrogate-key purge + short TTL as backstop.
- Redis/CDN down → origin must tolerate the surge (headroom + single-flight).

---

## D2. Design caching for a personalized dashboard (per-user, expensive to compute)

**Requirements / Scale**
- 2M users; dashboard aggregates from several services; cold compute ~400 ms. Target p99 < 150 ms warm. Data freshness: ~1–5 min acceptable.

**High-level design**
- **Cache-aside in Redis** keyed per user: `dash:{userId}` → computed JSON, TTL 2 min.
- **Refresh-ahead** for active users (refresh before expiry to keep it warm) and **stale-while-revalidate** so a logged-in user never waits for a full recompute.
- Compute behind a **single-flight** guard so concurrent loads for the same user collapse to one.

**Data model**
- `dash:{userId}` → aggregated widgets blob + `computed_at`.
- Optional `dash:{userId}:lock` lease key to serialize recompute.

**Scaling & bottlenecks**
- Per-user keys → huge key space; size Redis for the *active* working set, evict idle users with LRU.
- Recompute fan-out to upstream services is the cost → coalesce + cache intermediate results.
- Memory pressure: store compact, consider compression for large blobs.

**Tradeoffs & failure modes**
- Staleness vs cost: shorter TTL = fresher but more recompute. SWR hides recompute latency at the cost of briefly-stale views.
- Upstream service down during refresh → serve last-good cached value (graceful degradation) rather than error.

---

## D3. Design cache invalidation for a denormalized social feed

**Requirements / Scale**
- Feeds are precomputed (fan-out-on-write) and cached. A user edit/delete or privacy change must reflect quickly; millions of cached feed fragments.

**High-level design**
- **Event-driven invalidation:** writes emit change events (CDC/queue); consumers purge/update affected cached fragments.
- **Tagged cache keys** so one source change maps to all derived keys (e.g., post `p1` appears in followers' feed caches → tag `post:p1`).
- TTL backstop on every fragment so missed events still self-heal.

**Data model**
- `feed:{userId}:page:{n}` → list of post ids/snapshots, tag set `{post:p1, post:p2,...}`.
- Reverse index `post:{id}:in_feeds` to find what to purge on edit (or use tag-based purge).

**Scaling & bottlenecks**
- A celebrity edit invalidates millions of fragments → batch/throttle purges, or switch hot accounts to **fan-out-on-read** (don't precompute) to avoid mass invalidation.
- Event lag = staleness window; monitor consumer lag.

**Tradeoffs & failure modes**
- Precise tag invalidation vs blunt TTL: tags are immediate but require bookkeeping; TTL is simple but stale.
- Lost/duplicated events → idempotent purges + TTL backstop + periodic reconciliation.
- Repopulate race on delete → version keys or write-through the corrected fragment.
