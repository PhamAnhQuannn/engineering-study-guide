# Video Streaming Design — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Transcoding pipeline, adaptive bitrate, CDN architecture.

---

## DC1. Eager vs lazy video transcoding — when does each make sense?

**Answer**

**Eager (transcode all renditions on upload):**
- Pro: instant playback at any quality level. No cold-start latency.
- Con: expensive — 6+ renditions for every video, including ones nobody watches. 90% of videos get <100 views.
- Best for: platforms where most content is consumed (Netflix — curated catalog, everything gets watched).

**Lazy (transcode on first request):**
- Pro: saves compute for unwatched content. Only produce renditions that are actually requested.
- Con: first viewer waits for transcoding (seconds to minutes). Bad UX.
- Best for: archival/niche platforms with a long tail.

**Hybrid (recommended for YouTube-scale):** eagerly transcode the most-requested renditions (720p, 1080p H.264) on upload. Lazily transcode niche renditions (4K, AV1) on first request, then cache. This covers 95%+ of views with minimal wasted compute.

---

## DC2. CDN strategy — push (pre-warm) vs pull (on-demand)

**Answer**

**Push (pre-warm edges with content before first request):**
- Pro: zero cold-start latency for the first viewer. Great for predicted-popular content (new Netflix release, trending video).
- Con: wastes bandwidth/storage if the content isn't actually popular at that edge. Can't push everything — 1B videos to 200 PoPs is impossible.
- When to use: trending/viral content, new releases, content with scheduled launch times.

**Pull (cache on first request):**
- Pro: no wasted resources. Only content that's actually requested occupies cache. Natural LRU eviction handles the long tail.
- Con: first viewer in each PoP experiences a cache miss → higher latency (origin fetch).
- When to use: the default for all content. Long-tail videos, unpredictable access patterns.

**Decision:** pull by default, selective push for predicted-popular content. Use a "popularity predictor" (upload velocity, early view count, social sharing signals) to decide what to pre-warm. This covers 95% of views with minimal wasted CDN resources.
