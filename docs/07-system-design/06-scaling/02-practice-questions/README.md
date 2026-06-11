# Scaling — Practice Questions

[← Topic overview](../README.md)

> Topic: Horizontal/vertical, load balancing, stateless design.

A mix of recall, "explain to a junior," and multiple-choice. Try to answer before reading the **Answer**.

---

### Q1. What is the difference between vertical and horizontal scaling, and when do you prefer each?

**Answer:** Vertical scaling (scale up) adds resources to a single node (CPU/RAM/disk); horizontal scaling (scale out) adds more nodes and distributes load. Prefer **vertical** when you want simplicity and no distributed complexity, for latency-sensitive single-node work, and notably for the **database primary**, which is hard to scale out. Prefer **horizontal** for the stateless web/app tier, read-heavy services, and anything that must survive node failure or scale beyond the biggest available instance. Real systems do both: scale the DB up, scale the app tier out.

---

### Q2. Explain "stateless design" to a junior. Why does it matter for scaling?

**Answer:** A stateless server keeps no node-local memory of past requests, so *any* server can handle *any* request. Imagine a coat check where any clerk can fetch your coat because the ticket+rack is shared — versus one clerk who alone remembers where your coat is. If state lives in one server (e.g., in-memory session), you must route the user back to that exact server (sticky sessions), and if it dies their data is gone. By externalizing state to Redis/DB/JWT, you can add or remove servers freely, do rolling deploys, and autoscale — which is the whole point of horizontal scaling.

---

### Q3. What is the difference between L4 and L7 load balancing?

**Answer:** L4 (transport-layer) balances on IP/port — fast, protocol-agnostic, no HTTP awareness (e.g., AWS NLB). L7 (application-layer) understands HTTP, so it can route by path/host/header/cookie, terminate TLS, do retries, rate limiting, and sticky sessions (e.g., ALB, NGINX, Envoy). L7 is more flexible and feature-rich; L4 is faster and cheaper for raw throughput or non-HTTP protocols.

---

### Q4. Read replicas scale reads. What new problem do they introduce, and how do you handle it?

**Answer:** **Replication lag** — a write committed on the primary isn't instantly visible on replicas, causing read-your-own-writes anomalies (user posts a comment, refreshes, it's gone). Mitigations: route a user's reads to the primary for a short window after their write; use causal/session consistency tokens; read from the primary for critical reads; or accept eventual consistency where UX allows. Also: replicas don't help write throughput at all — for that you need sharding.

---

### Q5. You add 4× app servers but throughput barely improves. List likely causes.

**Answer:** A shared bottleneck downstream is the cause: (1) the **database primary** is saturated (CPU, I/O, or write contention); (2) **connection exhaustion** — too many app servers × pool size overwhelming the DB (need a pooler); (3) a **shared lock** or single-threaded resource serializes work; (4) the load balancer or a downstream dependency is the wall; (5) **coordination overhead** (Universal Scalability Law) where crosstalk cancels added capacity. The app tier was never the bottleneck.

---

### Q6. What makes a good shard key? Give a bad example.

**Answer:** A good shard key has **high cardinality** and **even access distribution**, and matches your dominant query pattern so most queries hit one shard. Good: `user_id` (hashed) for a per-user workload. Bad: `country` (low cardinality, skewed — one mega-shard for the US) or `created_at` (all new writes hit the newest shard → a hot shard). Sequential keys create write hotspots; pick something that spreads load and avoid keys that force cross-shard joins.

---

### Q7. Explain "tail latency" and why it dominates at scale.

**Answer:** Tail latency is high-percentile latency (p99, p99.9) — the slow requests. It dominates because (a) users notice slow requests more than average ones, and (b) under **fan-out**, a request that hits 100 backends is as slow as the *slowest* of the 100, so even a 1% slow rate per backend means most fan-out requests hit a slow one. Mitigations: hedged/tied requests, tight timeouts, reducing fan-out, and removing GC/cold-cache stalls. Always report p95/p99, not the mean.

---

### Q8. What is autoscaling and what's a common way to get it wrong?

**Answer:** Autoscaling automatically adds/removes capacity based on a signal (CPU, RPS, queue depth, p95). Common mistakes: (1) scaling on **CPU when you're actually I/O- or connection-bound**, so it never reacts; (2) ignoring **warmup/cold-start lag** — instances arrive after the spike has already caused errors; (3) **thrashing/flapping** from too-tight thresholds; (4) no max bound, so a traffic bug scales you into a huge bill. Scale on the metric that saturates first, add warmup buffer, and use scheduled/predictive scaling for known peaks.

---

### Q9 (MCQ). Which change most directly enables a stateless app tier?

A. Switching from L4 to L7 load balancing
B. Storing user sessions in Redis instead of in-process memory
C. Adding a read replica
D. Increasing the connection pool size

**Answer: B.** Externalizing session state removes node-local state, letting any node serve any request. The others help scaling but don't make the tier stateless.

---

### Q10 (MCQ). Read replicas primarily scale:

A. Write throughput
B. Read throughput
C. Storage capacity per node
D. Cross-region consistency

**Answer: B.** Replicas serve reads. Writes still go to the primary (no write scaling), each replica holds the full dataset (no storage scaling), and they introduce lag, not stronger consistency.

---

### Q11 (MCQ). The Universal Scalability Law differs from Amdahl's Law chiefly by modeling:

A. Network bandwidth limits
B. Disk seek time
C. A coherency/crosstalk penalty that can make throughput *decrease*
D. Memory cache misses

**Answer: C.** USL adds a coherency term for inter-node coordination, so beyond a point adding nodes reduces throughput — Amdahl only caps speedup, never reverses it.

---

### Q12 (MCQ). Which is the *strongest* reason to avoid sticky sessions?

A. They increase TLS handshake cost
B. They couple a client to one node, hurting elasticity and losing sessions on node failure
C. They require L4 load balancing
D. They prevent TLS termination at the LB

**Answer: B.** Affinity undermines the elasticity and fault-tolerance that horizontal scaling is meant to provide.

---

### Q13. Give the staged plan to take a service from 100 RPS to 100k RPS.

**Answer:** (1) **Vertical scale** the box to buy time and profile. (2) Add **caching + CDN** to absorb cacheable load. (3) Make the app tier **stateless** and put it behind an **L7 load balancer** with autoscaling. (4) Add **read replicas** and route reads off the primary. (5) Push slow/async work to a **queue + workers** so the request path stays fast. (6) When write/storage limits hit, **shard** the database on a well-chosen key. Re-measure the bottleneck at each stage rather than guessing.
