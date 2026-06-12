# Social Platform Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Follow graph, feed, stories, DMs (Direct Messages), media pipeline, explore/discovery.

Designing a social platform like Instagram or Twitter is the ultimate **composition challenge** — you're not building one system, you're assembling six subsystems (graph, feed, messaging, media, search, safety) into one coherent architecture. The senior skill is knowing which subsystems to deep-dive and which to sketch, because no 45-minute interview covers all of them.

> **🛒 Where we are in building ShopFast** — The [Design Drills](../../08-design-drills/01-knowledge/README.md) gave us five focused systems (URL shortener, feed, chat, rate limiter, notifications). This topic zooms out: what happens when you combine several of those into one platform? Imagine ShopFast adding a social layer — product reviews with follow graphs, a feed of activity from shops you follow, ephemeral "deal stories," and DMs between buyers and sellers. **Next:** [Collaborative Editor Design](../../10-collaborative-editor/01-knowledge/README.md) tackles an even harder real-time problem — concurrent editing of shared state.

---

## Why it matters

Social platforms are the most common "big" system design question because they test breadth AND depth. The interviewer sees whether you can:
1. **Decompose** a large system into well-bounded services
2. **Prioritize** which subsystems matter most at scale (the feed, always the feed)
3. **Reuse** known patterns ([hybrid fan-out](../../08-design-drills/01-knowledge/README.md), [cache-aside](../../05-caching/01-knowledge/README.md), [WebSocket gateways](../../../04-networking/05-websockets/01-knowledge/README.md))
4. **Navigate tradeoffs** (consistency vs freshness, privacy vs performance)

---

## The subsystems

### 1. Follow graph
Unidirectional (Twitter/Instagram) vs bidirectional (Facebook friends). Stored as adjacency list in Postgres: `follows(follower_id, followee_id)`. The graph drives everything — feed fan-out cost, DM permissions, privacy checks. At scale, the celebrity problem (one user with millions of followers) is the dominant constraint.

### 2. Feed service
The hardest subsystem. Hybrid fan-out from [Design Drills D2](../../08-design-drills/01-knowledge/README.md): **fan-out-on-write** for normal users (push post IDs into followers' Redis feed caches), **fan-out-on-read** for celebrities (pull their posts at feed-assembly time). Feed cache per user is a sorted set of post IDs, capped at ~500. Ranking: algorithmic by default (engagement signals), chronological as a toggle.

### 3. Stories (ephemeral content)
24-hour TTL (Time To Live) content. Write-heavy (2B/day created) AND delete-heavy (2B/day expired). Separate from posts — use a store with native TTL (DynamoDB, Cassandra) so expired stories evaporate without explicit DELETE statements. Ring buffer per user. Different access pattern than the permanent feed.

### 4. DM service
WebSocket gateway + connection registry (Redis: user→gateway mapping). Message persistence in a wide-column store partitioned by conversation, ordered by sequence number. Offline users get push notifications + sync on reconnect. Reuses patterns from [Design Drills D3](../../08-design-drills/01-knowledge/README.md) (chat system).

### 5. Media pipeline
Upload → validate → transcode/resize (multiple sizes for different screens) → store in S3 → distribute via CDN (Content Delivery Network). Async processing — the post is visible immediately with a placeholder; media renders when ready. Petabytes of storage; tiered (hot CDN edge, warm S3, cold Glacier).

### 6. Search and explore
Elasticsearch for posts, users, hashtags. Near-real-time indexing via Kafka consumer. Explore page: pre-computed trending content + personalized recommendations from an offline ML pipeline.

---

## ShopFast case: adding a social layer

> **Scenario:** ShopFast wants sellers to post product updates, buyers to follow shops, and a feed showing activity from followed shops. Stories for flash deals. DMs for buyer-seller communication.

**Decision:** decompose into independent services behind the existing [API gateway](../../04-api-design/01-knowledge/README.md). Feed service reuses [caching](../../05-caching/01-knowledge/README.md) patterns (Redis sorted sets). DMs use WebSocket gateway from the existing notification infrastructure. Media pipeline is shared with product image uploads.

**Why not a monolith?** Each subsystem has wildly different scaling characteristics — the feed is read-heavy (50:1), DMs are connection-heavy, media is bandwidth-heavy. Independent [scaling](../../06-scaling/01-knowledge/README.md) per service avoids over-provisioning.

**Rejected:** building feed as a simple "query all followed shops' recent posts" — doesn't scale past 10k follows. Hybrid fan-out is necessary.

---

## Lessons and pitfalls

1. **Scope in the interview.** Declare which 2–3 subsystems you'll deep-dive. "I'll focus on the feed and the follow graph, and sketch the rest." The interviewer wants depth, not a surface tour of everything.

2. **Privacy is cross-cutting.** Private accounts mean every read path must check visibility. Don't forget: feed, search, explore, DMs — all affected. This is the kind of cross-cutting concern that separates a senior answer from a junior one.

3. **Stories are NOT posts.** Different storage, different access pattern, different TTL. Mixing them into the same store degrades both workloads. See the [decision question on same vs separate store](../04-decision-questions/README.md).

4. **The celebrity problem never goes away.** Any user with >100k followers breaks naive fan-out-on-write. The hybrid approach (threshold-based switch between write and read fan-out) is the standard solution. Know the threshold tuning tradeoff.

5. **Content moderation is a requirement, not a nice-to-have.** Mention it early — automated scanning + manual review queue + report system. The [resilience](../../07-resilience/01-knowledge/README.md) patterns (rate limiting, circuit breakers) apply to the moderation pipeline too.
