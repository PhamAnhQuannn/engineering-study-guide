# Ship-Now vs Do-Right — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Deadline pressure, quality tradeoffs.

The "ship now vs. do it right" tension is the everyday senior judgment call: under deadline pressure, how much quality, completeness, and robustness do you trade for speed — and how do you make that trade *deliberately, transparently, and reversibly* rather than by accident? The senior signal is **not** "always ship fast" or "always do it right." It's having a framework that fits the decision to its stakes and time horizon, naming the tradeoff out loud, and leaving a paper trail so the shortcut gets paid back instead of forgotten.

---

## Core concepts

### Intentional vs. accidental shortcuts
Ward Cunningham's original **technical debt** metaphor is about *intentional* shortcuts taken with awareness, like a loan you plan to repay. The dangerous kind is *accidental/unconscious* debt — corners cut because nobody noticed or thought about them. The senior move is to make every shortcut a conscious, written decision: "We are skipping X to hit the date; here's the risk; here's the payback plan." A named shortcut is a loan; an unnamed one is a leak.

### The reversibility test (one-way vs two-way doors)
Amazon's framing: **two-way-door** decisions are easily reversible, so move fast and ship. **One-way-door** decisions (public API contracts, data formats, schema you'll have to migrate, security and privacy choices, anything customers build on) are expensive or impossible to undo — slow down and do them right. Most decisions are two-way doors that teams over-deliberate; the skill is spotting the rare one-way door hiding in a "just ship it."

### Reversible corners vs. permanent corners
Not all "cutting quality" is equal:
- **Cheap-to-fix-later (ship now):** missing nice-to-have UI polish, un-refactored internal code, a manual ops step, incomplete docs, a feature flag default. These are reversible and contained.
- **Expensive/dangerous-to-fix-later (do it right):** data model and schema, public API shape, security/auth, anything touching money, idempotency/correctness of writes, PII handling, observability for a critical path. Cutting these creates *unbounded* future cost or risk.

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
6. **Write it down.** A ticket, an ADR, a `// TODO(JIRA-123): shortcut because deadline, revisit by Q3` — make the loan visible with a payback owner and date.

---

## Key terms & definitions

- **Technical debt** — the implied future cost of choosing a faster/easier solution now over a better one.
- **Principal / interest** — principal is the work to fix the shortcut; interest is the ongoing drag (slower changes, more bugs) until you do.
- **One-way / two-way door** — irreversible vs. reversible decision; governs how much deliberation is warranted.
- **MVP / vertical slice** — the smallest correct, shippable increment of value.
- **Feature flag / canary / dark launch** — mechanisms to ship fast while bounding blast radius.
- **Definition of Done (DoD)** — the agreed bar (tests, docs, monitoring) below which "shipped" doesn't count; the line you negotiate against.
- **"Good enough"** — fit-for-purpose for the current stakes and horizon, not gold-plated.

---

## Tradeoffs

- **Speed → market/learning vs. quality → durability.** Shipping fast buys real-world feedback and revenue; over-polishing a thing nobody wanted is the most expensive quality of all. But fast-and-broken on a money/data path destroys trust faster than slow.
- **Local speed vs. team velocity.** A shortcut speeds *this* ticket but can slow *every future* ticket on that code — debt is a tax on the team, not just on you.
- **Cutting tests vs. cutting scope.** Cutting scope is usually the safer lever than cutting tests on the part you do ship — bugs in shipped code cost more than a deferred feature.
- **Perfectionism vs. pragmatism.** Gold-plating (YAGNI violations, speculative generality) is as much an anti-pattern as reckless shortcuts; "do it right" doesn't mean "do everything."

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
