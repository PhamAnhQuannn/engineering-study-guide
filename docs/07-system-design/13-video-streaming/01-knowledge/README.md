# Video Streaming Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Transcoding pipeline, adaptive bitrate (ABR), CDN (Content Delivery Network) architecture.

A video streaming platform like YouTube or Netflix is a **CDN-dominated, media-heavy** system design. Unlike most backend systems where the database or application server is the bottleneck, here the CDN IS the primary serving infrastructure. The dominant cost isn't compute or storage — it's bandwidth. Everything else (transcoding, search, recommendations) is in service of getting the right video bits to the right edge cache at the right bitrate.

> **🛒 Where we are in building ShopFast** — The [Multi-Vendor Marketplace](../../12-multi-vendor-marketplace/01-knowledge/README.md) expanded ShopFast into a multi-tenant platform. Now imagine ShopFast adding product demo videos — sellers upload video reviews, unboxing content, and tutorials. The upload-to-playback pipeline, [CDN caching](../../05-caching/01-knowledge/README.md), and [capacity planning](../../02-capacity-estimation/01-knowledge/README.md) challenges are the same ones YouTube solves at 1000× scale.

---

## Why it matters

This question tests:
1. **Media processing pipelines** — upload, validate, transcode, distribute (not a typical CRUD flow)
2. **CDN architecture** — origin, origin shield, edge PoPs (Points of Presence), cache warming
3. **Adaptive streaming** — HLS (HTTP Live Streaming)/DASH (Dynamic Adaptive Streaming over HTTP), manifest files, client-side quality switching
4. **Scale economics** — bandwidth is the #1 cost; codec efficiency directly impacts the bottom line

---

## The pipeline: upload to playback

```text
Upload → Validate → Transcode → Store → CDN → Playback
  │                    │                    │
  ▼                    ▼                    ▼
S3 (raw)         GPU workers         Edge PoPs
               (chunk-parallel)     (cache hot content)
```

### 1. Upload
Chunked upload to S3 (handles large files, resumable on failure). Metadata stored in Postgres: title, description, channel, tags, status=`uploading`.

### 2. Transcoding
The compute-heavy stage. A single video is transcoded into multiple **renditions** — combinations of resolution (360p, 720p, 1080p, 4K) and codec (H.264, H.265/HEVC, VP9, AV1). H.265 saves ~40% bandwidth vs H.264 but requires more decode compute.

**Chunk-parallel processing:** split the video into 10-second segments, transcode each segment independently across the GPU fleet, stitch results. A 5-minute video = 30 segments × 6 renditions = 180 parallel tasks.

### 3. Adaptive bitrate streaming
The client receives a **manifest file** (HLS `.m3u8` or DASH `.mpd`) listing all quality levels and their segment URLs. The player downloads segments one at a time, measures available bandwidth, and switches quality between segments. Bad wifi → drop to 360p. Back on fiber → jump to 1080p. No rebuffering, seamless quality transitions.

### 4. CDN architecture
Multi-tier: **origin** (S3) → **origin shield** (intermediate cache, reduces origin load) → **edge PoPs** (close to users). Popular videos cache at the edge (99%+ hit rate). Long-tail content served from origin shield. Very old/unpopular → cold storage.

**The [caching](../../05-caching/01-knowledge/README.md) strategy here is different from application caching:** segments are immutable (a transcoded segment never changes), so there's no invalidation problem — only eviction pressure. The challenge is predicting what to pre-warm at the edge vs what to serve on-demand.

---

## Cost structure at scale

| Component | % of total cost | Key driver |
|-----------|----------------|------------|
| CDN bandwidth | ~60-70% | Bytes delivered to users |
| Storage | ~15-20% | Total videos × renditions |
| Transcoding compute | ~10-15% | Uploads × renditions × duration |
| Application/DB | ~5% | Metadata, search, recommendations |

**This is why codec efficiency matters:** H.265 at the same visual quality uses ~40% less bandwidth than H.264. At YouTube's scale, that's billions of dollars in CDN savings. AV1 saves another ~30% but transcoding is 10× slower.

---

## ShopFast case: product video pipeline

> **Scenario:** ShopFast sellers want to upload product demo videos (1-5 min, 1080p max). Buyers watch them on product pages. Expected: 10k uploads/day, 1M video views/day.

**Decision:** hybrid transcoding — eagerly transcode 720p + 1080p H.264 on upload (covers 95% of views). Lazily transcode 360p (low demand) and H.265 (smaller audience with compatible devices) on first request. CloudFront CDN with origin shield. Videos stored in S3 with lifecycle policy (move to IA after 90 days, Glacier after 1 year).

**Why not eager-all?** At 10k uploads × 6 renditions, most long-tail seller videos get <100 views. Lazy transcoding for niche renditions saves significant compute cost. See [capacity estimation](../../02-capacity-estimation/01-knowledge/README.md) for the math.

**Rejected:** client-side transcoding (unreliable, inconsistent quality), single-rendition streaming (no adaptive quality → rebuffering on slow connections), direct S3 serving without CDN (origin overload, high latency for distant users).

---

## Live streaming (stretch scope)

If the interviewer asks about live streaming: different pipeline. Ingest via RTMP/SRT → real-time transcoding (no chunk-parallel — must process in order) → package to LL-HLS (Low-Latency HLS)/CMAF (Common Media Application Format) → distribute via CDN in low-latency mode. DVR/timeshift = write live segments to storage as they're produced. Key difference: VOD (Video On Demand) latency is seconds (buffered), live latency target is 2-5 seconds.

---

## Lessons and pitfalls

1. **Start with the cost model.** CDN bandwidth dominates. Every design decision (codec choice, eager vs lazy transcoding, cache warming strategy) should be evaluated against its bandwidth impact. See the [estimation question](../03-estimation-questions/README.md) for napkin math.

2. **Adaptive bitrate is non-negotiable.** Serving a single quality level means either wasting bandwidth (4K to a phone on 3G) or delivering unwatchable quality (360p on a 4K TV). ABR solves this at the client level with manifest files.

3. **Transcoding is embarrassingly parallel.** Chunk the video, farm out segments to a GPU fleet, stitch results. Queue-based autoscaling (Kafka/SQS → GPU workers). The scaling pattern from [scaling](../../06-scaling/01-knowledge/README.md) applies directly.

4. **Don't forget the viral video scenario.** One video gets millions of concurrent viewers. CDN handles this naturally (high cache hit rate), but origin shield prevents origin overload if the video wasn't pre-warmed. [Resilience](../../07-resilience/01-knowledge/README.md) patterns: circuit breaker between origin shield and origin.

5. **Content moderation is required.** Copyright detection (Content ID system scans against reference database), nudity/violence detection (ML), manual review queue. Block or monetize (rights holder's choice). Must happen before or during transcoding — never serve unmoderated content.

6. **Storage is tiered, not flat.** Hot (recent/popular) on SSD-backed S3, warm on standard S3, cold on Glacier. Lifecycle policies automate transitions. Lazy re-transcoding for cold videos requested in new codecs.
