# Delivery Semantics — Practice Questions

[← Topic overview](../README.md)

> Topic: Idempotency, at-least/exactly-once, dedup.

Recall, "explain to a junior," and MCQs with an answer key.

---

### Q1. Define the three delivery semantics and the tradeoff each makes.

**Answer:**
- **At-most-once:** delivered 0 or 1 times. Never duplicates, but **may lose** messages (fire-and-forget, no retry). Fine for non-critical telemetry.
- **At-least-once:** delivered 1 or more times. **Never loses**, but **may duplicate** (retries after lost acks). The default for reliable systems.
- **Exactly-once (effects):** the observable effect happens exactly once. Achieved not by magic delivery, but by **at-least-once delivery + idempotent processing/dedup**.

The core tradeoff is *lose vs duplicate*; we almost always pick "may duplicate" because duplicates can be made harmless via idempotency, while lost data often can't be recovered.

---

### Q2. Explain to a junior why "exactly-once delivery" is essentially impossible.

**Answer:** Imagine you send a message and wait for an ack. If the ack doesn't arrive, you genuinely *cannot tell* whether (a) the message never arrived, or (b) it arrived and was processed but the ack got lost. You have only two choices: **retry** (which risks processing it twice if it was case b → at-least-once) or **don't retry** (which risks losing it if it was case a → at-most-once). There's no option that's guaranteed to deliver exactly once. So instead of chasing exactly-once *delivery*, we accept at-least-once and make the *processing* idempotent, so duplicates have no extra effect — giving exactly-once **effects**.

---

### Q3. What is an idempotency key and how does a server use it?

**Answer:** An idempotency key is a unique identifier the client generates per *logical* operation and sends on every retry of that same operation. On receiving a request, the server does an atomic **insert-if-absent** of the key:
- If the key is new, it processes the request, stores the result against the key, and returns it.
- If the key already exists (a retry), it returns the **stored result** without re-processing.

This makes a non-idempotent operation (like charging a card) safe to retry: duplicate requests with the same key collapse into one effect. Keys carry a TTL covering the retry horizon, and the server should reject the same key used with a *different* payload (409) to avoid returning a wrong cached result.

---

### Q4. Describe the transactional outbox pattern and the problem it solves.

**Answer:** The problem: you want to atomically "update the database AND publish an event," but the DB and the message broker are two separate systems — you can't wrap both in one transaction reliably. If you write to the DB then publish, a crash in between loses the event; if you publish then write, a rollback leaves a phantom event.

The outbox solves this: within the **same DB transaction** as the business change, you also insert a row into an `outbox` table. A separate **relay** process reads unsent outbox rows and publishes them to the broker (at-least-once), marking them sent. Because the business change and the outbox row commit atomically, you never have one without the other. Consumers dedup the at-least-once deliveries.

---

### Q5. You consume a message, write to your DB, and send a confirmation email. A redelivery occurs. How do you prevent double effects?

**Answer:** Two parts:
1. **DB write:** use the **inbox pattern** — record the message id in an `inbox` table *in the same transaction* as the DB write. On redelivery, the id is already present, so you skip. Atomicity of (record-id + do-write) makes it exactly-once for the DB.
2. **Email:** the email is an *external, irreversible* side effect, so it needs its **own** idempotency. Track "email sent for message X" durably (or use the provider's idempotency key) and skip if already sent. You can't un-send an email, so dedup must happen before the send and be durable.

The general rule: every external side effect needs its own idempotency; one inbox table doesn't automatically protect downstream effects.

---

### Q6. When is at-most-once an acceptable choice?

**Answer:** When the data is non-critical and losing a few items is cheaper than the complexity/cost of dedup, *and* duplicates would be harmful or the volume is so high that retries are too expensive. Examples: high-frequency metrics/telemetry where a missed sample is invisible; ephemeral presence/"typing…" indicators; best-effort log shipping where occasional gaps are tolerable. The deciding question: "if a message is silently dropped, does anyone care?" If no, at-most-once buys simplicity and throughput.

---

### Q7. What's a poison message and how should a consumer handle it?

**Answer:** A poison message is one that *consistently* fails processing (malformed payload, references missing data, triggers a bug) — so naive at-least-once retry loops on it forever, blocking the partition/queue and burning resources. Handling: retry a **bounded** number of times with backoff; if it still fails, move it to a **dead-letter queue (DLQ)** and alert. The DLQ quarantines the bad message so the rest of the stream keeps flowing, and gives engineers a place to inspect, fix, and optionally re-drive the message after a code fix.

---

### Q8 (MCQ). Kafka advertises "exactly-once." Your pipeline reads from Kafka, writes to Postgres, and calls a payment API. End-to-end, you have:

A. Exactly-once everywhere automatically
B. Exactly-once only within Kafka; Postgres and the payment API still need idempotency
C. At-most-once
D. No guarantees at all

**Answer: B.** Kafka's exactly-once (transactional producer + consumer offsets) covers **Kafka-to-Kafka** read-process-write. The moment you touch an external sink (Postgres write, payment call), that guarantee no longer applies — those effects still require their own idempotency/dedup.

---

### Q9 (MCQ). Which is NOT a valid way to make an operation idempotent?

A. Idempotency key with insert-if-absent
B. Conditional/compare-and-set write on a version/ETag
C. In-memory-only "seen ids" set in the consumer
D. Unique constraint on a natural business key

**Answer: C.** In-memory dedup is lost on consumer restart, so duplicates slip through after a crash — it doesn't provide durable idempotency. A, B, and D are all durable, reliable techniques.

---

### Q10 (MCQ). The transactional outbox primarily prevents which failure?

A. Slow consumers
B. The "wrote to DB but crashed before publishing the event" (or vice versa) inconsistency
C. Poison messages
D. Network partitions

**Answer: B.** By committing the business change and the outbox event in one DB transaction, you eliminate the window where one happens without the other. A relay then publishes reliably. It doesn't address slow consumers (A), poison messages (C — that's DLQs), or partitions (D).

---

### Q11. Why must deduplication always be bounded, and how do you choose the bound?

**Answer:** Storing every processed id "forever" is impractical — the dedup store would grow without limit and slow every lookup. So every real dedup mechanism has a **window**: a TTL (e.g. SQS FIFO's 5-minute dedup), an offset/sequence horizon (Kafka), or a retention period. You choose the bound to comfortably exceed the **maximum realistic retry/replay horizon** — how long after the original send could a duplicate plausibly arrive (client retry windows, broker redelivery, replays after an outage)? Set the window larger than that worst case, then accept that a duplicate older than the window (e.g. a months-late replay) may be re-processed, and design effects to tolerate that rare case.
