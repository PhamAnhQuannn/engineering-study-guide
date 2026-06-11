# Capacity Estimation — Estimation Questions

[← Topic overview](../README.md)

> Topic: QPS, storage, bandwidth napkin math.

Full capacity drills. State assumptions, show the math, give the estimate. Round aggressively (1 day ≈ 10⁵ s; peak ≈ 2–3× average).

---

## E1. Estimate QPS and storage for a Twitter-like service

**Assumptions**
- 300M DAU. Each user posts ~2 tweets/day and reads ~100 tweets/day. Tweet ≈ 300 bytes (text + metadata; media stored separately). Retain forever.

**Math**
- **Write QPS:** 300M × 2 = 600M tweets/day ÷ 10⁵ = **~6,000 writes/s** avg; peak 3× ≈ **~18,000 writes/s**.
- **Read QPS:** 300M × 100 = 30B reads/day ÷ 10⁵ = **~300,000 reads/s** avg; peak ≈ **~900,000 reads/s**. Read:write ≈ 50:1 → caching + replicas essential.
- **Storage/day:** 600M × 300 B = **180 GB/day** raw; ×~3 (replication) ≈ **~540 GB/day**; ≈ **~200 TB/year** raw, ~600 TB with replication.

**Estimate:** ~**6k writes/s, ~300k reads/s** (peak ~3×), **~180 GB/day** raw (~200 TB/yr). The 50:1 read ratio mandates heavy caching + read replicas + a fan-out/feed strategy; storage at hundreds of TB/yr requires sharding + tiered storage. Media (not counted here) dwarfs text and belongs in object storage + CDN.

---

## E2. Storage for a photo-sharing service

**Assumptions**
- 100M users upload 1 photo/day. Original ≈ 3 MB; plus 3 resized variants ≈ 1 MB total. Retain 5 years. RF = 3.

**Math**
- Photos/day = 100M. Bytes/photo (original + variants) ≈ 4 MB.
- Daily = 100M × 4 MB = **400 TB/day** raw → ×3 RF = **1.2 PB/day** stored.
- Per year ≈ 400 TB × 365 ≈ **~150 PB/year** raw; 5 years ≈ **~730 PB** raw, ~2.2 EB with RF=3.

**Estimate:** ~**400 TB/day**, scaling to **hundreds of PB over 5 years** (multi-EB with replication). This is object-storage + CDN territory (not a database); cost forces tiering (hot/cold), aggressive compression, and possibly dedup. The math immediately rules out keeping originals on block storage and rules in S3-class storage + lifecycle policies.

---

## E3. Bandwidth for a video-streaming service at peak

**Assumptions**
- 1M concurrent viewers at peak. Average stream bitrate ≈ 5 Mbps (1080p). Served via CDN.

**Math**
- Aggregate bandwidth = 1M × 5 Mbps = **5,000,000 Mbps = 5 Tbps**.
- In bytes: 5 Tbps ÷ 8 = **~625 GB/s** egress at peak.
- Per hour ≈ 625 GB/s × 3,600 ≈ **~2.2 PB/hour** delivered.

**Estimate:** ~**5 Tbps / 625 GB/s** at peak — far beyond any single origin; this *must* be a CDN with thousands of edge servers and adaptive bitrate. The number itself is the design argument: video is bandwidth-dominated, so the whole architecture is CDN-first with the origin only serving cache fills.

---

## E4. Memory to cache the hot working set of a key-value store

**Assumptions**
- 1B keys, value ≈ 1 KB. Access is power-law: ~10% of keys serve ~90% of reads. Cache overhead ~1.5×.

**Math**
- Hot keys = 10% × 1B = 100M.
- Raw hot data = 100M × 1 KB = **100 GB**; ×1.5 overhead = **~150 GB**.
- Caching all 1B keys would be 1B × 1 KB × 1.5 = **1.5 TB** — 10× more for marginal hit-rate gain.

**Estimate:** ~**150 GB** of cache holds the hot 10% and captures ~90% of reads — fits across a few Redis nodes (e.g., 3–4 × 64 GB with headroom). The skew is the lever: you spend memory on the hot tenth, not the whole keyspace, and use LFU eviction to keep it.

---

## E5. Number of app servers for a 1B-request/day API

**Assumptions**
- 1B requests/day. One app instance sustains ~1,000 RPS at acceptable p99. Target 60% utilization + N+2 redundancy.

**Math**
- Average RPS = 1B ÷ 10⁵ = **~12,000 RPS**; peak 3× ≈ **~36,000 RPS**.
- Instances for peak at full util = 36,000 ÷ 1,000 = 36.
- At 60% target util = 36 ÷ 0.6 = **60**; + N+2 redundancy ≈ **~62**.

**Estimate:** ~**60 app instances** at peak (autoscaling down off-peak to ~20). The headroom and redundancy roughly double the naive "36" — a good reminder that you never provision at 100% utilization. Cross-check: 60 boxes for a 1B/day API is plausible; 6,000 would signal a math error.
