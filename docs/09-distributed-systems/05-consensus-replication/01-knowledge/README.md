# Consensus & Replication — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Raft/Paxos concept, leader election, quorum, replication.

Consensus is how a set of unreliable nodes agree on a single value/order despite crashes and message loss. Replication is how data is copied for durability and availability. Together they're the foundation of every reliable distributed datastore. You're rarely asked to *implement* Paxos — you're asked to reason about quorums, leaders, and replication tradeoffs.

> **🛒 Where we are in building ShopFast** — Last topic we built the async event backbone with [Messaging & Queues](../../04-messaging-queues/01-knowledge/README.md): Kafka carries `order.confirmed` events to inventory, email, and analytics workers. But Kafka itself uses leader-based replication per partition. So does ShopFast's Postgres primary. This topic explains the algorithms *underneath* those systems — how they elect leaders safely, replicate writes durably, and recover from failure without split-brain. **Next:** now that ShopFast is a distributed system, we need to see inside it — [Observability](../../06-observability/01-knowledge/README.md) is how we know when orders are failing and why.

---

## Teaching arc: how ShopFast's data survives node failures

### What it is

**Consensus** is a protocol that lets a group of nodes — each of which may crash or be unreachable at any time — agree on exactly one value or decision. **Replication** is the act of copying data to multiple nodes so that if one dies, others hold an intact copy.

Analogy: imagine a board of directors deciding the company's next move, where some board members might be unreachable (sick, traveling, phone dead). Consensus is the protocol that ensures the board only acts when a *majority* agrees — so no one faction can unilaterally commit the company to an irreversible decision without the others knowing. The "majority rule" is the quorum: any two majorities of a five-person board must share at least one person, which is what prevents two simultaneous, contradictory decisions.

**Why ShopFast cares:** the canonical system fact states *"Postgres — one primary for writes + read replicas for the read-heavy catalog."* What makes that primary trustworthy? Postgres uses WAL (Write-Ahead Log) + streaming replication. Kafka uses a leader-per-partition + ISR (in-sync replicas) replication. Both rely on the same core ideas: one writer (leader), ordered log, majority acknowledgement for durability. This topic explains those ideas so you can reason about their failure modes.

### What it looks like

```
Raft leader election (ShopFast analogy: Postgres + Patroni HA):

                    Normal operation
  ┌──────────┐  heartbeat   ┌──────────┐  replicate  ┌──────────┐
  │ LEADER   │─────────────→│ FOLLOWER │←────────────│ FOLLOWER │
  │(primary) │              │(replica1)│             │(replica2)│
  └──────────┘              └──────────┘             └──────────┘

  Leader dies → heartbeat stops → election timeout fires on replica1

  replica1 (term=2):  "I haven't heard from the leader. Voting for myself."
                       → RequestVote(term=2) → replica2 agrees (term=2 > term=1)
                       → replica1 becomes leader (majority = 2 of 3)
                       → new leader begins accepting writes

  Old leader comes back with term=1:
                       → sees term=2 in any message → steps down immediately
                       → re-joins as follower, catches up WAL from new leader

  Key invariant: only a node with the MOST UP-TO-DATE log can win an election.
  This prevents a lagging replica from being elected and serving stale data.
```

### The code that builds it

Illustrating what a Raft-style log entry and commit look like in pseudocode — not for implementation, but so the interviewer can see you understand the mechanics:

```typescript
// Conceptual: what happens on every write in a Raft-based system (e.g. etcd)

class RaftNode {
  term = 0;           // monotonic logical clock — fences stale leaders
  log: LogEntry[] = [];
  commitIndex = -1;   // highest entry replicated to a majority (safe to apply)
  role: "leader" | "follower" | "candidate" = "follower";

  async appendEntry(command: unknown) {
    if (this.role !== "leader") throw new Error("not leader");

    // 1. Append to leader's own log
    const entry = { term: this.term, index: this.log.length, command };
    this.log.push(entry);

    // 2. Replicate to all followers in parallel
    const acks = await Promise.allSettled(
      followers.map((f) => f.appendEntries(entry))
    );

    // 3. Commit once a MAJORITY has acknowledged (quorum)
    const successCount = acks.filter((r) => r.status === "fulfilled").length + 1; // +1 for self
    if (successCount > followers.length / 2) {
      this.commitIndex = entry.index;  // entry is now durable
      this.applyToStateMachine(entry);
    }
  }
}
```

### The code that calls it

ShopFast doesn't implement Raft — it uses Postgres + Patroni (which uses etcd for consensus). Here's what the application layer observes:

```typescript
// Application code: Postgres primary/replica routing
// ShopFast uses a connection string that Patroni updates on failover

async function writeOrder(order: Order) {
  // Always write to primary — Patroni updates the DNS/VIP on leader change
  return db.primary.query(
    "INSERT INTO orders (user_id, product_id, status) VALUES ($1,$2,$3)",
    [order.userId, order.productId, "confirmed"]
  );
}

async function readCatalog(productId: string) {
  // Read replicas: eventually consistent (replication lag)
  // If you need read-your-writes after a write, use primary or version token
  return db.readReplica.query(
    "SELECT * FROM products WHERE id = $1", [productId]
  );
}
```

### Types & differences

| Replication model | One-line | Strong/weak | ShopFast fit |
|---|---|---|---|
| **Single-leader (primary-backup)** | One writer, followers replicate | Strong (sync) or eventual (async) | Postgres primary + replicas |
| **Multi-leader (active-active)** | Multiple writers, async merge | Weak — write conflicts | Per-region writes; resolve with CRDTs |
| **Leaderless quorum (Dynamo-style)** | Any node accepts writes; quorum acks | Tunable (R+W>N for strong-ish) | Cart store (AP/eventual in T5 split) |

| Sync vs async | RPO (Recovery Point Objective) | Latency | Risk |
|---|---|---|---|
| **Synchronous** | ~0 (no data loss) | Slower — waits for ack | Slow follower stalls writes |
| **Asynchronous** | > 0 (may lose tail on failover) | Fast | Can lose last N writes if leader dies |
| **Semi-synchronous** | ~0 for one follower | Middle | Leader must wait for one ack |

### Build it for real — ShopFast

ShopFast's canonical fact: *"Postgres — one primary for writes + read replicas for the read-heavy catalog; replicas absorb ~50:1 read QPS."*

**Decision — semi-synchronous replication for orders:** at least one Postgres replica must acknowledge each committed write (`synchronous_commit = remote_apply` for one replica). This gives RPO (Recovery Point Objective) ≈ 0 for the order/payment tables without the cost of waiting for all replicas. The read-heavy catalog replicas can run async — a 1-second stale product description is fine (AP/eventual).

**Decision — use etcd/Patroni for leader election:** ShopFast does not roll its own Raft. Patroni uses etcd (a battle-tested Raft implementation) to elect and fence the Postgres primary. On leader failure, Patroni promotes the most up-to-date replica and updates the connection VIP within the RTO (Recovery Time Objective) budget (~30 s). Fencing prevents the old primary from accepting writes after demotion (split-brain prevention).

**Decision — odd replica count (3):** 1 primary + 2 replicas. A majority is 2. Tolerates one node failure while keeping quorum. An even count (2 nodes) cannot elect a leader if one fails — a majority of 2 requires both, defeating the point of replication.

**REJECTED — async replication only for orders:** if the primary crashes after confirming an order but before replicating it, that order is lost. The customer was charged; no order exists. This is a direct consequence of RPO > 0 on async replication, and it violates the "no lost order" NFR (Non-Functional Requirement).

> **If you get this wrong:** promoting a replica that is 500 ms behind the crashed primary means up to 500 ms of committed orders are silently gone. At ShopFast's 60 orders/minute peak, that's potentially 0–1 lost orders. Tolerable? Maybe at launch. At 60,000 orders/minute (peak Black Friday scale), that's 0–1,000 lost orders per failover event. Acceptable RPO must be defined before you choose async vs sync replication, not after the first incident.

### Scaling story

- **Now (modular monolith, ~1,800 peak read QPS):** 1 primary + 2 replicas. Read replicas handle catalog browsing; primary handles writes only. Patroni on 3 VMs. All fits on commodity cloud instances. Cost: ~3× the single-node cost, but the canonical launch NFR ("99.9% availability, orders durable") requires it.
- **Growth signal:** primary write QPS grows; replication lag on replicas exceeds 1 s consistently; order service write latency grows with synchronous replica ack.
- **At scale (services split, global):** per-service databases, each with its own Raft/consensus cluster. Kafka's per-partition leader election (also Raft-based) handles event log replication. Cross-region strong consistency (if ever needed) via CockroachDB/Spanner (Paxos/TrueTime). Leaderless Dynamo-style store for the cart (AP). Distributed locking for inventory reservations via etcd — same Raft primitives, different use case.

---

## 1. Why consensus is hard (FLP and the model)

- **FLP impossibility:** in a fully *asynchronous* network (no bound on message delay), no deterministic consensus algorithm can guarantee both safety and liveness if even one node may crash — because you can't distinguish a slow node from a dead one. Real systems sidestep FLP using **timeouts/failure detectors** (partial synchrony) and **randomization** to make progress *in practice*, while never violating safety.
- **What consensus must guarantee:** *Agreement* (all correct nodes decide the same value), *Validity* (the decided value was proposed), *Termination* (correct nodes eventually decide — the part FLP threatens).

---

## 2. Replication models

### Leader-based (primary-backup / single-leader)
- One **leader** accepts writes; **followers** replicate the leader's log.
- Reads can go to the leader (consistent) or followers (scalable but possibly stale).
- **Synchronous replication:** leader waits for follower(s) to ack before confirming — durable, slower, and a slow follower can stall writes.
- **Asynchronous replication:** leader confirms immediately, replicates in background — fast, but a leader crash can lose the not-yet-replicated tail (**RPO (Recovery Point Objective) > 0**).
- **Semi-synchronous:** wait for *one* follower (common compromise).
- **Failover:** if the leader dies, a new leader is elected/promoted. Risks: lost writes (async), split-brain (two leaders), and the new leader being behind.

### Multi-leader (active-active writes)
- Multiple nodes accept writes (e.g. per-region). Improves write availability/latency but creates **write conflicts** that need resolution (LWW (last-writer-wins), CRDTs (Conflict-free Replicated Data Types), app merge). Used across DCs (data centres) where each region must accept local writes.

### Leaderless (Dynamo-style quorum)
- No leader; clients (or coordinators) write to/read from **multiple replicas** and use **quorums** for consistency. Conflicts resolved with version vectors + read-repair/anti-entropy. High availability; tunable consistency. Examples: Dynamo, Cassandra, Riak.

---

## 3. Quorums

With **N** replicas, a **write quorum W** and **read quorum R**:
- **R + W > N** guarantees a read quorum overlaps the latest write quorum by ≥1 node → the read can observe the newest write (strong-ish consistency).
- **W > N/2** ensures two writes can't both succeed without overlapping → prevents conflicting committed writes (write quorum is a majority).
- Typical: N=3, W=2, R=2 (R+W=4>3). Tune R/W for the read/write/latency balance: low R = fast reads (maybe stale); high W = durable writes (slower).
- **Majority (N/2 + 1)** is the quorum size consensus protocols use for leader election and commit, so that any two quorums intersect — the intersection is what prevents two leaders or two conflicting decisions.

---

## 4. Consensus algorithms (conceptual)

### Paxos
- The classic, proven-correct consensus protocol. Roles: **proposers**, **acceptors**, **learners**. A value is chosen when a majority of acceptors accept a proposal with the highest-seen proposal number.
- Notoriously hard to understand and to implement correctly; **Multi-Paxos** optimizes the repeated-decision case by electing a stable leader.

### Raft (designed for understandability)
The interview favorite. Decomposes consensus into three subproblems:
1. **Leader election:** time is divided into **terms**. Nodes are *follower*, *candidate*, or *leader*. A follower that hears no heartbeat within a randomized **election timeout** becomes a candidate, increments the term, and requests votes. A candidate winning a **majority** of votes becomes leader. **Randomized timeouts** prevent split votes (and sidestep FLP (Fischer-Lynch-Paterson impossibility) via partial synchrony).
2. **Log replication:** the leader appends client commands to its log and sends `AppendEntries` to followers. An entry is **committed** once replicated to a **majority**; the leader then applies it and tells followers to apply.
3. **Safety:** only a candidate with an up-to-date log can win election (so committed entries are never lost); committed entries are durable and ordered identically on all nodes.
- **Term** = a logical clock / fencing mechanism: a stale leader from an old term is rejected because peers have moved to a higher term.

### Practical systems
- **ZooKeeper (ZAB (ZooKeeper Atomic Broadcast))**, **etcd / Consul (Raft)** provide consensus-as-a-service: leader election, distributed locks, config, service discovery. Most apps *use* these rather than implement consensus.

---

## 5. Replication lag, durability, and read consistency

- **Replication lag:** delay before a write reaches followers. Causes **stale reads** on followers and shapes failover data loss.
- **Read-your-writes on followers:** route a user's reads to the leader (or a follower known to be caught up) for a window after their write; or use version tokens.
- **RPO (Recovery Point Objective):** max data you may lose = roughly the replication lag for async; ~0 for synchronous.
- **RTO (Recovery Time Objective):** time to recover = failover/leader-election time.
- **Catch-up after partition:** a rejoined node replays the leader's log from its last index to converge.

---

## 6. Key terms

| Term | Definition |
|---|---|
| Quorum | Minimum nodes (often a majority) needed to commit/read safely; quorums must intersect. |
| Leader/follower | Node that accepts writes vs nodes that replicate it. |
| Term (Raft) | Monotonic logical clock; fences stale leaders. |
| Election timeout | Randomized wait before a follower starts an election. |
| Commit index | Highest log entry known replicated to a majority (and thus durable). |
| ISR (in-sync replicas) | Replica caught up enough to be counted for durable acks. |
| Split-brain | Two nodes both acting as leader during a partition. |
| Fencing token | Monotonic token so stale leaders' writes are rejected. |
| RPO (Recovery Point Objective) | Max acceptable data loss window. |
| RTO (Recovery Time Objective) | Max acceptable time to recover from failure. |
| Anti-entropy / read-repair | Background/at-read processes that heal replica divergence (leaderless). |
| WAL (Write-Ahead Log) | Append-only durability log written before the data page; basis of crash recovery. |

---

## 7. Tradeoffs

- **Sync vs async replication:** RPO (Recovery Point Objective) = 0 + durability vs lower latency + risk of losing the tail on failover. Semi-sync is the common middle.
- **Leader-based vs leaderless:** leader gives simple ordering/strong consistency but a write bottleneck and failover complexity; leaderless gives high write availability but conflict handling and weaker default consistency.
- **Quorum size:** majority quorums give safety (intersection) but require >N/2 nodes up; bigger N tolerates more failures but costs more and slows commits.
- **More replicas:** better durability/read-scaling and fault tolerance, but higher write cost (more acks) and storage.
- **Strong consistency via consensus** costs a round-trip to a majority on every write — real latency, especially cross-region.

---

## 8. Common pitfalls & misconceptions

- **"Quorum = any majority is fine regardless of count."** It must be a *majority of the configured set*; even numbers (e.g. 2-of-2, or 2-node clusters) can't tolerate a failure and risk split-brain — use **odd** cluster sizes (3, 5).
- **"More replicas = always more available."** Writes need a quorum to ack; a 5-node cluster tolerates 2 failures but each write must reach 3 nodes. Beyond a point, more replicas slow writes.
- **Async replication "doesn't lose data."** It can — the un-replicated tail is lost if the leader dies. Know your RPO (Recovery Point Objective).
- **Ignoring failover correctness.** Promoting a stale follower can lose committed-looking writes; without fencing, the old leader may keep writing (split-brain).
- **Confusing replication with consensus.** Copying bytes (replication) is not the same as *agreeing on order/values under failure* (consensus). Async replication has no consensus guarantee.
- **Reading from followers and assuming freshness.** Follower reads are eventually consistent unless you add read-your-writes machinery.
- **Even-node clusters.** A 2-node or 4-node cluster has worse fault tolerance per node than 3 or 5 (a majority of 4 is 3, same as a majority of 5 but tolerating fewer failures relative to cost).

---

## 9. What interviewers probe

- *"Explain Raft leader election. How does it avoid split votes and stale leaders?"* (Randomized timeouts; terms; up-to-date-log restriction.)
- *"Why majority quorums? Why odd numbers of nodes?"* (Intersection; fault tolerance vs cost.)
- *"Sync vs async replication — what's the RPO (Recovery Point Objective) of each?"*
- *"What is FLP and how do real systems get around it?"*
- *"How does a node rejoin after a partition?"* (Log catch-up from the leader.)
- *"Why not just read from a follower to scale reads?"* (Stale reads; replication lag; read-your-writes.)
- *"What's the difference between replication and consensus?"*

---

## 10. Quick-reference summary

- **Consensus** = agree on one value/order despite failures; **FLP (Fischer-Lynch-Paterson impossibility)** says it's impossible in fully async with one crash → real systems use **timeouts + randomization** (partial synchrony).
- **Replication models:** single-leader (simple, strong, write bottleneck) / multi-leader (active-active, conflicts) / leaderless quorum (Dynamo, high availability, tunable).
- **Quorums:** **R + W > N** for read/write overlap; **W > N/2** for write safety; majorities intersect → use **odd** node counts (3, 5).
- **Raft:** terms + randomized election timeouts + majority votes (leader election); leader replicates log, entry **committed** at majority (replication); up-to-date-log rule keeps it **safe**.
- **Sync replication** → RPO (Recovery Point Objective) ≈ 0, slower; **async** → faster, can lose the tail on failover.
- Use **etcd/ZooKeeper/Consul** for consensus-as-a-service rather than rolling your own.
- **Replication ≠ consensus**; follower reads are stale unless you add read-your-writes; fencing tokens prevent split-brain.
