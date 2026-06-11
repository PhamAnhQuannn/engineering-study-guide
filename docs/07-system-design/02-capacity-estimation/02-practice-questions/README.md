# Capacity Estimation — Practice Questions

[← Topic overview](../README.md)

> Topic: QPS, storage, bandwidth napkin math.

Mix of recall, "explain to a junior," and MCQs. These test the *method* and the memorized constants.

---

### Q1. What's the standard method for a back-of-the-envelope capacity estimate?

**Answer:** (1) **State assumptions** (users, requests/user/day, payload sizes, read:write ratio, retention) with round numbers. (2) **Convert to a per-second rate**. (3) **Apply a peak factor** (~2–3× average). (4) **Multiply out** the target (storage/bandwidth/machines). (5) **Sanity-check** against reality (fits on one box? one DB? CDN territory?). (6) **Add headroom** (~60% utilization + redundancy). The interviewer grades the assumptions and method, not the exact number.

---

### Q2. Why approximate a day as 10⁵ seconds, and how does it help?

**Answer:** A day is 86,400 s ≈ **10⁵ s**. Using 10⁵ makes conversions instant: 1 million/day ÷ 10⁵ = 10/s (~12 exact); 1 billion/day = 10⁴/s (~12,000 exact). The ~15% error is irrelevant for order-of-magnitude work and keeps the math mental. Memorizing this one approximation unlocks almost all QPS conversions.

---

### Q3. Explain "peak factor" to a junior and why it matters.

**Answer:** Average load is total requests spread evenly over a day, but real traffic isn't even — it clusters (lunchtime, evenings, business hours). The **peak factor** is how much higher the busiest moment is than the average, typically **2–3×** (more for spiky/event-driven apps). It matters because you must size capacity for the *peak*, not the average — a system built for average load will fall over at peak. So after computing average RPS, multiply by ~2–3 to get the number you actually provision for.

---

### Q4. How do you go from raw data size to actual storage footprint?

**Answer:** Raw = objects × size. Then add overhead: **indexes** (×1.2–2 depending on how many), **replication factor** (×3 is common for durability), and **growth/retention** (multiply by the retention period and a growth margin). So a "100 GB raw" dataset can easily be 300–600 GB provisioned. Forgetting these is the most common storage-estimation mistake.

---

### Q5. A service has a 100:1 read:write ratio. How does that shape your design and estimate?

**Answer:** Reads dominate, so the estimate should split traffic: at 10,000 total RPS, ~9,900 are reads and ~100 are writes. Design-wise, the heavy read load points to **caching** (absorb most reads) and **read replicas** (handle cache misses), while the light write load goes to a single primary comfortably. You'd size the cache for the read working set and provision few/no extra write capacity. A high read:write ratio is the signal to invest in read-path scaling, not write-path.

---

### Q6. What's the difference between Mbps and MB/s, and why does it bite people?

**Answer:** Mbps is **mega*bits* per second**; MB/s is **mega*bytes* per second**. 1 byte = 8 bits, so they differ by **8×**. Network capacity is usually quoted in bits (Gbps links), while data sizes are in bytes (GB files). Mixing them gives an 8× error — e.g., a "100 Mbps" link moves only ~12.5 MB/s. Always convert to one unit before multiplying.

---

### Q7. Why is access skew (power-law popularity) good for caching but bad for sharding?

**Answer:** Real traffic is skewed — a small fraction of items get most of the requests. For **caching**, this is great: caching just the hot 5–20% captures most reads, so a small cache yields a high hit rate. For **sharding**, it's a problem: if the hot items hash to the same shard, that shard gets disproportionate load (a **hot shard**) while others idle, undermining even distribution. So skew lets you cache cheaply but forces care in shard-key choice (or replication of hot keys).

---

### Q8 (MCQ). 1 billion requests per day is approximately:

A. ~120 RPS
B. ~1,200 RPS
C. ~12,000 RPS
D. ~120,000 RPS

**Answer: C.** 10⁹ / 10⁵ s = 10⁴ = ~12,000 RPS (exact ~11,600). Apply a peak factor for provisioning.

---

### Q9 (MCQ). Roughly how much faster is main memory than a rotational-disk seek?

A. ~10×
B. ~1,000×
C. ~100,000×
D. ~10×

**Answer: C.** Memory access ~100 ns vs disk seek ~10 ms → ~100,000×. This is why working sets in RAM matter so much.

---

### Q10 (MCQ). You estimate 50 GB of raw data with RF=3 and ~1.5× index overhead. Provisioned storage ≈:

A. ~50 GB
B. ~75 GB
C. ~150 GB
D. ~225 GB

**Answer: D.** 50 GB × 1.5 (indexes) × 3 (replication) = **225 GB**. Overheads multiply.

---

### Q11 (MCQ). The single most common reason a capacity estimate is dangerously low is:

A. Using 10⁵ for seconds-per-day
B. Forgetting to apply a peak factor
C. Rounding payload sizes
D. Using base-10 instead of base-2

**Answer: B.** Sizing for average load ignores the 2–3× peak, so the system saturates at the busiest moment. The other items are minor order-of-magnitude noise.

---

### Q12. Estimate whether a feature with 5M writes/day fits on a single Postgres primary.

**Answer:** 5M/day ÷ 10⁵ s = **~50 writes/sec average**, peak ~3× ≈ **150 writes/sec**. A single Postgres primary comfortably handles hundreds to low-thousands of simple write TPS, so **yes — 150 TPS fits easily** on one primary with headroom. The bottleneck here won't be write throughput; watch instead for connection count and any read load. If writes were 500M/day (~5,000 avg, ~15,000 peak TPS), that would exceed a single primary and push you toward batching/queueing or sharding.
