# Scaling — System Design Questions

[← Topic overview](../README.md)

> Topic: Horizontal/vertical, load balancing, stateless design.

Each prompt is structured: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.** Use these to rehearse the full arc, not just the diagram.

---

## D1. Scale a read-heavy product catalog service from 1k to 1M users

**Requirements / Scale**
- Functional: browse/search products, view product detail, see price/stock.
- Non-functional: p99 < 150 ms reads; 50:1 read:write ratio; ~5k RPS peak reads at 1M users; stock must be reasonably fresh (seconds).
- Catalog: ~10M products, ~2 KB each ≈ 20 GB.

**High-level design**
- Stateless API tier behind an L7 load balancer with autoscaling.
- CDN for product images + cacheable detail responses (cache-control + ETag).
- Redis cache in front of the DB for hot products (cache-aside).
- Primary Postgres for writes; 2–3 read replicas for reads.
- Search served by a dedicated index (Elasticsearch/OpenSearch), kept in sync via change-data-capture.

**Data model**
- `products(product_id PK, name, attrs JSONB, price, updated_at)`
- `inventory(product_id PK, stock, version)` — separated so high-churn stock writes don't bloat the catalog row.
- Search index: denormalized product doc (name, attrs, category) for full-text + facets.

**Scaling & bottlenecks**
- Reads: CDN + Redis absorb the bulk; replicas handle cache misses. A 90%+ hit rate keeps origin RPS low.
- Hot products (a viral item) → use local in-process cache + request coalescing to avoid Redis hot-key and stampede.
- Search scales independently of the OLTP DB.
- Writes are light; primary handles them comfortably; CDC feeds cache invalidation + search.

**Tradeoffs & failure modes**
- Stale price/stock from caching — bound TTLs (e.g., 30–60 s) and invalidate on write; show "verify at checkout."
- Replica lag — read-your-writes for seller edits routed to primary.
- CDN/Redis down → degrade to replicas (raise capacity headroom for this).
- Search index drift if CDC lags — periodic reconciliation job.

---

## D2. Make a stateful session-based web app horizontally scalable

**Requirements / Scale**
- Existing monolith uses in-memory HTTP sessions and sticky LB. Needs to autoscale and survive node loss; 100k concurrent sessions.

**High-level design**
- Externalize sessions to Redis (or signed/encrypted JWT for stateless auth).
- Remove sticky sessions; switch LB to least-connections round-robin.
- Make file uploads go to object storage (S3) instead of local disk.
- Move background jobs from in-process threads to a queue + worker fleet.

**Data model**
- `session:{sid}` → JSON blob in Redis, TTL = idle timeout; sliding expiry on access.
- Or JWT: signed claims, short-lived access token + refresh token (revocation list in Redis).

**Scaling & bottlenecks**
- Now any node serves any request → free autoscaling and rolling deploys.
- Redis becomes a critical dependency → run it HA (replica + Sentinel/cluster); size for session count × blob size.
- JWT avoids the Redis round-trip but is hard to revoke instantly and grows the header.

**Tradeoffs & failure modes**
- Redis session store down → all users logged out; mitigate with HA + graceful re-auth.
- JWT: stateless and fast but revocation/rotation complexity and token bloat.
- Sticky-session removal exposes any hidden node-local state (caches, temp files) — audit for it.

---

## D3. Design the scaling strategy for a write-heavy event ingestion pipeline

**Requirements / Scale**
- 500k events/sec at peak (IoT/telemetry), each ~500 bytes. Durable, queryable within minutes. Bursty.

**High-level design**
- Stateless ingestion edge (autoscaled) that validates + writes to a partitioned log (Kafka) — never directly to the OLTP DB.
- Kafka partitioned by device/tenant key for parallelism and ordering per key.
- Stream consumers batch-write to a columnar store (ClickHouse/BigQuery) for analytics; a hot store (Redis/time-series DB) for recent data.
- Backpressure: edge returns 429/503 when the log is saturated; clients buffer + retry.

**Data model**
- Kafka topic `events`, key = `device_id`, value = event payload.
- Analytics table partitioned by time + device for pruning.

**Scaling & bottlenecks**
- Write scaling comes from **partitioning** — add partitions/brokers and consumers.
- Hot partition if one device dominates → composite key or sub-partitioning.
- Consumer lag is the key metric; autoscale consumers on lag, not CPU.
- The OLTP DB is deliberately *off* the hot write path.

**Tradeoffs & failure modes**
- At-least-once delivery → consumers must be idempotent (dedup by event id).
- Burst beyond log capacity → backpressure + client buffering vs dropping low-value events.
- Rebalancing storms when consumers churn — tune session timeouts.
