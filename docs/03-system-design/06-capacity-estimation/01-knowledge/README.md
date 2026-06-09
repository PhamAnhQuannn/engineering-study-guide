# Capacity Estimation — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: QPS, storage, bandwidth napkin math.

Capacity ("back-of-the-envelope") estimation is the skill of producing a defensible order-of-magnitude answer in minutes: QPS, storage, bandwidth, memory, number of machines. Interviewers don't want decimals — they want **clear assumptions, sound math, and a sanity-checked number**. It's how seniors right-size systems and spot bottlenecks before building.

---

## The method (state it out loud)

1. **State assumptions** explicitly (users, requests/user/day, payload sizes, read:write ratio, retention). Pick round numbers; say "assume."
2. **Convert to a rate** (per-second) — most capacity is throughput.
3. **Apply a peak factor** (peak ≈ 2–3× average; spiky workloads more).
4. **Multiply out** storage/bandwidth/memory/machines.
5. **Sanity check** against reality (does this fit on one box? one DB? a CDN?).
6. **Add headroom** (target ~50–70% utilization, plus redundancy).

> Round aggressively. 86,400 s/day ≈ **10⁵**. This single approximation makes most mental math trivial.

---

## Numbers worth memorizing

**Time → per-second conversions**
- 1 day ≈ **10⁵ s** (86,400).
- 1 million/day ≈ **~12/s**; 1 billion/day ≈ **~12,000/s**.
- 1 month ≈ 2.6×10⁶ s; 1 year ≈ **~3×10⁷ s**.

**Powers / data sizes**
- KB 10³, MB 10⁶, GB 10⁹, TB 10¹², PB 10¹⁵.
- 2¹⁰ ≈ 1K, 2²⁰ ≈ 1M, 2³⁰ ≈ 1B (handy for ID/key spaces).
- char/byte ≈ 1 B; int 4 B; long/timestamp 8 B; UUID 16 B; typical row 100 B–1 KB; small JSON 1–2 KB; image thumbnail ~30 KB; web page assets ~1–2 MB; photo ~1–5 MB; minute of video ~5–50 MB.

**Latency (Jeff Dean's "numbers everyone should know", rounded)**
- L1 cache ~1 ns; main memory ~100 ns; SSD read ~100 µs; rotational disk seek ~10 ms; same-DC round trip ~0.5 ms; cross-continent round trip ~100–150 ms.
- Memory is ~100,000× faster than disk seek; network within a DC is cheap, cross-region is not.

**Throughput rules of thumb (order of magnitude; verify per system)**
- A single app server: ~hundreds–low-thousands of simple RPS.
- One Postgres primary: ~hundreds–low-thousands of write TPS; thousands of indexed read QPS; ~300–500 connections before degradation.
- One Redis node: ~100k+ ops/s.
- One Kafka partition: ~10 MB/s.

---

## What to estimate (the usual targets)

- **QPS / RPS:** requests per second, split read vs write using the read:write ratio. Always compute **peak**, not just average.
- **Storage:** objects/day × size × retention; add indexes (×1.2–2), replication (×RF, often 3), and growth.
- **Bandwidth:** RPS × payload size, in and out; factor CDN offload for static.
- **Memory / cache:** working-set size (often a small % of total data due to skew) × overhead (~1.5×).
- **Number of machines:** peak load ÷ per-machine capacity, then ÷ target utilization (~0.6), then + redundancy (N+1/N+2).
- **Connections:** servers × pool size vs DB limit (pooler needed?).

---

## Key terms & definitions

| Term | Definition |
|---|---|
| QPS / RPS | Queries / requests per second. |
| Peak factor | Ratio of peak to average load (typically 2–3×). |
| Read:write ratio | Proportion of reads to writes; drives replica/cache sizing. |
| Working set | The actively-accessed subset of data (sizes the cache). |
| Replication factor (RF) | Copies of data kept for durability (often 3). |
| Headroom | Spare capacity above expected peak. |
| Fan-out | One request triggering many downstream calls. |
| Amplification | Extra load from retries/replication/fan-out. |
| DAU / MAU | Daily / monthly active users. |

---

## Tradeoffs & how estimates drive design

- A high read:write ratio → invest in **caching + replicas**; high write rate → **sharding / queues**.
- If storage × retention exceeds one node → **shard** or tier to cold storage.
- If bandwidth is huge but cacheable → **CDN** (often 10–20× origin offload).
- If connections exceed DB limits → **pooler**.
- If peak ≫ average → **autoscaling** + queue buffering.

The estimate's *purpose* is to reveal which resource hits its ceiling first — that's the bottleneck to design around.

---

## Common pitfalls & misconceptions

- **Forgetting the peak factor** — sizing for average then falling over at peak.
- **Ignoring replication/index overhead** in storage (real footprint is often 3–6× raw).
- **Confusing bits and bytes** (Mbps vs MB/s — 8× difference).
- **Over-precision** — chasing exact figures instead of the right order of magnitude.
- **Forgetting amplification** — retries, fan-out, and replication multiply load.
- **Not sanity-checking** — an answer of "we need 50,000 servers" for a small app means a math error.
- **Assuming uniform access** — real traffic is skewed (power law), which *helps* caching and *hurts* hot shards.

---

## What interviewers probe

- "Estimate the QPS / storage / bandwidth for X" — they grade assumptions + method, not the number.
- "What's the peak vs average?" — make sure you applied a peak factor.
- "Will this fit on one machine / one DB?" — the sanity check.
- "What's the dominant cost / first bottleneck?" — tie the estimate to a design decision.
- "How much does retention/replication change your storage?" — overhead awareness.

---

## Quick-reference summary

- **Method:** assumptions → per-second rate → peak factor → multiply → sanity-check → headroom.
- **Memorize:** 1 day ≈ 10⁵ s; 1M/day ≈ 12/s; GB/TB/PB; row ~1 KB; same-DC RTT ~0.5 ms, cross-region ~100 ms; memory ~100,000× faster than disk seek.
- **Always compute peak** (2–3× avg) and **add overhead** (indexes, RF×3) and **headroom** (~60% util + redundancy).
- The estimate exists to **find the first bottleneck** and justify the architecture — round aggressively and state every assumption.
