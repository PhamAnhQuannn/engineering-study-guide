# Video Streaming Design — System Design Questions

[← Topic overview](../README.md)

> Topic: Transcoding pipeline, adaptive bitrate, CDN architecture.

---

## D1. Design a video streaming platform (YouTube/Netflix)

**Requirements / Scale**
- Functional: video upload, transcoding (multiple resolutions/codecs), adaptive bitrate playback, search + discovery, recommendations ("watch next"), channels/subscriptions, comments/likes, content moderation, live streaming (stretch).
- Non-functional: 1B stored videos, 500M DAU, 1M uploads/day, 100M hours watched/day, playback start <2s, adaptive quality switching, 99.9% playback availability.

**High-level design**
- **Upload pipeline:** client → upload service (chunked upload to S3) → message to transcoding queue → **transcoding workers** (GPU fleet) split video into segments, transcode each to multiple renditions (360p/720p/1080p/4K × H.264/H.265/VP9), generate thumbnails → write renditions to origin storage → update metadata (status: ready) → notify CDN for optional pre-warming.
- **Playback:** client requests a **manifest file** (HLS .m3u8 or DASH .mpd) listing all available quality levels and segment URLs. Client player downloads segments, measures bandwidth, switches quality adaptively. Segments served from CDN edge (cache hit) → CDN origin shield → origin S3 (cache miss).
- **Metadata service:** Postgres for video metadata (title, description, channel, tags, status, view count). Search via Elasticsearch.
- **Recommendation service:** offline pipeline (Spark/Flink) computes collaborative filtering + content-based scores → stores per-user recommendation lists in Redis/DynamoDB. Real-time signals (watch history, likes) update in near-real-time.
- **CDN architecture:** multi-tier — origin (S3) → origin shield (intermediate cache, reduces origin load) → edge PoPs (close to users). Popular videos cached at edge. Long-tail served from origin shield. Very old/unpopular → cold storage, lazy transcoding or accept higher latency.
- **Live streaming (stretch):** ingest via RTMP/SRT → real-time transcoding → package to LL-HLS/CMAF → distribute via CDN with low-latency mode. DVR/timeshift = write live segments to storage as they're produced.

**Data model**
- `videos(id PK, channel_id FK, title, description, tags[], status ENUM(uploading,transcoding,ready,failed,removed), duration_sec, upload_url, created_at)` — Postgres.
- `renditions(id PK, video_id FK, resolution ENUM(360p,720p,1080p,4k), codec ENUM(h264,h265,vp9,av1), bitrate_kbps INT, manifest_url, segment_prefix)` — Postgres. One row per quality level per video.
- `segments` stored in S3 at predictable paths: `s3://videos/{video_id}/{resolution}/{codec}/segment_{n}.ts`.
- `channels(id PK, owner_id, name, subscriber_count, created_at)` — Postgres.
- `views(video_id, user_id, watch_duration_sec, timestamp)` — event stream to Kafka → aggregated in analytics store (ClickHouse/BigQuery).
- `recommendations:{user_id}` → ordered list of video IDs — Redis/DynamoDB, refreshed by offline pipeline.
- Elasticsearch index: `videos_index` (title, description, tags, channel_name).

**Scaling & bottlenecks**
- **Transcoding compute:** 1M uploads/day, each needing ~6 renditions. GPU workers, queue-based autoscaling. Chunk-parallel: a 1-hour video split into 10s segments = 360 segments × 6 renditions = 2,160 transcode tasks per video. Parallelize heavily.
- **CDN bandwidth cost:** the dominant cost center. 100M hours/day at average 5 Mbps ≈ 225 PB/day. Multi-CDN strategy for cost + redundancy. Negotiate volume discounts.
- **Hot video (viral):** one video gets millions of concurrent viewers. CDN handles this naturally (cache hit rate → 99%+). Origin shield prevents origin overload.
- **Long-tail storage:** 1B videos, most rarely watched. Tiered storage: hot (recent/popular) on SSD-backed S3, warm on standard S3, cold on Glacier. Lazy re-transcoding for cold videos requested in new codecs.
- **Recommendation freshness:** offline pipeline runs hourly/daily. Real-time layer blends in recent watch signals. Stale recommendations are acceptable for hours but not days.
- **Search indexing:** new video metadata indexed within minutes via Kafka → Elasticsearch consumer.

**Tradeoffs & failure modes**
- **Eager vs lazy transcoding:** eager (all renditions on upload — high cost, instant playback for any quality) vs lazy (transcode on first request — saves cost on unwatched videos, slow first view). Hybrid: eagerly transcode 720p + 1080p (most requested), lazily transcode 4K and niche codecs.
- **HLS vs DASH:** HLS has universal Apple support, DASH is the open standard. Many platforms support both via CMAF (common media format segments playable by both).
- **CDN push vs pull:** push (pre-warm popular content to edges — fast first view, bandwidth cost) vs pull (on-demand, cold-start latency for first viewer). Push for trending/predicted-popular, pull for long tail.
- **Live latency:** LL-HLS/CMAF achieve 2–5s latency (vs 30s for classic HLS). Trade-off: lower latency = smaller segments = more requests = higher CDN cost.
- **Transcoding failure:** a segment fails to transcode → retry. Entire video fails → alert uploader, offer re-upload. Never serve a partially transcoded video as "ready."
- **CDN outage (regional):** DNS-based failover to alternate CDN provider. Multi-CDN strategy is table stakes at this scale.
- **Copyright/moderation:** Content ID system scans uploads against a reference database. Match → block or monetize (rights holder's choice). Manual review queue for edge cases. False positives → appeal process.

**Checklist**
- [ ] Describes upload-to-playback pipeline end to end
- [ ] Explains adaptive bitrate streaming (HLS/DASH manifest, client-side quality switching)
- [ ] Addresses transcoding parallelism (chunk-based, multiple renditions)
- [ ] Designs CDN architecture with origin shield and edge caching
- [ ] Discusses storage tiers for hot vs long-tail content
- [ ] Mentions content moderation and copyright detection
- [ ] Handles the viral video scenario at CDN and origin level
- [ ] Plans recommendation system (offline + real-time signals)
- [ ] Distinguishes live streaming from VOD if scoped in
