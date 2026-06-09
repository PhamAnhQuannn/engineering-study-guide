# Messaging & Queues — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Kafka, RabbitMQ, pub/sub, event-driven, streams.

Named options, a reasoned recommendation, and **what would change the answer.**

---

### Dec1. Kafka (log) vs RabbitMQ (queue) vs SQS (managed queue)

- **A — Kafka:** high-throughput partitioned log, replay, multiple consumer groups, per-partition order.
- **B — RabbitMQ:** rich routing, per-message ack, priorities/TTL/delays, one-time delivery.
- **C — SQS:** fully managed, near-zero ops, standard (at-least-once, unordered) or FIFO.

**Recommendation:** Match to the workload. **Kafka** for event streaming, event sourcing, many independent consumers, and replay. **RabbitMQ** for complex routing and task queues needing priorities/delays with per-message control. **SQS** when you want a simple, ops-free work queue and you're on AWS and don't need replay/fan-out.

**What would change the answer:** Small team / minimal ops budget → lean managed (SQS/Pub-Sub) even if Kafka would technically fit. Need replay or multiple readers of the same stream → Kafka. Need elaborate routing topologies → RabbitMQ.

---

### Dec2. More partitions vs fewer partitions

- **A — Many partitions:** more parallelism/throughput headroom.
- **B — Few partitions:** less overhead, faster rebalances, simpler.

**Recommendation:** Provision **enough** partitions for peak parallelism plus growth, but not wildly more — each partition costs open files, memory, replication, and longer rebalances. Size from "max consumers you'll ever want in a group" and key-skew. Err slightly high because **adding partitions later breaks per-key ordering** (rehashing keys), so it's effectively a one-way decision for ordered keys.

**What would change the answer:** If ordering per key is irrelevant, you can add partitions freely later → start lean. If you expect 10× growth and ordered keys, over-provision now.

---

### Dec3. `acks=all` + RF=3 vs `acks=1` + RF=2

- **A — acks=all, RF=3, min.insync=2:** durable, survives a broker loss; higher latency.
- **B — acks=1, RF=2:** lower latency, lower cost; loses data if leader dies pre-replication.

**Recommendation:** **A** for any data you can't afford to lose (orders, payments, audit). The latency cost is modest and the durability guarantee is the whole point of using a durable broker. **B** only for low-value, high-volume, loss-tolerant streams (metrics, clickstream) where throughput/cost dominate.

**What would change the answer:** Strict ultra-low-latency requirements on disposable data favor B (or even `acks=0`). Compliance/financial data mandates A.

---

### Dec4. Orchestration vs choreography for a multi-step workflow

- **A — Orchestration:** a central coordinator (e.g. a saga orchestrator / workflow engine) directs each step.
- **B — Choreography:** services react to each other's events; no central brain.

**Recommendation:** **Orchestration (A)** when the workflow is complex, needs clear visibility, has tricky compensation/rollback logic, or business owners need to see/modify the flow — a workflow engine (Temporal/Step Functions) gives traceability and built-in retries/compensation. **Choreography (B)** for simple, loosely-coupled reactions where central coordination would be over-engineering and you value decoupling.

**What would change the answer:** Many steps, complex error handling, audit needs → orchestration. Few steps, autonomy of teams, simple fan-out → choreography. Hybrid is common (choreography between domains, orchestration within).

---

### Dec5. Push (RabbitMQ) vs pull (Kafka) consumption model

- **A — Push** with prefetch/QoS limits.
- **B — Pull**, consumer controls fetch rate.

**Recommendation:** **Pull (B)** gives natural **backpressure** — the consumer fetches only what it can handle, so a slow consumer just lags rather than being overwhelmed; ideal for high-throughput batch-style processing. **Push (A)** gives lower latency for low-rate, latency-sensitive work, but you must set prefetch carefully or fast producers swamp slow consumers.

**What would change the answer:** Latency-critical, low-volume tasks favor push with tight prefetch. High-volume streaming with variable consumer speed favors pull.

---

### Dec6. Outbox/CDC vs direct publish (dual write) for emitting events

- **A — Transactional outbox / CDC:** event derived atomically from the DB change.
- **B — Dual write:** app writes DB then publishes to the broker directly.

**Recommendation:** **A**, essentially always for events that matter. Dual writes (B) have an inherent failure window — crash between the DB commit and the publish loses the event (or a rollback leaves a phantom event). Outbox commits the event row in the same transaction; a relay or CDC (Debezium) publishes reliably.

**What would change the answer:** If the event is purely best-effort and occasional loss is acceptable, the simplicity of B may be tolerable. Otherwise A.

---

### Dec7. Single shared topic vs topic-per-event-type vs topic-per-consumer

- **A — One big topic** for all events.
- **B — Topic per event type / domain.**
- **C — Topic per consumer.**

**Recommendation:** **B (topic per domain/event type)** is the usual sweet spot: consumers subscribe only to what they need, you can tune retention/partitions per type, and access control is cleaner. **A** forces every consumer to filter the whole firehose (wasteful) and couples unrelated data. **C** explodes topic count and duplicates data.

**What would change the answer:** Very low volume with few consumers → one topic is simpler (don't over-partition the design). Strict per-consumer isolation/SLA needs might justify dedicated topics for specific critical consumers.
