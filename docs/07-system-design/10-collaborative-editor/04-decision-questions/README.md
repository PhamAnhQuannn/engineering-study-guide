# Collaborative Editor Design — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: OT vs CRDT, conflict resolution, cursor presence, offline editing.

---

## DC1. OT vs CRDT for a collaborative editor — which do you choose and why?

**Answer**

**OT (Operational Transform):**
- Requires a central server per document as a serialization point.
- Proven at massive scale (Google Docs has used OT since 2010).
- Simpler client logic — server does the heavy lifting of transforming ops.
- Weakness: the central server is a scaling bottleneck and single point of failure per document.

**CRDT (Conflict-free Replicated Data Types):**
- No central coordination needed — each client can merge independently.
- Superior offline support — clients converge automatically on reconnect.
- Weakness: significantly more complex for rich text (nested formatting, concurrent structural edits). Yjs and Automerge are maturing but not yet at Google Docs scale.

**Decision framework:** Choose OT if your architecture is server-centric and offline is a secondary concern. Choose CRDT if offline-first is a hard requirement or you want peer-to-peer collaboration without a central server. For most production systems today, OT with a well-provisioned collaboration service is the pragmatic choice.

---

## DC2. Server-managed sessions vs peer-to-peer sync for collaborative editing

**Answer**

**Server-managed sessions (OT-based):**
- Pro: strong consistency guarantees — server is the authority. Easier to implement permissions, audit logging, version history. Battle-tested at scale (Google Docs).
- Con: every op goes through the server. Offline editing requires queuing and reconciliation. Per-document server affinity limits horizontal scaling.

**Peer-to-peer sync (CRDT-based):**
- Pro: works offline natively — clients sync directly when reconnected. No server bottleneck. Lower latency in p2p scenarios.
- Con: rich text CRDTs are still maturing. No central authority for permissions — need a separate authz layer. Harder to implement version history (no canonical op log).

**Decision:** for a production SaaS editor (Google Docs competitor), server-managed sessions are the safer bet today. The tooling, debugging, and operational experience is mature. For a local-first app (like Notion's offline mode), CRDTs offer a better architecture. The answer depends on whether "server is always reachable" is a reasonable assumption.
