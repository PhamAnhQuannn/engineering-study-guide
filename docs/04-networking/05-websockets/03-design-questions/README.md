# WebSockets & Streaming — System Design Questions

[← Topic overview](../README.md)

> Topic: WebSockets, SSE, long polling, real-time tradeoffs.

Each prompt follows: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## D1. Design a real-time group chat (Slack/WhatsApp-style)

**Requirements / Scale**
- 1:1 and group messaging; presence (online/typing); delivery + read receipts; message history; push when offline.
- 50M users, 10M concurrent connections, peak ~500k messages/sec, fan-out to groups up to 10k members. P99 delivery < 200 ms for online users.

**High-level design**
- **Edge/WS gateway tier:** stateless-as-possible WebSocket servers terminating `wss://`; each holds a slice of connections. A connection registry (Redis) maps `user → {gateway, connId}`.
- **Message ingest:** a client sends a message over its socket → gateway writes to a **durable log (Kafka)** keyed by channel for ordering + replay, and to the message store.
- **Fan-out service:** consumes the log, looks up recipients' gateways via the registry, and routes each message to the right gateway, which pushes to local sockets. Offline users → push-notification service (APNs/FCM) + stored for later sync.
- **Presence service:** heartbeats update a TTL'd presence key in Redis; typing indicators are ephemeral pub/sub (not persisted).

**Data model**
- `messages(channel_id, msg_id [time-sortable, e.g. snowflake], sender_id, body, created_at)` — partitioned by channel.
- `channel_members(channel_id, user_id, last_read_msg_id)` — drives unread counts + read receipts.
- `connections(user_id, gateway_id, conn_id, expires_at)` in Redis.
- `presence(user_id → status, last_seen)` TTL'd in Redis.

**Scaling & bottlenecks**
- **Fan-out to large groups** is the killer: a 10k-member message = 10k pushes. Use a **pub/sub backplane** + per-gateway batching. For very large channels, consider fan-out-on-read (clients pull) instead of fan-out-on-write.
- 10M connections → shard gateways; tune file descriptors and socket memory; consistent-hash users to gateways.
- Ordering: per-channel Kafka partition gives a total order; client applies by `msg_id`.

**Tradeoffs & failure modes**
- Gateway crash → 100k+ clients reconnect (thundering herd): jittered backoff + connection-rate limiting; registry TTL self-heals stale entries.
- At-least-once delivery + client-side dedup by `msg_id` (exactly-once is impractical end-to-end).
- Presence is eventually consistent; "last seen" may lag — acceptable.

---

## D2. Design a live sports score / market-data dashboard (server-push, read-heavy)

**Requirements / Scale**
- Push score/price updates to many viewers; viewers don't send data. 5M concurrent viewers, ~10k updates/sec across all events, sub-second latency, must survive flaky mobile networks.

**High-level design**
- Use **SSE over HTTP/2**, not WebSockets — traffic is one-directional, and SSE gives free auto-reconnect (`Last-Event-ID`) and rides existing HTTP/CDN infra.
- **Edge tier** subscribes to an internal update bus (Redis pub/sub / Kafka topic per event). Each edge node holds the SSE connections for its viewers and forwards relevant events.
- **Coalescing layer:** for high-frequency feeds, collapse multiple updates into the latest snapshot per channel before pushing (clients only need current state).
- CDN/edge POPs terminate connections close to users to cut RTT.

**Data model**
- `event_state(event_id → latest snapshot, version)` in Redis (source of truth for "current").
- Update stream: `(event_id, version, delta, ts)`.
- `subscriptions(conn_id → [event_ids])` held in-memory per edge node.

**Scaling & bottlenecks**
- 5M SSE connections → many edge nodes; HTTP/2 multiplexing keeps per-client connection count low.
- Hot events (a final-minute goal) cause spikes → coalesce + rate-cap per channel.
- Reconnect with `Last-Event-ID` lets a client resync only missed events, not the whole history.

**Tradeoffs & failure modes**
- SSE is text-only and one-way — fine here; if viewers later need to interact (place a bet), add a separate POST path or upgrade that surface to WebSockets.
- On disconnect, client may miss events; serving the current snapshot on reconnect + event IDs makes recovery cheap.
- Backpressure: drop intermediate deltas for slow clients, always deliver the latest snapshot.

---

## D3. Design collaborative document editing (Google Docs-style)

**Requirements / Scale**
- Multiple users edit the same doc simultaneously; sub-100 ms echo; cursor presence; offline edits that merge; no lost updates. 1M docs, up to ~100 concurrent editors per doc.

**High-level design**
- **WebSockets** (bidirectional, low latency) per editor, grouped by `doc_id` into a "room."
- A **per-document authority** (single owning process/actor per doc, e.g. via consistent hashing) serializes incoming operations, applies **OT (Operational Transform)** or **CRDT** merge, assigns a monotonically increasing version, and broadcasts the transformed op to all room members.
- Persist the op log + periodic snapshots so a doc can be rehydrated and late-joiners can sync from a snapshot + tail of ops.

**Data model**
- `doc_ops(doc_id, version, client_id, op, ts)` — append-only log, partitioned by doc.
- `doc_snapshots(doc_id, version, blob)` — periodic compaction.
- `room_presence(doc_id → {user_id: cursor})` ephemeral in Redis.

**Scaling & bottlenecks**
- The single per-doc authority is a natural sharding key; one doc rarely needs more than one core. Route all of a doc's sockets to its owning node (sticky/consistent hash).
- Cross-node broadcast within a room uses the same node (since the room is co-located), avoiding a backplane for the common case.

**Tradeoffs & failure modes**
- **OT vs CRDT:** OT needs a central server to transform ops (simpler client, server is authority); CRDTs merge without a central authority (better offline, heavier data structures). Pick based on offline-first requirements.
- Authority node failure → re-elect owner via consistent hashing; replay op log from last snapshot.
- Network partition → client buffers ops offline; on reconnect, server transforms/merges against the versions it missed.

---

## D4. Design a presence/notification system (online status + real-time alerts)

**Requirements / Scale**
- Show who's online; deliver in-app notifications instantly to connected users, queue for offline ones. 20M users, 5M concurrent.

**High-level design**
- WebSocket or SSE gateways hold connections; a **presence service** tracks online status via heartbeats (TTL keys in Redis — miss N heartbeats → offline).
- Notifications published to a bus; a router checks the connection registry: online → push over the socket; offline → persist to a per-user inbox + trigger mobile push.

**Data model**
- `presence(user_id → {status, last_heartbeat})` TTL'd in Redis.
- `notifications(user_id, notif_id, payload, read, created_at)` for durable inbox/history.
- `connections(user_id → gateway)` registry.

**Scaling & bottlenecks**
- Presence write amplification (heartbeats from 5M clients) — batch/aggregate heartbeats, use TTL expiry rather than explicit "offline" writes.
- Fan-out for "a friend came online" — only notify subscribers who care (friend graph lookup), and rate-limit.

**Tradeoffs & failure modes**
- Presence is **eventually consistent**: a crashed client appears online until its TTL lapses (tune TTL vs false-online window).
- Deliver-and-store: even online deliveries write to the inbox so a missed socket push isn't lost — client reconciles on reconnect.
