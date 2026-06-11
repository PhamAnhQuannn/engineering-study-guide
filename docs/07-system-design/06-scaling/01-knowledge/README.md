# Scaling — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Horizontal/vertical, load balancing, stateless design.

Scaling is the discipline of growing a system's capacity to handle more load (traffic, data, users) while holding latency, availability, and cost within acceptable bounds. At the senior level you are expected to reason about *where* the bottleneck actually is, not just to recite "add more servers."

> **🛒 Where we are in building ShopFast** — We have a [modular monolith](../../04-architecture-styles/01-knowledge/README.md) with [REST APIs](../../03-api-design/01-knowledge/README.md) and a [Redis cache](../../02-caching/01-knowledge/README.md). Caching bought us breathing room, but ShopFast is on TV and traffic 10×'d — one app box pegs its CPU and the single Postgres is maxing connections. This topic grows capacity past one machine. **Next:** more moving parts fail more often — [Resilience](../../05-resilience/01-knowledge/README.md) keeps it standing.

---

## Teaching arc: growing ShopFast past one box

### What it is
**Scaling** is making your system handle more load without falling over. Two directions: **scale up** (a bigger machine — like buying a faster oven) and **scale out** (more machines — like opening more kitchens). Scaling up is easy but has a ceiling (there's a biggest oven). Scaling out has no ceiling but needs the work to be *splittable* — which is why **statelessness** (no kitchen remembers your order) is the key that unlocks it.

### What it looks like
The scaled request path — one entry point fanning out to many interchangeable workers, with state pushed to the edges:

```text
                         ┌─ app #1 ─┐
client → DNS → CDN → LB ─┼─ app #2 ─┼─→ Redis cache
                         └─ app #3 ─┘        │
                          (stateless,        ├─→ Postgres PRIMARY  (writes)
                           add/remove        └─→ read replicas      (reads)
                           freely)
                              slow work ──→ queue ──→ workers
```

Any app box can serve any request (stateless), so you add/remove them freely behind the load balancer.

### The code that builds it
Statelessness is what makes the fleet horizontally scalable. The anti-pattern vs the fix:

```typescript
// ❌ stateful: session lives in THIS node's memory → only this node can serve the user
const sessions = new Map<string, Session>();          // lost on restart; breaks with >1 node
app.use((req) => { req.session = sessions.get(req.cookies.sid); });

// ✅ stateless: session externalized to Redis → ANY node can serve ANY request
app.use(async (req) => {
  req.session = JSON.parse((await redis.get(`sess:${req.cookies.sid}`)) ?? "null");
});

// reads go to a replica, writes to the primary — splits load across the data tier
const product = await replicaPool.query("SELECT * FROM products WHERE id=$1", [id]);
await primaryPool.query("UPDATE inventory SET stock=stock-1 WHERE id=$1", [id]);
```

### The code that calls it
The "caller" of a scaled tier is the load balancer config — it fans requests across the stateless fleet and ejects unhealthy nodes:

```yaml
# load balancer: round-robin across the fleet, health-checked
upstream shopfast_app {
  least_conn;                       # send to the node with fewest in-flight requests
  server app1:8080;
  server app2:8080;
  server app3:8080;                 # add a line to scale out; LB picks it up
}
# /healthz must check readiness (DB pool up, cache reachable), not just liveness
```

### Types & differences
| Lever | Scales | Reach for it when |
|---|---|---|
| **Vertical (scale up)** | everything, simply | early stage; the DB tier; latency-sensitive single node |
| **Horizontal (scale out)** | stateless tiers | web/app tier, read-heavy services, need HA (**ShopFast app tier**) |
| **Read replicas** | reads only | read:write skew is high (**ShopFast catalog**) |
| **Sharding** | writes + storage | one primary can't hold the write/data volume |
| **Caching/CDN** | dodges load entirely | the cheapest win — do this first (see Caching) |

### Build it for real — ShopFast
The bottleneck is two different things and we must not confuse them: the **app tier** is CPU-bound (fixable by adding boxes) and the **DB** is connection- and read-bound. "Just add servers" would make the DB *worse* (more app nodes → more connections → meltdown). 

**Decision:** make the app tier **stateless** (sessions → Redis), put it **behind an L7 load balancer** with autoscaling, and add **read replicas** so the read-heavy catalog spreads across copies while writes funnel to one primary. Add a **connection pooler** (PgBouncer) so 100 app nodes don't open 100× connections. **Rejected (for now):** sharding the DB — it's a painful, hard-to-reverse migration we don't yet need; one primary + replicas + cache still has headroom.

> **If we forgot the pooler:** 100 app nodes × 100 pool connections = **10,000 connections**, but Postgres degrades past ~300–500 — so "just add app boxes" would *cause* the outage it was meant to prevent. The bottleneck moved to the DB; scaling the app tier blindly makes it worse.

### Scaling story
- **Now (cheap):** one app box + one Postgres, stateless from day one. *Placeholders we leave:* externalize session/state and route DB reads through a `replicaPool` interface (pointed at the primary today) so adding replicas later is a config change, not a rewrite. Cost: ~one server.
- **Growth signal:** app CPU pegs at peak (add boxes); read p99 (99th-percentile latency) climbs and the primary's read QPS (Queries Per Second) dominates (add replicas); connection count nears Postgres's ~300–500 ceiling (add a pooler); finally **write** TPS or data size outgrows one primary (the shard signal).
- **At scale (millions → hundreds of millions):** autoscaling stateless fleet behind the LB; CDN + [cache](../../02-caching/01-knowledge/README.md) absorbing most reads; read replicas for the rest; **shard** the DB on a high-cardinality key (e.g. `product_id`) only once writes/storage force it; push slow work (emails, analytics) to a **queue**. Each new hop adds failure surface → lean on [Resilience](../../05-resilience/01-knowledge/README.md), and size every step with [Capacity Estimation](../../06-capacity-estimation/01-knowledge/README.md).

---

## Core concepts

### Vertical scaling (scale up)
Add more resources (CPU, RAM, faster disk, NIC) to a single machine.

- **Pros:** trivial — no code change; no distributed-systems complexity; stronger single-node consistency; lower latency (no network hop).
- **Cons:** hard ceiling (biggest instance available); cost grows super-linearly at the top end; single point of failure; usually requires downtime or a failover to resize.
- **When:** early-stage products, the database tier (often the *last* thing you can horizontally scale cheaply), latency-sensitive single-node workloads.

### Horizontal scaling (scale out)
Add more machines and distribute load across them.

- **Pros:** near-linear capacity growth; commodity hardware; natural redundancy/HA; elastic (autoscaling).
- **Cons:** requires statelessness or shared state coordination; introduces network partitions, consistency, and data-distribution problems; harder to debug.
- **When:** stateless web/app tiers, read-heavy services, anything that must survive node loss.

> **Senior framing:** Vertical scaling buys you time; horizontal scaling buys you a ceiling. Most real systems do *both* — scale up the DB, scale out the stateless tier.

### Stateless design
A node is **stateless** if any request can be served by any node with no node-local memory of prior requests. State is externalized to a shared store (DB, Redis, object storage).

- Enables trivial horizontal scaling and rolling deploys.
- **Session state** is the usual culprit. Options: sticky sessions (couples client→node, hurts elasticity), or externalized sessions (Redis/DB/JWT). Prefer externalized.
- "Stateless" doesn't mean *no* state — it means *no node-local durable state*. Caches may live locally but must be treated as disposable.

### Load balancing
Distributes requests across a pool of backends.

- **L4 (transport)**: routes by IP/port, fast, protocol-agnostic (e.g., AWS NLB). No visibility into HTTP.
- **L7 (application)**: routes by HTTP path/host/header/cookie; can do TLS termination, retries, rate limiting (e.g., ALB, NGINX, Envoy).
- **Algorithms:** round-robin, least-connections, least-response-time, weighted, consistent hashing (sticky to a node by key — useful for cache locality), IP-hash.
- **Health checks:** active (LB probes `/healthz`) and passive (eject backends after N consecutive 5xx). Distinguish **liveness** (process up) from **readiness** (ready to serve — warmed caches, DB pool connected).

### Replication & sharding (data scaling)
- **Read replicas:** copies of the DB that serve reads. Scales reads, not writes. Beware **replication lag** → read-your-own-writes anomalies.
- **Sharding (horizontal partitioning):** split data across nodes by a shard key (hash, range, or directory-based). Scales writes and storage. Costs: cross-shard joins/transactions become hard; **hot shards** if the key is skewed; resharding is painful. Choose a high-cardinality, evenly-distributed key.
- **Functional partitioning:** split by feature/domain (users DB, orders DB) — a precursor to microservices.

### Caching as a scaling lever
Caching (client, CDN, reverse proxy, app-level Redis/Memcached, DB buffer pool) often gives the best $/throughput. A 90% cache hit rate cuts origin load 10×. (See the dedicated Caching topic.)

### Autoscaling
- **Reactive:** scale on a metric (CPU %, RPS, queue depth, p95 latency). Watch for the **scale-up lag** (cold start + warmup) vs traffic spike.
- **Predictive/scheduled:** scale ahead of known patterns (business hours, flash sale).
- Scale on the metric that actually saturates first — CPU is the default but is often *wrong* (you may be I/O- or connection-bound).

---

## How it works under the hood

A typical scaled request path:

```
Client → DNS (GeoDNS/anycast) → CDN/edge → L7 LB → stateless app fleet
            → cache (Redis) → primary DB (writes) / read replicas (reads)
            → async work pushed to a queue → workers
```

- **DNS/anycast** spreads traffic geographically before it ever reaches your LB.
- **CDN** absorbs static/cacheable traffic at the edge.
- **LB** fans out to a fleet that can be added/removed freely *because it is stateless*.
- **Writes funnel to a primary**; reads spread to replicas; heavy/slow work is **shed to a queue** so the request path stays fast.

The recurring pattern: **push state down and out, push slow work async, keep the request path stateless and cacheable.**

---

## Key terms & definitions

| Term | Definition |
|---|---|
| Throughput | Requests/units processed per unit time (RPS, QPS). |
| Latency | Time to serve one request (track p50/p95/p99, not mean). |
| Tail latency | High-percentile latency (p99/p99.9); dominates UX at scale. |
| Scalability | How throughput grows as you add resources (ideally linear). |
| Sticky session | LB pins a client to one backend (session affinity). |
| Shard key | Attribute used to route a row/object to a partition. |
| Hot shard/key | A partition receiving disproportionate load. |
| Replication lag | Delay before a write is visible on a replica. |
| Backpressure | Signaling upstream to slow down when overloaded. |
| Connection pool | Reused set of DB connections to bound concurrency. |
| Amdahl's Law | Speedup is capped by the serial fraction of work. |
| Universal Scalability Law (USL) | Adds a *coherency/crosstalk* penalty — throughput can *decline* past a point. |

---

## Tradeoffs

- **Consistency vs availability/latency** (CAP/PACELC): replicas and caches trade fresh reads for scale.
- **Stateless simplicity vs cache locality:** consistent hashing/sticky sessions improve hit rates but reduce elasticity and complicate node loss.
- **Sharding now vs later:** sharding early adds complexity you may not need; sharding late is a painful migration. Pick the shard key carefully because changing it is expensive.
- **Vertical (simple, ceiling) vs horizontal (complex, scalable).**
- **Autoscaling responsiveness vs cost/thrash:** aggressive scaling chases spikes but flaps; conservative scaling is cheaper but risks saturation.

---

## Common pitfalls & misconceptions

- **"Just add servers."** If the bottleneck is a single primary DB or a shared lock, more app servers make it *worse*.
- **Optimizing the mean, ignoring the tail.** Users feel p99. Fan-out requests are bound by their *slowest* dependency.
- **Sticky sessions everywhere** → defeats elasticity; a node loss drops all its sessions.
- **Ignoring connection limits.** 1,000 app servers × 100 pool connections = 100k connections that will melt a Postgres primary. Use a pooler (PgBouncer/RDS Proxy).
- **Assuming linear scaling.** Coordination/locking/crosstalk (USL) means throughput can plateau or regress — measure it.
- **Cache stampede / thundering herd** on cold cache or mass expiry.
- **Scaling the symptom, not the cause** — e.g., scaling web tier when the DB is the wall.

---

## What interviewers probe

- "Where's the bottleneck and how do you *know*?" — push toward metrics (p99, CPU, DB connections, queue depth), not guesses.
- "Walk me from 100 RPS to 100k RPS." — expect a staged plan: vertical → cache/CDN → read replicas → stateless fleet + LB → async queue → shard the DB.
- "How do you keep the app tier stateless?" — externalize sessions, treat local cache as disposable.
- "What breaks first as you scale?" — usually the stateful tier (DB writes, connections) or a shared lock.
- "Sticky vs stateless sessions — tradeoffs?"
- "How do you pick a shard key, and what goes wrong?"
- Tail-latency reasoning under fan-out (hedged requests, timeouts).

---

## Quick-reference summary

- **Scale up** first (simple, has a ceiling); **scale out** for the ceiling (needs statelessness).
- **Statelessness** is the enabler for horizontal scaling, rolling deploys, and autoscaling — externalize state.
- **The stateful tier scales last and hardest:** replicas for reads, sharding for writes/storage, caching to dodge load entirely.
- **Measure the tail (p95/p99)**, watch for **hot keys/shards**, **connection exhaustion**, and **coordination penalties (USL)**.
- A clean staged story — vertical → cache/CDN → replicas → stateless fleet+LB → async → shard — is what "senior" sounds like.
