# Delivery Semantics — Real-World Situations

[← Topic overview](../README.md)

> Topic: Idempotency, at-least/exactly-once, dedup.

On-the-job scenarios: **Model/mitigate → Diagnose with data → Communicate → Root-cause fix → Prevention.**

---

### S1. Customers report duplicate charges after a deploy

**Situation:** Support sees a spike in "charged twice" tickets right after a release that added client-side retries.

- **Mitigate:** Disable the new aggressive retry on the payment path; identify duplicates by matching PSP references and issue refunds.
- **Diagnose with data:** Correlate: timed-out charge requests where the *first* attempt succeeded at the PSP but the response was lost, so the client retried and created a *second* charge. The payment endpoint is **not idempotent**. (Timeout ≠ failure.)
- **Communicate:** Proactively notify and refund affected customers; brief leadership on blast radius and ETA. Don't wait for them to find it.
- **Root-cause fix:** Add **idempotency keys** — client sends a stable key per checkout; server does insert-if-absent and, on a retry after a lost response, returns the stored result / queries the PSP by that key instead of re-charging.
- **Prevention:** Policy: no retry on a mutating endpoint until it's idempotent. Add a daily **reconciliation** job diffing the internal ledger vs the PSP to catch duplicates fast.

---

### S2. Events silently lost: "wrote to DB but never published"

**Situation:** Downstream services (search index, analytics) are missing ~0.5% of orders. The orders themselves are fine in the primary DB.

- **Mitigate:** Backfill the missing events from the orders table into the stream.
- **Diagnose with data:** The service does a **dual write**: commit order to DB, then publish to the broker. Logs show crashes/restarts between the two steps; those orders committed but their events never published.
- **Communicate:** Tell downstream consumers about the gap window and the backfill so they can reconcile.
- **Root-cause fix:** Replace the dual write with a **transactional outbox** — write the order and the event row in one transaction; a relay publishes the outbox reliably. Now an order can never exist without its event.
- **Prevention:** Ban dual writes in design review; add a monitor comparing order count vs published-event count and alert on drift.

---

### S3. A poison message stalls an entire partition

**Situation:** One Kafka partition's consumer lag climbs to millions while others are fine; throughput on that partition is zero.

- **Mitigate:** Identify the stuck message; move it aside (to a DLQ / skip its offset) so the consumer can advance and lag drains.
- **Diagnose with data:** The consumer crashes on one specific message (a schema-incompatible payload) and, with at-least-once + infinite retry, re-reads the same offset forever — a **poison message** blocking the partition.
- **Communicate:** Note in the incident channel that it's a single bad message, not a capacity issue, so nobody scales consumers uselessly.
- **Root-cause fix:** Add **bounded retries with backoff**, then route failures to a **DLQ** with context; fix the schema handling (tolerant deserialization / validation at the producer).
- **Prevention:** Schema registry + compatibility checks at produce time; DLQ depth alerting; a documented re-drive procedure for fixed messages.

---

### S4. Redeliveries double-apply ledger debits after a consumer rebalance

**Situation:** During a deploy, consumers rebalance; afterward, some wallet balances are wrong (debited twice).

- **Mitigate:** Freeze the affected accounts; recompute correct balances from the immutable event log and the dedup records; correct.
- **Diagnose with data:** Offsets were committed **before** the DB write (wrong order), or the consumer had **in-memory-only dedup** that was lost on rebalance — so redelivered events were re-applied.
- **Communicate:** Inform finance/ops of affected accounts and the correction; this is a data-integrity issue, communicate carefully.
- **Root-cause fix:** Implement the **inbox pattern** — record `event_id` in the same DB transaction as the debit, and commit offsets **after** the DB commit. Redeliveries now find the id present and skip.
- **Prevention:** Code review rule: dedup state must be durable and atomic with the effect; offsets commit after effects. Add a test that replays the same event and asserts a single debit.

---

### S5. Webhook consumer (a partner) complains about duplicate deliveries

**Situation:** A partner integrating your webhooks says they're processing some events twice and asks you to "guarantee exactly-once."

- **Mitigate:** Explain the contract: you provide **at-least-once** delivery with a stable `X-Event-Id`; duplicates are expected when their ack is lost.
- **Diagnose with data:** Your delivery log shows 2xx-then-retry cases where the partner's response was slow/lost, so you re-sent — correct behavior under at-least-once.
- **Communicate:** Document and guide: "Dedup on `X-Event-Id`; treat handlers as idempotent." Provide the event id and signature in headers.
- **Root-cause fix:** None on your side — the design is correct. Help the partner add idempotent handling (store processed `X-Event-Id`s).
- **Prevention:** Make the at-least-once contract explicit in the public docs and SDK; ship a sample idempotent handler so integrators get it right by default.

---

### S6. A months-old replay re-triggers emails because it's outside the dedup window

**Situation:** After restoring a broker from backup, a replay re-sends events from weeks ago, and customers get duplicate emails.

- **Mitigate:** Pause the email sink; filter the replay to only events after the last-known-good watermark.
- **Diagnose with data:** The dedup window (TTL) was sized for hours, but the replay was weeks old → dedup records had expired, so the events looked new.
- **Communicate:** Apologize to affected customers; explain the one-off replay cause and that it's contained.
- **Root-cause fix:** Make irreversible sinks (email/SMS) gate on a **durable, long-lived "already actioned" record** keyed by event id, independent of the short dedup window; or have replays run in a "no external side effects" mode.
- **Prevention:** Replays must be explicitly flagged and route external side effects through a guard; document that dedup windows are bounded and design replay tooling around that limitation.
