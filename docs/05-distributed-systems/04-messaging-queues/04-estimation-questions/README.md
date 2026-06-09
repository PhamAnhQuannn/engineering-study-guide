# Messaging & Queues — Estimation Questions

[← Topic overview](../README.md)

> Topic: Kafka, RabbitMQ, pub/sub, event-driven, streams.

Capacity drills. State assumptions, show order-of-magnitude math, give the estimate. Rounding to powers of ten is fine — the goal is defensible sizing.

---

### E1. How many Kafka partitions do you need for a 1M msg/s topic?

**Assumptions**
- Target throughput: 1,000,000 msg/s, avg message 1 KB → ~1 GB/s.
- A single partition reliably sustains, conservatively, ~10 MB/s of consumer throughput end-to-end (Kafka can do more per partition raw, but real consumer processing and headroom lower it).
- Want ~2× headroom for spikes and rebalance slack.

**Math**
- Raw need: 1 GB/s ÷ 10 MB/s per partition = ~100 partitions.
- With 2× headroom: ~200 partitions.
- Cross-check on message rate: if one consumer thread handles ~10k msg/s after processing, 1M ÷ 10k = 100 consumers → need ≥100 partitions (one per consumer). Consistent.

**Estimate:** **~200 partitions** (round number), giving room for ~100–200 parallel consumers. Replication factor 3 → 600 partition replicas across the cluster; ensure broker count and open-file limits support that.

---

### E2. How much disk does a Kafka cluster need for 7-day retention at 500 MB/s?

**Assumptions**
- Ingest: 500 MB/s sustained.
- Retention: 7 days.
- Replication factor: 3.
- Compression: assume 2× (so on-disk is half the raw; conservatively, let's compute raw then halve).

**Math**
- Per day raw: 500 MB/s × 86,400 s ≈ 43.2 TB/day. Round to ~43 TB/day.
- 7 days raw: 43 × 7 ≈ 300 TB.
- × replication factor 3: 300 × 3 = 900 TB.
- ÷ 2 for compression: ~450 TB.
- Add ~25% headroom (don't run disks full): ~560 TB.

**Estimate:** **~0.5–0.6 PB** of disk across the cluster. With ~10 TB usable per broker, that's roughly **50–60 brokers** just for storage (CPU/network may push it higher).

---

### E3. Size a worker pool to keep a job queue from backing up.

**Assumptions**
- Incoming jobs: 2,000 jobs/s peak.
- Average job processing time: 200 ms of CPU-bound work (5 jobs/s per worker thread).
- Want to drain peak with ~30% headroom; SLO: oldest message age < 10 s.

**Math**
- Throughput per worker thread: 1 / 0.2 s = 5 jobs/s.
- Threads needed for steady peak: 2,000 ÷ 5 = 400 threads.
- With 30% headroom: ~520 threads.
- If a worker runs 8 threads: 520 ÷ 8 ≈ 65 worker instances.
- Backlog check: if a 3× spike (6,000/s) hits for 30 s while at 520-thread capacity (2,600/s drain), backlog grows at 3,400/s → 102k jobs queued; draining the excess at (2,600−2,000)=600/s spare takes ~170 s — too slow for a 10 s SLO, so autoscale must add capacity during spikes.

**Estimate:** **~65 worker instances (~520 threads)** baseline, with **autoscaling on queue depth** to handle spikes within the age SLO.

---

### E4. Estimate network bandwidth for a fan-out (1 event → N consumer groups).

**Assumptions**
- Topic ingest: 100,000 events/s, 2 KB each → 200 MB/s in.
- 5 independent consumer groups each read the full stream.
- Replication factor 3 (inter-broker replication traffic counts too).

**Math**
- Producer in: 200 MB/s.
- Replication (followers fetch from leaders): roughly (RF − 1) × ingest = 2 × 200 = 400 MB/s of inter-broker traffic.
- Consumer out: 5 groups × 200 MB/s = 1,000 MB/s = 1 GB/s read.
- Total broker NIC traffic ≈ 200 (in) + 400 (replication) + 1,000 (out) = **~1.6 GB/s** aggregate across the cluster.

**Estimate:** **~1.6 GB/s** cluster-wide (~13 Gbps). Spread across, say, 10 brokers that's ~160 MB/s each — comfortable on 10 GbE, but fan-out is the dominant cost (consumer reads ≫ producer writes), so adding consumer groups scales egress linearly. This is why "just add another consumer group" is not free at scale.
