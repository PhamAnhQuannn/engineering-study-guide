# Consensus & Replication — Practice Questions

[← Topic overview](../README.md)

> Topic: Raft/Paxos concept, leader election, quorum, replication.

Recall, "explain to a junior," and MCQs with an answer key.

---

### Q1. What problem does consensus solve, and what does it guarantee?

**Answer:** Consensus lets a group of unreliable nodes **agree on a single value or a single ordering of operations** despite crashes, message loss, and delays. It must guarantee: **Agreement** (all correct nodes decide the same value), **Validity** (the decided value was actually proposed), and **Termination** (correct nodes eventually decide). It's the foundation for leader election, distributed commit, replicated logs, and anything needing a single source of truth across nodes.

---

### Q2. Explain Raft leader election to a junior.

**Answer:** Raft splits time into **terms** (numbered periods). Every node is one of *follower*, *candidate*, or *leader*. The leader sends periodic **heartbeats**. If a follower goes too long without hearing a heartbeat (its **election timeout** fires), it suspects the leader is dead, bumps the term number, becomes a **candidate**, votes for itself, and asks everyone else for their vote. If it collects votes from a **majority** of nodes, it becomes the new leader and starts sending heartbeats. The clever bit: each node's election timeout is **randomized**, so two followers rarely time out at the exact same moment — this avoids "split votes" where nobody gets a majority. The term number also fences out stale leaders: if an old leader comes back, its term is lower, so peers ignore it.

---

### Q3. Why do consensus systems use majority quorums and odd numbers of nodes?

**Answer:** Majority quorums (N/2 + 1) are used because **any two majorities of the same set always intersect** in at least one node. That intersection is what prevents two conflicting decisions or two simultaneous leaders — the overlapping node won't vote/accept twice. Odd node counts are preferred because they maximize fault tolerance per node: a 3-node cluster tolerates 1 failure (majority 2); a 5-node tolerates 2 (majority 3). A 4-node cluster also needs a majority of 3 but only tolerates 1 failure — same tolerance as 3 nodes for more cost. And **even-split** clusters (like 2 nodes) can deadlock or risk split-brain when the cluster halves. So: 3 or 5, not 2 or 4.

---

### Q4. Synchronous vs asynchronous replication — what's the RPO of each?

**Answer:**
- **Synchronous:** the leader waits for the follower(s) to acknowledge a write before confirming it to the client. **RPO ≈ 0** — a committed write is already on a replica, so a leader crash loses nothing. Cost: higher write latency, and a slow/down follower can stall writes.
- **Asynchronous:** the leader confirms immediately and replicates in the background. **RPO > 0** — if the leader crashes, any writes not yet replicated (the "tail") are lost. Cost-free on latency but risks data loss on failover.

**Semi-synchronous** (wait for one follower) is the common compromise: bounded RPO without waiting for all replicas.

---

### Q5. What is FLP impossibility, and how do real systems get around it?

**Answer:** FLP (Fischer–Lynch–Paterson) proves that in a **fully asynchronous** network — where messages can be delayed arbitrarily — no deterministic algorithm can guarantee consensus *terminates* if even one node may crash, because you can never be sure whether a silent node is dead or just slow. Real systems escape this by **relaxing the model**: they assume **partial synchrony** (messages usually arrive within some bound) and use **timeouts/failure detectors** plus **randomization** (e.g. Raft's randomized election timeouts) to make progress in practice. They never sacrifice *safety* (agreement); they only give up the theoretical guarantee of always terminating, which is fine because in practice the network behaves well enough to make progress.

---

### Q6. Difference between replication and consensus?

**Answer:** **Replication** is copying data to multiple nodes for durability/availability — it's a mechanism. **Consensus** is *agreeing*, under failure, on a single value or the order of operations. You can replicate without consensus (async leader→follower copy is "replication" but offers no agreement guarantee — the follower may be behind and a failover can lose data or diverge). Consensus *uses* replication (it replicates a log) but adds the guarantee that all correct nodes agree on the same committed sequence even across crashes and partitions. In short: replication moves bytes; consensus agrees on truth.

---

### Q7. Why can't you just read from a follower to scale reads infinitely?

**Answer:** Followers lag behind the leader by the **replication lag**, so follower reads can be **stale** — you might not see a write that already committed on the leader. This breaks read-your-writes (a user updates their profile, then reads from a lagging follower and sees the old value) and any logic needing recency. You *can* scale reads on followers if the workload tolerates staleness, or by adding read-your-writes machinery (route recent writers to the leader, use version tokens, or wait for a follower to catch up). But blindly fanning reads to followers trades consistency for scale.

---

### Q8 (MCQ). With N=5 replicas, which (R, W) gives both write-conflict safety (majority writes) and read-overlap (R+W>N)?

A. R=1, W=1
B. R=2, W=2
C. R=3, W=3
D. R=1, W=5

**Answer: C.** W=3 is a majority of 5 (prevents two conflicting committed writes), and R+W = 6 > 5 (read quorum overlaps the latest write). (B) 2+2=4 ≤ 5 (no overlap, W not a majority). (A) too weak. (D) W=5 works for safety but kills write availability (needs all 5 up) and R=1 still overlaps — but C is the balanced standard answer.

---

### Q9 (MCQ). In Raft, a log entry is considered *committed* when:

A. The leader has written it locally
B. It has been replicated to a majority of nodes
C. Every single node has it
D. The client has retried it twice

**Answer: B.** An entry is committed once the leader has replicated it to a **majority**; at that point it's durable (any future leader's majority intersects this one, so it survives). Local-only (A) isn't durable; requiring *every* node (C) would block on any single failure.

---

### Q10 (MCQ). A 2-node "highly available" database cluster is a bad idea mainly because:

A. It uses too much disk
B. It can't form a majority when one node fails (and risks split-brain), so it tolerates zero failures safely
C. Two nodes can't replicate
D. It's slower than one node

**Answer: B.** A majority of 2 is 2, so losing either node means no quorum — you either become unavailable or risk both nodes acting independently (split-brain). Two nodes give you *replication* but not *fault-tolerant consensus*; you need at least 3 (an odd number) for that.

---

### Q11. How does a node rejoin the cluster after a network partition heals?

**Answer:** When the partition heals, the rejoining node reconnects and discovers the current leader (and current term — its own term may be stale). It then **catches up** by replaying the leader's log: the leader sends the entries the node is missing (from the follower's last matching log index forward), and may roll back any uncommitted/divergent tail the follower had from the partition. Once its log matches the leader's committed log, it resumes as a normal follower. Crucially, **fencing via terms** ensures that if this node had been acting as a leader in a minority partition, its writes (never committed by a majority) are discarded — preventing split-brain divergence from persisting.

---

### Q12. Single-leader vs leaderless (quorum) replication — give the core tradeoff.

**Answer:** **Single-leader** routes all writes through one node, giving a simple total order and easy strong consistency, but the leader is a write bottleneck and failover is complex (election time = downtime, risk of lost writes/split-brain). **Leaderless (Dynamo-style quorum)** lets any replica take writes and uses R/W quorums + version vectors + read-repair to converge, giving high write availability and no single point of failure — but at the cost of handling conflicts (concurrent writes) and weaker default consistency. Pick single-leader when you need strong ordering/consistency and can tolerate failover; pick leaderless when write availability and partition tolerance matter more than immediate consistency.
