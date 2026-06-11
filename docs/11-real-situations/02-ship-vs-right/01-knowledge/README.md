# Ship-Now vs Do-Right — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Deadline pressure, quality tradeoffs.

> **🛒 Where we are in building ShopFast** — We survived the [Black Friday incident](../../01-incident-response/01-knowledge/README.md) and understood what happens when cutting configuration corners compounds under load. Now we face the everyday version of that tension: **a checkout deadline is bearing down, a critical safety gap has been found, and engineering and product are in a standoff.** **Next:** The pattern of accumulated shortcuts leads us to [Tech Debt Calls](../../03-tech-debt-calls/01-knowledge/README.md) — when and how to pay down what we've deferred.

---

## Teaching arc: the checkout deadline standoff

### What it is & why it matters

The "ship now vs. do it right" tension is the everyday senior judgment call: under deadline pressure, how much quality, completeness, and robustness do you trade for speed — and how do you make that trade *deliberately, transparently, and reversibly* rather than by accident? The senior signal is **not** "always ship fast" or "always do it right." It's having a framework that fits the decision to its stakes and time horizon, naming the tradeoff out loud, and leaving a paper trail so the shortcut gets paid back instead of forgotten.

Why this matters in interviews: every senior engineer has been here. Interviewers want to see that you can reason about reversibility and stakes, protect non-negotiables (money, data, security), and communicate tradeoffs to non-engineers without drama.

---

### A ShopFast situation: the checkout idempotency deadline

**Context.** ShopFast has a firm launch date in 11 days. The PM has promised the marketing team a specific go-live so that paid ads can run. Engineering is 90% done with the checkout flow. During a final code review, a senior engineer flags a gap: `POST /v1/orders` does not yet implement `Idempotency-Key` deduplication server-side. The client sends the header, but the server ignores it and will happily create two orders if a mobile user's network drops and their app retries.

**Timeline**

**Day 1, 10:00 AM — The flag.** Senior engineer Priya opens a review comment: "We have a double-charge risk. A retry on a flaky mobile connection will create a duplicate order and charge the customer twice. This is not a two-way door — once a customer is double-charged, the trust damage is done even if we refund. Estimate to fix: 3 days (dedup table, atomic check-then-insert, retry the payment-provider call with the same idempotency key)."

**Day 1, 11:00 AM — PM pushback.** Product Manager Marco responds: "We've validated demand, the ads are booked, and we have zero flexibility on the date. Can we ship and just monitor for duplicates? We'll refund manually if it happens. The risk feels low."

**Day 1, 11:30 AM — The decision frame.** Priya runs the decision frame:
1. **Blast radius if wrong?** Customer-facing, involves money, double-charges cause immediate trust damage and possible payment disputes. This is not "polish" risk — it's correctness risk on the checkout path.
2. **One-way or two-way door?** One-way. A double-charged customer's trust is hard to recover. Refunds are reversible operationally but not reputationally at launch.
3. **Real nature of the deadline?** Hard — ad campaign is paid and booked. Marco is right that the marketing cost is real.
4. **Can we scope-cut instead?** Yes. Priya proposes: ship checkout to **internal users and a closed beta of 50 customers only**, behind a feature flag, on the launch date. The ad campaign drives to a waitlist landing page instead of live checkout. Full public checkout ships 3 days later once idempotency is done.
5. **Can we ship behind a flag / canary?** Yes — this is exactly the proposal.
6. **Write it down.** Whatever is decided, Priya creates JIRA-1847 "Implement idempotency-key dedup on POST /v1/orders" with a due date of launch + 3 days and assigns it to herself.

**Day 1, 2:00 PM — Resolution.** After a 30-minute conversation with Marco and the engineering lead:
- **Non-negotiable confirmed:** Double-charge risk on a real payment path cannot be shipped to the public, full stop. This is agreed in writing in the ticket.
- **Negotiated:** The ad campaign URL changes from `/checkout` to `/waitlist`. The launch date headline ("ShopFast is live!") stands. Full public checkout opens 3 days post-launch. Internal and beta users test the checkout flow on day 1 to generate real data.
- **What was cut (two-way doors):** Missing coupon-code support, incomplete order-history UI, no email receipts yet (queued and pending). These are all reversible add-ons.

**Day 4 — Outcome.** Idempotency dedup ships. Load testing with simulated retries confirms zero duplicate orders. Public checkout opens. Three beta users had actually experienced a retry during the 3-day beta window — zero duplicates, all orders correctly deduplicated.

**The lesson.** The scope-cut (waitlist → checkout) preserved the launch date *and* the non-negotiable. The PM got the launch announcement. Engineering got the safety window. Nobody burned quality on the dangerous part. A junior engineer in this situation often silently ships the risk to protect the date; a senior engineer names the tradeoff, proposes a third option, and documents the decision.

---

### How to handle it

**The decision frame (six questions)**

1. **What's the blast radius if it's wrong?** Internal-only and reversible → ship. Customer-facing, money, data, security → do it right.
2. **Is the door one-way or two-way?** Public API contract / data format / migration / security → one-way door, slow down.
3. **What's the deadline's real nature?** Hard external commitment (regulatory, contractual, paid campaign) vs. soft self-imposed sprint goal. Push back on soft deadlines; respect and de-risk hard ones early.
4. **Can I ship behind a flag / to a canary / to internal users first?** This often collapses the dilemma: you get the speed and contain the risk.
5. **If I cut the corner, can I afford the interest?** Estimate future cost. Debt on a hot, fast-changing path compounds. Debt on a stable, rarely-touched module barely accrues.
6. **Write it down.** A ticket, an ADR (Architecture Decision Record), a `// TODO(JIRA-1847): ...` — make the loan visible with a payback owner and date.

**Non-negotiables vs. negotiables**

Some quality dimensions should almost never be traded for a deadline:
- **Non-negotiable:** correctness of money/safety paths, security, data integrity, not silently losing user data, basic observability on a critical path.
- **Negotiable under pressure:** test depth on low-risk paths, code elegance, full edge-case coverage of rare inputs, performance beyond the SLO (Service Level Objective), completeness of secondary features, internal tooling polish.

**Scope as the primary lever.** Often the best answer to "ship now vs. do it right" is *neither* — it's *cut scope*. Ship a smaller thing done right rather than a bigger thing done badly. Vertical slices (a thin end-to-end path) ship value early and de-risk. The senior reframe of "we can't make the deadline with quality" is usually "what's the smallest version that's correct and shippable?"

---

### What good looks like

- You name the tradeoff explicitly to PM/leadership and get it into writing — no silent absorption of risk.
- You distinguish the non-negotiable (correctness of money path) from the negotiable (missing coupon support) and treat them differently.
- You propose a third option (scope cut + flag + canary) that unblocks the deadline without sacrificing the non-negotiable.
- The shortcut — if any is taken — has a ticket, an owner, a due date, and an estimated cost. It's a loan, not a leak.
- You avoid gold-plating the parts that don't matter. "Do it right" doesn't mean "do everything" — you ship the beta without email receipts or coupon codes and nobody dies.
- You communicate the tradeoff to a PM in terms they care about (trust, refunds, payment disputes), not in engineer-speak ("idempotency").

---

### Pitfalls

- **"Do it right" = do everything.** No — it means do the *irreversible and dangerous* parts right, and the rest good-enough.
- **"Ship now" = ship broken.** No — it means cut scope/polish, never correctness/security on critical paths.
- **Silent shortcuts.** Cutting corners without telling anyone or writing it down. The corner gets forgotten, then it's an incident.
- **Temporary becomes permanent.** "We'll fix it after launch" with no ticket, owner, or date — the most common way debt becomes permanent. Nothing is as permanent as a temporary hack.
- **Treating a self-imposed deadline as immovable.** Seniors negotiate scope/time/quality openly; juniors quietly burn quality to protect a soft date.
- **Over-deliberating two-way doors.** Spending a week designing something you could ship and reverse in an hour.
- **Hero crunch.** Hitting the date via unsustainable overtime, which just moves the cost to burnout and the bugs that come with it.

---

## Core concepts

### Intentional vs. accidental shortcuts
Ward Cunningham's original **technical debt** metaphor is about *intentional* shortcuts taken with awareness, like a loan you plan to repay. The dangerous kind is *accidental/unconscious* debt — corners cut because nobody noticed or thought about them. The senior move is to make every shortcut a conscious, written decision: "We are skipping X to hit the date; here's the risk; here's the payback plan." A named shortcut is a loan; an unnamed one is a leak.

### The reversibility test (one-way vs two-way doors)
Amazon's framing: **two-way-door** decisions are easily reversible, so move fast and ship. **One-way-door** decisions (public API contracts, data formats, schema you'll have to migrate, security and privacy choices, anything customers build on) are expensive or impossible to undo — slow down and do them right. Most decisions are two-way doors that teams over-deliberate; the skill is spotting the rare one-way door hiding in a "just ship it."

### Reversible corners vs. permanent corners
Not all "cutting quality" is equal:
- **Cheap-to-fix-later (ship now):** missing nice-to-have UI polish, un-refactored internal code, a manual ops step, incomplete docs, a feature flag default. These are reversible and contained.
- **Expensive/dangerous-to-fix-later (do it right):** data model and schema, public API shape, security/auth, anything touching money, idempotency/correctness of writes, PII (Personally Identifiable Information) handling, observability for a critical path. Cutting these creates *unbounded* future cost or risk.

The rule of thumb: **ship fast on the reversible, do-it-right on the irreversible and the dangerous.**

### Non-negotiables vs. negotiables
Some quality dimensions should almost never be traded for a deadline:
- **Non-negotiable:** correctness of money/safety paths, security, data integrity, not silently losing user data, basic observability on a critical path.
- **Negotiable under pressure:** test depth on low-risk paths, code elegance, full edge-case coverage of rare inputs, performance beyond the SLO, completeness of secondary features, internal tooling polish.

When you ship the negotiables fast, you protect the non-negotiables; that's how speed and safety coexist.

### MVP and scope as the primary lever
Often the best answer to "ship now vs. do it right" is **neither** — it's *cut scope*. Ship a smaller thing done right rather than a bigger thing done badly. Vertical slices (a thin end-to-end path) ship value early and de-risk. The senior reframe of "we can't make the deadline with quality" is usually "what's the smallest version that's correct and shippable?"

---

## How to make the call (a decision frame)

1. **What's the blast radius if it's wrong?** Internal-only and reversible → ship. Customer-facing, money, data, security → do it right.
2. **Is the door one-way or two-way?** Public contract / data format / migration → one-way, slow down.
3. **What's the deadline's real nature?** A hard external commitment (regulatory, a partner launch, a contractual date) is different from a self-imposed "end of sprint." Push back on soft deadlines; respect (and de-risk early) hard ones.
4. **Can I ship behind a flag / to a canary / to internal users first?** This collapses the dilemma: ship the speed, contain the risk.
5. **If I cut the corner, can I afford the interest?** Estimate the future cost and whether it compounds (debt on a hot, fast-changing path compounds; debt on a stable, rarely-touched module barely accrues interest).
6. **Write it down.** A ticket, an ADR (Architecture Decision Record), a `// TODO(JIRA-123): shortcut because deadline, revisit by Q3` — make the loan visible with a payback owner and date.

---

## Key terms & definitions

- **Technical debt** — the implied future cost of choosing a faster/easier solution now over a better one.
- **Principal / interest** — principal is the work to fix the shortcut; interest is the ongoing drag (slower changes, more bugs) until you do.
- **One-way / two-way door** — irreversible vs. reversible decision; governs how much deliberation is warranted.
- **MVP (Minimum Viable Product) / vertical slice** — the smallest correct, shippable increment of value.
- **Feature flag / canary / dark launch** — mechanisms to ship fast while bounding blast radius.
- **DoD (Definition of Done)** — the agreed bar (tests, docs, monitoring) below which "shipped" doesn't count; the line you negotiate against.
- **"Good enough"** — fit-for-purpose for the current stakes and horizon, not gold-plated.

---

## Tradeoffs

- **Speed → market/learning vs. quality → durability.** Shipping fast buys real-world feedback and revenue; over-polishing a thing nobody wanted is the most expensive quality of all. But fast-and-broken on a money/data path destroys trust faster than slow.
- **Local speed vs. team velocity.** A shortcut speeds *this* ticket but can slow *every future* ticket on that code — debt is a tax on the team, not just on you.
- **Cutting tests vs. cutting scope.** Cutting scope is usually the safer lever than cutting tests on the part you do ship — bugs in shipped code cost more than a deferred feature.
- **Perfectionism vs. pragmatism.** Gold-plating (YAGNI — You Aren't Gonna Need It — violations, speculative generality) is as much an anti-pattern as reckless shortcuts; "do it right" doesn't mean "do everything."

---

## Common pitfalls & misconceptions

- **"Do it right" = do everything.** No — it means do the *irreversible and dangerous* parts right, and the rest good-enough.
- **"Ship now" = ship broken.** No — it means cut scope/polish, never correctness/security on critical paths.
- **Silent shortcuts.** Cutting corners without telling anyone or writing it down. The corner gets forgotten, then it's an incident.
- **Temporary becomes permanent.** "We'll fix it after launch" with no ticket, owner, or date — the most common way debt becomes permanent. There's nothing as permanent as a temporary hack.
- **Treating a self-imposed deadline as immovable.** Seniors negotiate scope/time/quality openly; juniors quietly burn quality to protect a soft date.
- **Over-deliberating two-way doors.** Spending a week designing something you could ship and reverse in an hour.
- **Hero crunch.** Hitting the date via unsustainable overtime, which just moves the cost to burnout and the bugs that come with it.

---

## What interviewers probe

- **Do you have a *frame*, or a reflex?** They want conditional reasoning, not "always ship" / "always polish."
- **Reversibility instinct.** Can you spot the one-way door (schema, public API, data, security) and treat it differently?
- **Do you protect non-negotiables?** Will you refuse to ship a money/security/data corner even under pressure?
- **Scope as a lever.** Do you reach for "cut scope, ship a smaller correct thing" instead of only the speed-vs-quality axis?
- **Transparency & stakeholder management.** Do you name the tradeoff to PM/leadership and document the debt, or quietly absorb it?
- **Payback discipline.** Do shortcuts get tickets, owners, and dates — or vanish?
- **Pragmatism.** Do you also avoid gold-plating and over-engineering?

---

## Quick-reference summary

1. **Make the trade *deliberate, transparent, reversible*** — a named loan, not a silent leak.
2. **Two-way door → ship; one-way door → do it right.** Spot the irreversible decision hiding in "just ship it."
3. **Ship fast on the reversible (polish, internal code, secondary scope); do it right on the dangerous (money, data, security, public contracts, correctness, critical-path observability).**
4. **Cut scope before you cut correctness.** The smallest correct thing beats a big broken thing.
5. **Use flags / canary / dark launch** to get speed *and* bounded risk.
6. **Negotiate soft deadlines; de-risk hard ones early.** Don't quietly burn quality to protect a self-imposed date.
7. **Write the shortcut down** with an owner and a payback date, or it becomes permanent.
8. **Avoid gold-plating too** — "do it right" ≠ "do everything." Good enough for the stakes and horizon.
