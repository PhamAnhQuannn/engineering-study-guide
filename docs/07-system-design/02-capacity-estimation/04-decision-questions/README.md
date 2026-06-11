# Capacity Estimation — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: QPS, storage, bandwidth napkin math.

Named options, a reasoned recommendation, and "what would change the answer." These connect estimates to architecture choices.

---

### DC1. Provision for peak vs provision for average + autoscale

**Recommendation:** **Provision for average + autoscale toward peak** for elastic, cloud-native stateless tiers — it's cheaper and right-sizes continuously. **Provision for peak** (static) when spikes are too fast for autoscaling to react (sub-minute), when cold-start lag is high, or for stateful tiers that can't scale quickly. Often: baseline provisioned + autoscaling buffer + scheduled pre-warm for known events.

**What changes it:** Predictable, gradual load → average + autoscale. Sudden flash spikes / slow warmup → pre-provision for peak. Known event (sale) → scheduled scaling.

---

### DC2. Scale storage by sharding vs by tiering to cold storage

**Recommendation:** **Tier to cold storage** first when most data is rarely accessed (logs, old photos, history) — move cold data to cheaper object/archival storage, keep hot data fast. **Shard** when the *hot/active* dataset or write throughput exceeds a single node. They combine: shard the hot path, tier the cold tail.

**What changes it:** Large but mostly-cold dataset → tiering. Active working set or write rate exceeds one node → shard. Compliance retention of cold data → archival tier.

---

### DC3. Add read replicas vs add a cache when reads dominate

**Recommendation:** **Cache first** — for skewed, repeatable reads it gives the best $/throughput and offloads the DB entirely. **Replicas** for cache-miss traffic, long-tail unique queries, and reads needing fresher data than a cache TTL allows. The estimate decides: very high read:write + skew → caching dominates; low cache hit rate → replicas matter more.

**What changes it:** Highly cacheable/skewed reads → cache. Long-tail unique queries (low hit rate) → replicas. Strong freshness needs → replicas/primary reads over stale cache.

---

### DC4. Single large database vs shard now, based on growth estimate

**Recommendation:** Use the estimate: if projected **writes/storage stay within a single primary's ceiling** (with vertical scaling + replicas + caching headroom) for the planning horizon, **stay single** and defer sharding's permanent complexity. If the trend line clearly crosses the ceiling on writes or storage soon, **plan sharding** with a good key before you hit the wall (resharding under fire is painful).

**What changes it:** Estimate shows write/storage exceeding one node within horizon → shard. Mostly read-bound or comfortably under ceiling → single + replicas/cache. Explosive, unpredictable growth → shard earlier.

---

### DC5. CDN vs scaling origin bandwidth for static/media-heavy load

**Recommendation:** **CDN, essentially always** for static assets and media — the estimate usually shows origin bandwidth in the Gbps–Tbps range, which is impractical and expensive to serve directly; a CDN offloads 90–95%+ and cuts latency globally. Scale origin bandwidth directly only for non-cacheable, dynamic, or tiny-volume workloads.

**What changes it:** Cacheable/static/media at scale → CDN (the bandwidth math forces it). Highly dynamic, per-user, non-cacheable responses → origin (with app-level caching). Tiny traffic → CDN may be overkill but is still cheap.

---

### DC6. Optimize for storage cost vs query/latency performance

**Recommendation:** Let the dominant resource from your estimate decide. If **storage is the dominant cost** (media, logs, history), optimize it — compression, tiering, dedup, columnar formats — accepting some query overhead. If **latency/throughput is the constraint** (hot OLTP path), spend storage to buy speed — denormalize, add indexes, keep the working set in RAM. You can't fully maximize both; the estimate tells you which side dominates.

**What changes it:** Storage-dominated workload (cheap, cold, huge) → compress/tier. Latency-critical hot path → denormalize/index/cache (trade storage for speed). Mixed → split hot (perf-optimized) from cold (cost-optimized).

---

### DC7. Trust a rough estimate vs run a load test before committing capacity

**Recommendation:** Use the **rough estimate** to choose the architecture and rule out infeasible designs (it's fast and catches order-of-magnitude problems). **Load-test** before committing real money/SLAs, because per-machine throughput rules-of-thumb vary widely by workload (the estimate's weakest assumption). Estimate to design; measure to provision.

**What changes it:** Early design / feasibility → estimate. Pre-launch capacity commitment, SLO guarantees, or surprising per-node assumptions → load test. High blast radius / cost → always validate with measurement.
