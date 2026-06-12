# Collaborative Editor Design — System Design Questions

[← Topic overview](../README.md)

> Topic: OT vs CRDT, conflict resolution, cursor presence, offline editing.

---

## D1. Design a collaborative document editor (Google Docs)

**Requirements / Scale**
- Functional: create/edit documents with rich text (bold, italic, headings, lists, tables, images), real-time multi-user editing, cursor/selection presence, comments, version history, undo/redo, sharing with permissions (owner/editor/viewer/commenter), offline editing.
- Non-functional: 100M documents, 10M DAU, up to 100 concurrent editors per document, sync latency <200 ms, zero data loss, offline edits reconcile on reconnect.

**High-level design**
- **Client:** local editor with an operation buffer. User edits generate **operations** (insert, delete, format, structural). Ops applied locally immediately (optimistic), then sent to server.
- **Collaboration service:** one logical **session per document**. Receives ops from all clients, **transforms** them against concurrent ops (OT) or **merges** them (CRDT), assigns a global sequence number, broadcasts transformed ops to all other clients.
- **Document store:** Postgres for metadata (title, owner, ACL, created_at). **Operation log** (append-only) for every op ever applied. Periodic **snapshots** (full document state) stored in blob storage (S3) to avoid replaying the entire op log on load.
- **Presence service:** lightweight pub/sub channel per document for cursor positions, selection ranges, user colors. Separate from the document op channel (lower reliability requirement — lost cursor update is harmless).
- **Version history:** snapshot + op log enables point-in-time recovery. Named versions are bookmarks into the op log. Diff between versions = replay ops between snapshots.
- **Offline:** client queues ops locally. On reconnect, sends buffered ops; server transforms against ops that happened while client was offline. CRDTs handle this more naturally than OT (no server round-trip needed for merge correctness).

**Data model**
- `documents(id PK, title, owner_id, created_at, updated_at)` — Postgres.
- `permissions(doc_id, user_id, role ENUM(owner,editor,viewer,commenter))` — Postgres.
- `operations(doc_id, seq BIGINT, user_id, op_type, payload JSONB, created_at)` — Postgres (append-only), partition by doc_id. This is the source of truth.
- `snapshots(doc_id, version INT, content_blob_url, created_at)` — metadata in Postgres, blob in S3. Created every N ops (e.g., every 1000).
- `presence:{doc_id}` → `{user_id: {cursor_pos, selection, color, last_seen}}` — Redis with short TTL (auto-evict stale).

**Scaling & bottlenecks**
- **Per-document session state:** a hot document (100 editors) requires a single serialization point for OT. Pin the session to one server node (sticky routing by doc_id). If that node fails, replay from op log on a new node.
- **Op log growth:** append-only, grows unbounded. Compact via snapshots — on load, fetch latest snapshot + replay only subsequent ops. Archive old ops to cold storage.
- **WebSocket connections:** 10M DAU × ~1 connection each = 10M persistent connections. Distribute across a gateway fleet; route by doc_id to the correct collaboration node.
- **Fan-out per keystroke:** 100 editors = every op broadcast to 99 others. Batch ops (e.g., 50ms window) to reduce fan-out frequency.

**Tradeoffs & failure modes**
- **OT vs CRDT:** OT — simpler client, proven at Google scale, but requires a central server per document (serialization point = scaling limit). CRDT — no central server needed, better offline support, but complex for rich text (nested formatting, concurrent structural edits). **Recommendation:** OT for a server-centric architecture (simpler to reason about), CRDT if offline-first is a hard requirement.
- **Snapshot frequency:** too often = storage cost + compute. Too rare = slow document opens (long op replay). Tune: snapshot every 1000 ops or every 5 minutes of activity.
- **Server crash during active session:** no data loss because ops are persisted before broadcast. New session replays from op log. Clients reconnect, re-sync from last known seq.
- **Undo in multi-user context:** "undo" means "undo MY last op," not "undo the globally last op." OT must transform the inverse op against all subsequent ops from other users — non-trivial.
- **Large documents:** 100-page doc with 100 editors = high op throughput. May need to shard by document section (page/block level) for very large docs.

**Checklist**
- [ ] Names OT or CRDT and explains the core tradeoff
- [ ] Describes the operation model (not just "send diffs" — ops are discrete insert/delete/format actions)
- [ ] Handles concurrent edit conflicts with a concrete resolution strategy
- [ ] Designs cursor/selection presence as a separate lightweight channel
- [ ] Plans version history via op log + snapshots
- [ ] Addresses offline editing and reconnection reconciliation
- [ ] Identifies per-document session as the scaling bottleneck
- [ ] Discusses undo/redo in a multi-user context
- [ ] Mentions document permissions and sharing model
