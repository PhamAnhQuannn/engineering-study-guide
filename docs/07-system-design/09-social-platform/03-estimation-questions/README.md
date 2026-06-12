# Social Platform Design — Estimation Questions

[← Topic overview](../README.md)

> Topic: Follow graph, feed, stories, DMs, media pipeline, explore/discovery.

---

## E1. Social platform: storage and bandwidth for 500M DAU

**Assumptions**
- 500M DAU, 200M posts/day (avg 1 image = 500 KB compressed, 20% have video = 5 MB avg).
- 2B stories/day (image/short video, avg 300 KB, TTL 24h).
- 50M active DM conversations, avg 50 messages/day per conversation, avg 200 bytes/message.
- Feed reads: 500M users × 10 feed loads/day = 5B feed reads/day.

**Storage**
- Posts (images): 200M × 80% × 500 KB = 80 TB/day.
- Posts (videos): 200M × 20% × 5 MB = 200 TB/day.
- Stories: 2B × 300 KB = 600 TB/day written, but TTL 24h → steady-state ~600 TB.
- DMs: 50M × 50 × 200 B = 500 GB/day (negligible vs media).
- **Total new media/day: ~280 TB.** At 3-year retention: ~300 PB.

**Throughput**
- Feed reads: 5B/day ÷ 86,400 ≈ 58k QPS avg, ~175k QPS peak (3× avg).
- Post writes: 200M/day ÷ 86,400 ≈ 2,300 QPS avg.
- DM messages: 2.5B/day ÷ 86,400 ≈ 29k QPS.

**Bandwidth**
- Feed: assume each load fetches 20 posts × 100 KB avg (thumbnails) = 2 MB. 5B loads × 2 MB = 10 PB/day outbound ≈ 925 Gbps avg.
- CDN absorbs 90%+ → origin serves ~90 Gbps.

**Key takeaway:** media storage and CDN bandwidth dominate cost. Feed read QPS is the main scaling challenge on the backend.
