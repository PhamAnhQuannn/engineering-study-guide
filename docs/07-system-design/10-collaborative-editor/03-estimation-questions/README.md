# Collaborative Editor Design — Estimation Questions

[← Topic overview](../README.md)

> Topic: OT vs CRDT, conflict resolution, cursor presence, offline editing.

---

## E1. Collaborative editor: operation throughput for 10M DAU

**Assumptions**
- 10M DAU, avg 2 documents/day, avg 30 min editing per doc.
- Typing speed: ~3 ops/second (characters, formatting, structural edits) per user.
- Avg 3 concurrent editors per active document.
- 5M active documents at any given time.

**Operation throughput**
- Active editors at any time: 10M DAU / 24h × 1h avg active = ~417k concurrent users.
- Ops generated: 417k × 3 ops/sec = 1.25M ops/sec total.
- Per-document: 3 editors × 3 ops/sec = 9 ops/sec avg, burst up to 100 ops/sec for a hot doc with 30+ editors.

**Storage**
- Each op: ~200 bytes (op type + position + content + metadata).
- 1.25M ops/sec × 86,400 sec × 200 B = 21.6 TB/day of op log.
- Snapshots (every 1000 ops): avg document 50 KB. 5M docs × 50 KB = 250 GB per snapshot cycle. With daily snapshots: manageable.
- Compact ops older than snapshot → archive to cold storage.

**WebSocket connections**
- 417k concurrent users × 1 WebSocket each = 417k connections.
- At 50 KB memory per connection, gateway fleet needs ~20 GB RAM total for connections (spread across nodes).

**Key takeaway:** op throughput (1.25M/sec) is the scaling challenge. Per-document session pinning limits horizontal scaling — design for document-level sharding.
