# Scaling — Estimation Questions

[← Topic overview](../README.md)

> Topic: Horizontal/vertical, load balancing, stateless design.

Capacity drills. State assumptions, show order-of-magnitude math, give the estimate. Round aggressively — interviewers grade the reasoning, not the decimals.

**Handy constants:** 1 day ≈ 86,400 s ≈ 10⁵ s. 1M/day ≈ ~12/s. Peak ≈ 2–3× average.

---

## E1. How many app servers to serve 100M daily requests?

**Assumptions**
- 100M req/day. Average = 100M / 10⁵ s ≈ **1,000 RPS**. Peak ≈ 3× ≈ **3,000 RPS**.
- One app instance handles ~500 RPS at acceptable p99 (CPU-bound, ~2 ms work each thread, modest concurrency).

**Math**
- Servers for peak = 3,000 / 500 = **6**.
- Add N+2 redundancy and headroom (target 60% utilization): 6 / 0.6 ≈ 10.

**Estimate:** ~**8–10 app instances** behind the LB, autoscaling between ~6 (off-peak) and ~12 (peak/failover).

---

## E2. How many read replicas for a 50:1 read-heavy service at 5,000 read RPS?

**Assumptions**
- 5,000 read RPS reach the DB tier *after* caching. Assume a 90% cache hit rate → only **500 RPS** actually hit Postgres reads.
- One replica sustains ~2,000 simple indexed read QPS comfortably.

**Math**
- Replicas needed = 500 / 2,000 = 0.25 → 1 replica covers it.
- For HA + headroom + cache-cold events, run **2 replicas**.
- Without caching: 5,000 / 2,000 ≈ 3 → **3–4 replicas**.

**Estimate:** **2 replicas with caching**, ~4 without. Caching is the cheaper lever — note that explicitly.

---

## E3. Connection budget: will 200 app servers melt a Postgres primary?

**Assumptions**
- 200 app servers, default pool = 50 connections each.
- A single Postgres primary handles ~300–500 active connections before context-switching/memory degrade it.

**Math**
- Naive total = 200 × 50 = **10,000 connections** → ~20–30× over budget. The primary falls over.
- With a pooler (PgBouncer, transaction mode) multiplexing to ~400 backend connections: app side can keep 10k client connections, DB sees ~400.

**Estimate:** You **must** put a connection pooler in front. Target ~300–400 backend connections; size app pools small (5–10) and rely on the pooler. Connection exhaustion, not CPU, is the first wall here.

---

## E4. Bandwidth for a video-thumbnail CDN serving 1M users

**Assumptions**
- 1M DAU, each loads ~50 thumbnails/day, thumbnail ≈ 30 KB.
- CDN hit rate 95% (origin sees 5%).

**Math**
- Daily egress = 1M × 50 × 30 KB = 1.5 × 10⁹ × 30 ... = 50M images × 30 KB = **1.5 TB/day**.
- Average bandwidth = 1.5 TB / 86,400 s ≈ 17 MB/s ≈ **140 Mbps**; peak 3× ≈ **420 Mbps** — easily CDN territory.
- Origin egress = 5% × 1.5 TB = **75 GB/day** — trivial for a single origin.

**Estimate:** ~**1.5 TB/day** total egress, ~140 Mbps average; CDN absorbs 95%, leaving the origin at ~75 GB/day. The CDN is what makes this affordable.

---

## E5. Autoscaling headroom for a flash sale (10× spike in 2 minutes)

**Assumptions**
- Steady state 1,000 RPS on 4 instances (250 RPS each). Sale drives 10,000 RPS.
- Instance cold-start + warmup ≈ 90 s; reactive autoscaler reacts on a 60 s window.

**Math**
- Target instances at peak = 10,000 / 250 = **40 instances**.
- Time to launch 36 new instances reactively ≈ 1–2 scale steps × ~90 s ≈ **2–3 min** — *slower than the spike*, so reactive alone drops requests early.

**Estimate:** Pre-warm to ~**40 instances** on a *scheduled* policy before the sale, plus a small reactive buffer. Conclusion: for known spikes, predictive/scheduled scaling beats reactive — reactive lag (~2–3 min) is longer than the 2-min ramp.
