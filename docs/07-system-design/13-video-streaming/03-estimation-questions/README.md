# Video Streaming Design — Estimation Questions

[← Topic overview](../README.md)

> Topic: Transcoding pipeline, adaptive bitrate, CDN architecture.

---

## E1. Video streaming: transcoding compute and CDN bandwidth

**Assumptions**
- 1M uploads/day, avg duration 5 min.
- 6 renditions per video (360p, 480p, 720p, 1080p H.264, 1080p H.265, 4K H.265).
- Transcoding speed: 1 GPU can transcode 1 min of video to 1 rendition in ~10 sec (real-time for 1080p H.264, slower for 4K/H.265).
- 500M DAU, avg 12 min watch time/day = 100M hours/day.
- Avg bitrate: 5 Mbps.

**Transcoding compute**
- Total transcode work: 1M videos × 5 min × 6 renditions = 30M rendition-minutes/day.
- At 10 sec/min: 30M × 10 = 300M GPU-seconds/day = 3,472 GPU-hours/day.
- With chunk-parallel (10s segments): 5 min video = 30 segments × 6 renditions = 180 tasks. Each takes ~1-2s on a GPU. Highly parallelizable.
- Fleet sizing: process within 2 hours of upload → 3,472 GPU-hours / 2 hours = 1,736 GPUs needed (burst). Baseline: ~500 GPUs, autoscale to 2,000.

**Storage**
- Avg video (all renditions): 5 min × (0.5 + 1 + 2.5 + 5 + 3.5 + 10 Mbps) × 60s / 8 ≈ 1 GB per video (all renditions combined).
- Daily: 1M × 1 GB = 1 PB/day. Yearly: 365 PB.
- Tiered storage: hot (last 30 days, ~30 PB on S3 standard), warm (last year, ~335 PB on S3 IA), cold (older, Glacier).

**CDN bandwidth**
- 100M hours/day × 3,600 sec/hour × 5 Mbps = 1.8 Ebit/day.
- Per second avg: 1.8 × 10^18 / 86,400 ≈ 20.8 Tbps.
- Peak (2× avg): ~42 Tbps. This is why YouTube/Netflix are among the largest bandwidth consumers globally.

**CDN cost**
- At $0.02/GB (volume discount): 100M hours × 5 Mbps × 3,600 / 8 / 10^9 = 225 PB/day.
- 225 PB × $0.02/GB × 10^6 GB/PB = $4.5M/day in CDN bandwidth. ~$1.6B/year.

**Key takeaway:** CDN bandwidth is the #1 cost (~$1.6B/year at scale). Transcoding compute is #2. Storage is #3. Codec efficiency (H.265 saves ~40% bandwidth vs H.264) directly impacts the bottom line by hundreds of millions.
