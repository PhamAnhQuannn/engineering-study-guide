# Scaling — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Horizontal/vertical, load balancing, stateless design.

Each prompt names options, asks for a reasoned recommendation, and a "what would change the answer." There is rarely a single right answer — the reasoning is graded.

---

### DC1. Vertical scaling vs horizontal scaling for a service approaching its limits

**Options:** A) Resize to a bigger instance. B) Add nodes behind a load balancer.

**Recommendation:** If the tier is **stateless or cheap to make stateless**, scale **horizontally** — it gives a ceiling and HA. If it's the **stateful DB primary** or the change is urgent and you're nowhere near the instance ceiling, **scale up** now and plan horizontal later. Pragmatic default for app tiers: horizontal; for the primary DB: vertical first, then read replicas/sharding.

**What changes it:** Hard instance ceiling reached → must go horizontal. Strong single-node consistency need → vertical. Tight deadline + no statelessness work done → vertical buys time.

---

### DC2. Sticky sessions vs externalized session store

**Options:** A) LB session affinity (sticky). B) Sessions in Redis. C) Stateless JWT.

**Recommendation:** **Externalize (B)** for most web apps — keeps the tier stateless, survives node loss, enables autoscaling and rolling deploys. Use **JWT (C)** when you want to avoid a session-store round-trip and can tolerate harder revocation. Avoid **sticky (A)** except as a stopgap.

**What changes it:** Hard revocation/immediate logout requirement → Redis over JWT. Extreme latency sensitivity + no need for instant revocation → JWT. Legacy app you can't refactor yet → sticky as temporary bridge.

---

### DC3. Read replicas vs caching to scale reads

**Options:** A) Add read replicas. B) Add a Redis/Memcached cache. C) Both.

**Recommendation:** **Cache first (B)** — best $/throughput for hot, repeatable reads, and it offloads the DB entirely. Add **replicas (A)** for cache-miss traffic, low-cardinality-but-fresh data, and reads that can't be cached. In practice **C** (cache + a replica or two).

**What changes it:** Highly cacheable, skewed-popularity data → caching dominates. Low cache hit rate (long-tail unique queries) → replicas matter more. Strong freshness needs → smaller TTLs or replica reads over stale cache.

---

### DC4. Shard now vs scale up the database and shard later

**Options:** A) Shard the DB today. B) Vertical scale + read replicas, defer sharding.

**Recommendation:** **Defer (B)** unless you're clearly write- or storage-bound and the trend line crosses the primary's ceiling soon. Sharding adds permanent complexity (cross-shard joins/transactions, resharding pain). Buy time with bigger hardware, replicas, caching, and archiving cold data. Shard when writes/storage — not reads — are the proven wall.

**What changes it:** Write throughput or single-node storage is the bottleneck → shard. A clear, well-distributed shard key exists and growth is explosive → shard sooner. Mostly read-bound → keep deferring.

---

### DC5. L4 vs L7 load balancing

**Options:** A) L4 (NLB). B) L7 (ALB/Envoy/NGINX).

**Recommendation:** **L7** for HTTP services that benefit from path/host routing, TLS termination, retries, sticky options, and observability. **L4** for raw TCP/UDP, non-HTTP protocols, extreme throughput, or when you want TLS to pass through untouched.

**What changes it:** Need content-based routing, WAF, or per-route policy → L7. Ultra-low latency, gRPC streaming at scale, or end-to-end TLS to the backend → L4. Often you layer both (L4 edge → L7 internal).

---

### DC6. Autoscale on CPU vs RPS vs queue depth vs p95 latency

**Options:** A) CPU. B) Request rate. C) Queue depth. D) Latency SLO.

**Recommendation:** Scale on **the signal that saturates first**. CPU-bound compute → CPU. I/O- or downstream-bound services → RPS or **latency (D)** so you react before users feel it. Async worker fleets → **queue depth/lag (C)**, which is the most direct backlog signal. CPU is the lazy default and is often wrong.

**What changes it:** Service is I/O- or connection-bound → CPU never trips; use RPS/latency. Bursty async workloads → queue depth. Strict SLO → latency-based scaling with warmup buffer.

---

### DC7. Single large region vs multi-region active-active

**Options:** A) One region, multi-AZ. B) Multi-region active-active.

**Recommendation:** **One region, multi-AZ (A)** for most products — far simpler, gives HA against AZ failure, and dodges cross-region consistency and data-residency complexity. Go **active-active (B)** only when you need low global latency, regional fault tolerance, or compliance-driven data locality, and you can accept conflict-resolution complexity and cost.

**What changes it:** Global user base with strict latency targets → multi-region. Regulatory data residency → regional. Disaster-recovery RTO/RPO requirements that one region can't meet → at least active-passive multi-region.
