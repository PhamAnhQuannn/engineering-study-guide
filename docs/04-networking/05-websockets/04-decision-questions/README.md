# WebSockets & Streaming — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: WebSockets, SSE, long polling, real-time tradeoffs.

Each prompt: the options, a reasoned recommendation, and **what would change the answer**.

---

### DQ1. WebSockets vs SSE vs Long Polling for a new real-time feature

**Recommendation:** Start from the **direction of data flow**.
- Server→client only (notifications, dashboards, token streams) → **SSE**: simpler, auto-reconnect, HTTP/2-friendly, CDN-compatible.
- Frequent bidirectional, low-latency (chat, games, collaborative editing) → **WebSockets**.
- Constrained environment (legacy proxies, no infra to add) or very infrequent updates → **long polling** as a fallback.

Default to the *simplest tool that meets the latency + directionality need*. SSE is underrated; reach for WebSockets only when you genuinely need the client to push often.

**What would change the answer:** If hostile corporate proxies strip the `Upgrade` header, WebSockets may fail and you fall back to long polling/SSE. If you need binary frames (audio, protobuf), SSE (text-only) is out → WebSockets. If updates are minutes apart, even short polling is fine and cheapest to operate.

---

### DQ2. Single shared WebSocket connection (multiplexed channels) vs one connection per feature

**Options:** (A) One WebSocket per browser tab carrying many logical channels (chat + presence + notifications multiplexed); (B) a separate connection per feature/team.

**Recommendation:** **One multiplexed connection (A)** for most apps. Each connection costs server memory, file descriptors, and a handshake; multiplexing logical streams over one socket amortizes that and simplifies reconnect logic. Add a thin envelope (`{channel, type, payload}`) for routing.

**What would change the answer:** If features have very different scaling/ownership (one team's noisy feature shouldn't degrade another's), or you want independent backpressure/failure isolation per stream, separate connections buy isolation at the cost of more sockets. Microfrontends owned by different teams sometimes justify (B).

---

### DQ3. Sticky sessions vs stateless gateways + external connection registry

**Options:** (A) Load balancer pins each client to one gateway (sticky); (B) any gateway can serve any client, routing via an external registry (Redis) + pub/sub backplane.

**Recommendation:** Persistent connections are **inherently sticky** — a socket lives on one box. So sticky routing at the LB is table stakes. For *broadcast/fan-out*, you still need (B)'s registry + backplane because recipients are spread across gateways. In practice you use both: sticky for the connection itself, backplane for cross-gateway messaging.

**What would change the answer:** If you can avoid cross-server fan-out entirely (e.g. co-locate an entire chat room / document on one node via consistent hashing), you can drop the global backplane for that workload and broadcast locally — cheaper and lower latency.

---

### DQ4. Pub/sub backplane: Redis Pub/Sub vs Kafka vs NATS

**Options for cross-gateway fan-out:**
- **Redis Pub/Sub** — lowest latency, dead simple, but **fire-and-forget** (no persistence; a subscriber that's down misses messages); doesn't scale to huge throughput cleanly.
- **Kafka** — durable, replayable, ordered per partition, high throughput; higher latency and operational weight.
- **NATS** — lightweight, fast, with JetStream for optional persistence; middle ground.

**Recommendation:** For ephemeral real-time fan-out where a missed message is tolerable (typing indicators, presence, transient broadcasts) → **Redis Pub/Sub**. When messages must be **durable, ordered, and replayable** (chat history, anything you'd resync on reconnect) → **Kafka** as the source of truth, with a lightweight push path on top. Many systems combine: Kafka for the durable log, Redis for the low-latency live fan-out.

**What would change the answer:** Strict delivery guarantees, replay, and audit → Kafka. Minimal ops and lowest latency for disposable events → Redis. Need both speed and optional durability without Kafka's weight → NATS JetStream.

---

### DQ5. Real-time push (WebSocket/SSE) vs periodic polling for "live-ish" data

**Options:** (A) Persistent push; (B) client polls every N seconds.

**Recommendation:** Match to **update frequency and tolerance**. If updates are frequent and users expect instant reactions (chat, live trading), push. If data changes every few minutes and a few seconds of staleness is fine (a build status, a slowly-changing dashboard), **polling is simpler and cheaper** — no persistent-connection infrastructure, trivially horizontally scalable, no backplane, no reconnect storms. Don't pay the operational cost of persistent connections for data that changes slowly.

**What would change the answer:** Very large user counts with frequent polls invert the math — N million clients polling every 5s can outweigh holding N idle connections. Battery/mobile constraints favor push (radio wakeups from polling drain batteries). Sub-second latency requirements force push.

---

### DQ6. Client reconnect: aggressive immediate retry vs jittered exponential backoff

**Options:** (A) reconnect instantly on drop; (B) exponential backoff with jitter.

**Recommendation:** **Jittered exponential backoff (B), always.** When a gateway dies, every client it held drops simultaneously; immediate retries create a synchronized **thundering herd** that can knock over the recovering fleet. Backoff spreads the load; **jitter** (randomized delay) de-synchronizes clients so they don't all retry at the same instants. Cap the max delay so reconnection still feels responsive.

**What would change the answer:** For a tiny user base where a herd is impossible, immediate retry is fine and simpler. For critical low-latency apps, use a short initial delay + jitter (not a long backoff) so reconnection stays fast while still avoiding synchronization.

---

### DQ7. Delivery guarantee: at-most-once vs at-least-once + client dedup for real-time messages

**Options:** (A) at-most-once (fire and forget); (B) at-least-once with client-side dedup by message ID.

**Recommendation:** For anything users would notice missing (chat, alerts) → **at-least-once + dedup (B)**. End-to-end exactly-once is impractical across reconnects and multiple hops; instead make messages **idempotent** by attaching a stable `msg_id` and have clients (and stores) dedup on it. Persist messages so a socket push that's lost mid-flight is recoverable on reconnect ("deliver and store").

**What would change the answer:** For purely transient signals where loss is harmless and volume is enormous (typing indicators, cursor positions, ephemeral presence ticks), at-most-once is correct — dropping one is invisible and you avoid storage + dedup overhead.
