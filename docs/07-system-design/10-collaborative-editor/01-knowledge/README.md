# Collaborative Editor Design — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: OT (Operational Transform) vs CRDT (Conflict-free Replicated Data Types), conflict resolution, cursor presence, offline editing.

A collaborative editor like Google Docs is the **hardest real-time system design** — harder than chat, harder than live streaming. Chat is append-only (new messages go at the end). Editing is concurrent mutation of shared mutable state at arbitrary positions. Two users typing in the same paragraph simultaneously must see a consistent result without either losing work.

> **🛒 Where we are in building ShopFast** — The [Social Platform](../../09-social-platform/01-knowledge/README.md) composed multiple subsystems. This topic goes deeper into one specific real-time challenge: what if ShopFast had a collaborative product description editor where multiple sellers on a shared storefront could edit listings simultaneously? **Next:** [Distributed Scheduler](../../11-distributed-scheduler/01-knowledge/README.md) moves from user-facing real-time to backend distributed coordination.

---

## Why it matters

This question tests whether you understand:
1. **Consistency in distributed state** — two clients editing the same document must converge to the same result ([Consistency & CAP](../../../09-distributed-systems/02-consistency-cap/01-knowledge/README.md))
2. **Real-time communication** — low-latency sync via [WebSockets](../../../04-networking/05-websockets/01-knowledge/README.md)
3. **Conflict resolution algorithms** — OT or CRDT, not just "send diffs"
4. **Failure recovery** — server crash, offline editing, reconnection

---

## The core problem: concurrent edits

Two users, Alice and Bob, both see: `"Hello World"`

- Alice inserts `" Beautiful"` after `"Hello"` → `"Hello Beautiful World"`
- Bob deletes `" World"` → `"Hello"`

If both ops apply naively, the result depends on order — and neither result matches what both users intended. **This is the fundamental problem** that OT and CRDTs solve.

---

## Two approaches

### Operational Transform (OT)

Every edit is an **operation** (insert char at position N, delete range [M..N], format bold [M..N]). A central server receives ops from all clients and **transforms** each incoming op against concurrent ops so the result is consistent regardless of arrival order.

**How it works:**
1. Client generates op locally, applies immediately (optimistic)
2. Client sends op to server
3. Server transforms op against any ops that arrived concurrently
4. Server assigns a global sequence number, broadcasts transformed op to all other clients
5. Other clients apply the transformed op

**Tradeoffs:** proven at Google's scale (Google Docs since 2010). Requires a central server per document (serialization point). The transform function is complex for rich text (nested formatting, structural edits like splitting a paragraph).

### CRDT (Conflict-free Replicated Data Types)

Each character/element has a unique, globally ordered ID. Edits reference IDs, not positions. Merging is mathematically guaranteed to converge without coordination.

**How it works:**
1. Each client assigns unique IDs to inserted characters (using fractional indexing or tree-based schemes)
2. Edits reference character IDs, not positions — so concurrent inserts at "position 5" don't conflict because they're inserting next to different IDs
3. Any client can merge any other client's ops at any time and converge

**Tradeoffs:** no central server needed — great for offline and peer-to-peer. More complex for rich text. Implementations maturing (Yjs, Automerge) but not yet at Google Docs scale. Tombstones (deleted elements) accumulate and must be garbage-collected.

---

## Supporting infrastructure

### Document model
Not flat text — a tree/DAG of blocks (paragraphs, headings, lists, table cells) with inline formatting spans. Operations must handle structural changes (merging paragraphs, splitting lists) as well as character-level edits.

### Presence channel
Cursor positions and selection ranges for each user, shown in real-time with user-specific colors. Separate from the document op channel — it's fire-and-forget (a lost cursor update is harmless). Use a lightweight pub/sub per document.

### Version history
Op log (append-only) + periodic snapshots. Load a document = fetch latest snapshot + replay subsequent ops. Named versions are bookmarks into the op log. Point-in-time recovery and undo rely on this.

### Offline editing
Client queues ops locally. On reconnect, sends buffered ops. With OT, the server transforms them against ops that happened during the offline period. With CRDTs, the client can merge independently — no server round-trip needed for correctness.

---

## ShopFast case: collaborative listing editor

> **Scenario:** ShopFast marketplace adds multi-seller storefronts where 2–3 sellers manage a shared product catalog. They need to edit product descriptions simultaneously without overwriting each other's changes.

**Decision:** OT with a server-managed session per document. Each product description is a document. The collaboration service is a stateful service pinned per-document (sticky routing by product_id).

**Why OT over CRDT?** Server is always reachable (this is a web app, not a local-first tool). OT is simpler to reason about, and the server-side session gives us a natural place for permissions, audit logging, and version history.

**Rejected:** naive last-write-wins (lossy), polling-based sync (too slow, conflicts accumulate), full CRDT (over-engineered for a server-centric app with 2–3 concurrent editors).

---

## Lessons and pitfalls

1. **Name OT or CRDT explicitly.** The interviewer is testing whether you know these exist. "Just send diffs" is a junior answer — it doesn't address concurrent edits.

2. **Per-document session is the scaling unit.** A hot document (100 editors) needs a dedicated server node. This is the bottleneck — plan for it. Session migration on node failure = replay from op log.

3. **Undo is non-trivial in multi-user.** "Undo" means "undo MY last op," not "globally undo." The inverse op must be transformed against all subsequent ops from other users. Don't hand-wave this.

4. **Snapshot frequency is a tuning knob.** Too often = wasted storage/compute. Too rarely = slow document opens (long op replay). Start with every 1000 ops or 5 minutes.

5. **Don't forget permissions.** Document-level ACL (Access Control List): owner, editor, viewer, commenter. Sharing links with configurable access. The collaboration service must enforce these before accepting ops.
