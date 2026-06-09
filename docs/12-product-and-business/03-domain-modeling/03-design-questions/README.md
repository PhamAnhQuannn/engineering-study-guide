# Domain Modeling — System Design Questions

[← Topic overview](../README.md)

> Topic: Translate business to system, edge cases.

These are domain-modeling design prompts: the focus is **entities, relationships, invariants, lifecycle, and edge cases**, not raw QPS/sharding. Each follows: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.**

---

## DQ1. Model a restaurant table-reservation system

**Requirements / Scale**
- Diners reserve a table for a party size and time window; restaurants manage availability, holds during checkout, cancellations, no-shows.
- Invariants: a table is reserved by at most one party for an overlapping time window; a reservation references a real, open slot; party size ≤ table capacity.
- Scale: thousands of restaurants, modest write volume per restaurant but heavy concurrency at popular slots.

**High-level design**
- Aggregates: `Restaurant` (owns `Table`s and `OpeningHours`), `Reservation` (the consistency unit for booking a slot). The `Reservation` lifecycle is a state machine: `Held → Confirmed → Seated → Completed`, plus `Cancelled` and `NoShow` (terminal).
- Booking flow: create a time-boxed **Hold** (expires in N minutes) → on payment/confirm, transition to `Confirmed`. Expired holds auto-release.

**Data model**
```
Restaurant(id, name, timezone)
Table(id, restaurant_id, capacity)
Reservation(id, table_id, party_size, start_at_utc, end_at_utc,
            state, hold_expires_at, diner_id, idempotency_key)
-- Invariant: no two non-terminal reservations for the same table_id
-- with overlapping [start_at_utc, end_at_utc).
```
Enforce no-overlap with an exclusion constraint (e.g., Postgres `EXCLUDE USING gist (table_id WITH =, tstzrange(start_at_utc, end_at_utc) WITH &&)` over active states) so concurrent bookings can't double-book at the DB level — not just an app check.

**Scaling & bottlenecks**
- Contention concentrates on popular tables/slots; the exclusion constraint serializes only conflicting writes, which is acceptable. Partition by restaurant.
- Hold expiry via a background sweeper or `hold_expires_at` filter on reads, plus a TTL job.

**Tradeoffs & failure modes**
- Store times in **UTC** but reason in the restaurant's local tz (DST: a 7pm slot must survive a DST shift). Civil "opening hours" are tz-local.
- Idempotency key prevents a retried "confirm" creating two reservations. No-show vs. cancellation are distinct terminal states with different refund rules. Overbooking is *forbidden* here (unlike airlines) — the exclusion constraint guarantees it.

---

## DQ2. Model a financial ledger (double-entry accounting)

**Requirements / Scale**
- Track money movements with a guaranteed audit trail; balances must always be derivable and never silently wrong. Support transfers, refunds, fees, and backdated corrections.
- Invariants: **every transaction's debits equal its credits** (sum to zero); entries are **immutable** once posted; an account balance equals the sum of its entries.

**High-level design**
- **Append-only** model. The `LedgerEntry` is never updated or deleted; corrections are *new* compensating entries (reversals), never edits. This is event-sourcing applied to money — history *is* the truth.
- A `Transaction` (aggregate root) groups ≥2 `LedgerEntry` lines that must net to zero atomically.

**Data model**
```
Account(id, name, currency, type)         -- asset/liability/...
Transaction(id, occurred_at, recorded_at, description, idempotency_key)
LedgerEntry(id, transaction_id, account_id, amount_minor, direction)
-- amount as integer minor units; direction = debit|credit
-- Invariant: SUM(signed amounts) per transaction_id = 0 (enforced in
--   the aggregate + verified by a constraint/trigger or balanced insert)
-- Bi-temporal: occurred_at (valid time) vs recorded_at (transaction time)
Balance(account_id, amount_minor)         -- optional cached projection
```

**Scaling & bottlenecks**
- Reads of "current balance" are expensive if always folded from all entries → maintain a **cached balance projection** (snapshot) updated transactionally, or periodic snapshots + replay of recent entries.
- The append-only log shards by account; cross-account transfers touch two accounts atomically.

**Tradeoffs & failure modes**
- **Event-sourced vs. snapshot:** chosen event-sourced for auditability and time-travel; accept projection complexity.
- **Money as integer minor units + currency**; never floats. Mixed-currency transfers need an explicit FX entry, not silent conversion.
- **Bi-temporal** modeling supports backdated corrections (valid time) while preserving when the system learned them (transaction time) — essential for audits.
- Idempotency keys make replayed/retried postings safe (exactly-once effect on an at-least-once delivery channel).

---

## DQ3. Model a subscription & billing system

**Requirements / Scale**
- Users subscribe to plans (monthly/annual), upgrade/downgrade/cancel, with proration, trials, dunning (failed-payment retries), and coupons.
- Invariants: a user has at most one active subscription per product; an invoice's total equals the sum of its line items minus discounts; you never double-charge a billing period.

**High-level design**
- Aggregates: `Subscription` (lifecycle state machine: `Trialing → Active → PastDue → Canceled/Expired`), `Invoice` (`Draft → Open → Paid/Void/Uncollectible`), `Plan` (price book).
- A scheduled billing engine generates invoices per cycle; payment events drive `Invoice` and `Subscription` transitions; dunning retries on failure with backoff.

**Data model**
```
Plan(id, product_id, interval, amount_minor, currency)
Subscription(id, user_id, plan_id, state, current_period_start,
             current_period_end, trial_end, cancel_at_period_end)
Invoice(id, subscription_id, state, period_start, period_end,
        idempotency_key)
InvoiceLineItem(id, invoice_id, description, amount_minor, proration)
Coupon(id, percent_off|amount_off, valid_until, max_redemptions)
Payment(id, invoice_id, amount_minor, state, provider_ref)
```

**Scaling & bottlenecks**
- The cycle-boundary billing run is bursty (many subscriptions renew on the 1st). Smooth by anchoring billing dates per-subscription rather than calendar-aligned, and process via a queue.
- Webhook/event ingestion from the payment provider must be **idempotent and ordered-tolerant** (events arrive out of order, duplicated).

**Tradeoffs & failure modes**
- **Proration math** is the classic edge case: upgrading mid-cycle credits unused time and charges the new rate prorated — model line items explicitly, in minor units.
- **State-machine guards**: can't reactivate an expired sub the same way as resuming a paused one; cancel-at-period-end vs. immediate cancel are different transitions.
- **Failure mode**: a missed/duplicated provider webhook desyncs subscription state — reconcile periodically (ledger-vs-provider diff). Trials ending, coupons expiring, and currency per-plan are all edge cases to encode.

---

## DQ4. Model a multi-tenant project/issue tracker (Jira-lite)

**Requirements / Scale**
- Organizations contain projects; projects contain issues with configurable workflows (states), assignees, comments, and a permission model.
- Invariants: an issue belongs to exactly one project; a state transition must be allowed by that project's workflow; tenant data is strictly isolated.

**High-level design**
- Bounded contexts emerge: **Identity/Access** (orgs, users, roles), **Work-tracking** (projects, issues, workflows), **Notifications**. Don't build one god `User`.
- Workflow is data-driven: each project has a configurable **state machine** (states + allowed transitions), so the issue lifecycle isn't hard-coded.

**Data model**
```
Organization(id, name)                    -- tenant boundary
User(id) ; Membership(org_id, user_id, role)
Project(id, org_id, key, workflow_id)
Workflow(id) ; WorkflowState(id, workflow_id, name, is_terminal)
WorkflowTransition(id, workflow_id, from_state_id, to_state_id)
Issue(id, project_id, key, current_state_id, assignee_id, reporter_id)
Comment(id, issue_id, author_id, body, created_at)
-- Invariant: an Issue transition is valid only if a WorkflowTransition
--   exists for (workflow_id, from_state, to_state).
-- Tenant isolation: every query scoped by org_id (row-level security).
```

**Scaling & bottlenecks**
- Multi-tenancy strategy: shared schema + `org_id` on every row with **row-level security** (cheap, dense) vs. schema/DB-per-tenant (stronger isolation, costlier). Choose by isolation/compliance needs.
- Hot projects (large issue counts) need pagination and per-tenant indexes.

**Tradeoffs & failure modes**
- **Configurable state machine vs. hard-coded statuses**: configurability is the product, but it complicates the model and invariants (a transition removed from a workflow while issues sit in that state).
- **Tenant leakage** is the catastrophic failure mode — enforce `org_id` scoping at the lowest layer (RLS), not just app code.
- **Soft delete** issues/projects to preserve history and references; permission checks belong to the Access context, consumed by Work-tracking via stable IDs.
