# Consensus & Replication — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Raft/Paxos concept, leader election, quorum, replication.

Consensus is how a set of unreliable nodes agree on a single value/order despite crashes and message loss. Replication is how data is copied for durability and availability. Together they're the foundation of every reliable distributed datastore. You're rarely asked to *implement* Paxos — you're asked to reason about quorums, leaders, and replication tradeoffs.

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
- **Asynchronous replication:** leader confirms immediately, replicates in background — fast, but a leader crash can lose the not-yet-replicated tail (**RPO > 0**).
- **Semi-synchronous:** wait for *one* follower (common compromise).
- **Failover:** if the leader dies, a new leader is elected/promoted. Risks: lost writes (async), split-brain (two leaders), and the new leader being behind.

### Multi-leader (active-active writes)
- Multiple nodes accept writes (e.g. per-region). Improves write availability/latency but creates **write conflicts** that need resolution (LWW, CRDTs, app merge). Used across DCs where each region must accept local writes.

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
1. **Leader election:** time is divided into **terms**. Nodes are *follower*, *candidate*, or *leader*. A follower that hears no heartbeat within a randomized **election timeout** becomes a candidate, increments the term, and requests votes. A candidate winning a **majority** of votes becomes leader. **Randomized timeouts** prevent split votes (and sidestep FLP via partial synchrony).
2. **Log replication:** the leader appends client commands to its log and sends `AppendEntries` to followers. An entry is **committed** once replicated to a **majority**; the leader then applies it and tells followers to apply.
3. **Safety:** only a candidate with an up-to-date log can win election (so committed entries are never lost); committed entries are durable and ordered identically on all nodes.
- **Term** = a logical clock / fencing mechanism: a stale leader from an old term is rejected because peers have moved to a higher term.

### Practical systems
- **ZooKeeper (ZAB)**, **etcd / Consul (Raft)** provide consensus-as-a-service: leader election, distributed locks, config, service discovery. Most apps *use* these rather than implement consensus.

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
| ISR / sync replica | Replica caught up enough to be counted for durable acks. |
| Split-brain | Two nodes both acting as leader during a partition. |
| Fencing token | Monotonic token so stale leaders' writes are rejected. |
| RPO / RTO | Max data loss / max recovery time objectives. |
| Anti-entropy / read-repair | Background/at-read processes that heal replica divergence (leaderless). |

---

## 7. Tradeoffs

- **Sync vs async replication:** RPO=0 + durability vs lower latency + risk of losing the tail on failover. Semi-sync is the common middle.
- **Leader-based vs leaderless:** leader gives simple ordering/strong consistency but a write bottleneck and failover complexity; leaderless gives high write availability but conflict handling and weaker default consistency.
- **Quorum size:** majority quorums give safety (intersection) but require >N/2 nodes up; bigger N tolerates more failures but costs more and slows commits.
- **More replicas:** better durability/read-scaling and fault tolerance, but higher write cost (more acks) and storage.
- **Strong consistency via consensus** costs a round-trip to a majority on every write — real latency, especially cross-region.

---

## 8. Common pitfalls & misconceptions

- **"Quorum = any majority is fine regardless of count."** It must be a *majority of the configured set*; even numbers (e.g. 2-of-2, or 2-node clusters) can't tolerate a failure and risk split-brain — use **odd** cluster sizes (3, 5).
- **"More replicas = always more available."** Writes need a quorum to ack; a 5-node cluster tolerates 2 failures but each write must reach 3 nodes. Beyond a point, more replicas slow writes.
- **Async replication "doesn't lose data."** It can — the un-replicated tail is lost if the leader dies. Know your RPO.
- **Ignoring failover correctness.** Promoting a stale follower can lose committed-looking writes; without fencing, the old leader may keep writing (split-brain).
- **Confusing replication with consensus.** Copying bytes (replication) is not the same as *agreeing on order/values under failure* (consensus). Async replication has no consensus guarantee.
- **Reading from followers and assuming freshness.** Follower reads are eventually consistent unless you add read-your-writes machinery.
- **Even-node clusters.** A 2-node or 4-node cluster has worse fault tolerance per node than 3 or 5 (a majority of 4 is 3, same as a majority of 5 but tolerating fewer failures relative to cost).

---

## 9. What interviewers probe

- *"Explain Raft leader election. How does it avoid split votes and stale leaders?"* (Randomized timeouts; terms; up-to-date-log restriction.)
- *"Why majority quorums? Why odd numbers of nodes?"* (Intersection; fault tolerance vs cost.)
- *"Sync vs async replication — what's the RPO of each?"*
- *"What is FLP and how do real systems get around it?"*
- *"How does a node rejoin after a partition?"* (Log catch-up from the leader.)
- *"Why not just read from a follower to scale reads?"* (Stale reads; replication lag; read-your-writes.)
- *"What's the difference between replication and consensus?"*

---

## 10. Quick-reference summary

- **Consensus** = agree on one value/order despite failures; **FLP** says it's impossible in fully async with one crash → real systems use **timeouts + randomization** (partial synchrony).
- **Replication models:** single-leader (simple, strong, write bottleneck) / multi-leader (active-active, conflicts) / leaderless quorum (Dynamo, high availability, tunable).
- **Quorums:** **R + W > N** for read/write overlap; **W > N/2** for write safety; majorities intersect → use **odd** node counts (3, 5).
- **Raft:** terms + randomized election timeouts + majority votes (leader election); leader replicates log, entry **committed** at majority (replication); up-to-date-log rule keeps it **safe**.
- **Sync replication** → RPO 0, slower; **async** → faster, can lose the tail on failover.
- Use **etcd/ZooKeeper/Consul** for consensus-as-a-service rather than rolling your own.
- **Replication ≠ consensus**; follower reads are stale unless you add read-your-writes; fencing tokens prevent split-brain.
