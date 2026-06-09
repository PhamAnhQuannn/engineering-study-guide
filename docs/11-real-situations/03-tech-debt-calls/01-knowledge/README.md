# Tech Debt Calls — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: When to pay debt, when to defer.

Technical debt is the implied future cost of choosing an easier-now solution over a better one. The senior skill isn't "have no debt" — that's neither possible nor desirable — it's **portfolio management of debt**: knowing which debt is accruing dangerous interest, which is harmless, how to make it visible, how to justify paying it in business terms, and how to pay it down safely without halting delivery. You manage debt like a CFO manages a balance sheet, not like a perfectionist who can't stand a mess.

---

## Core concepts

### Principal vs. interest
- **Principal** = the work required to fix the shortcut (refactor it, replace the hack).
- **Interest** = the ongoing drag you pay *until* you fix it — slower changes, more bugs, more onboarding friction, more incidents.

The decisive question for "pay now or defer" is **not** "is this code bad?" but **"what's the interest rate, and is it compounding?"** High-interest debt on a hot, fast-changing path is worth paying down; the same ugliness in a stable, rarely-touched module accrues almost no interest and is usually fine to leave (you can declare bankruptcy on it — just don't touch it).

### Fowler's technical-debt quadrant
Martin Fowler classifies debt on two axes — **deliberate vs. inadvertent** and **prudent vs. reckless**:

| | Reckless | Prudent |
|---|---|---|
| **Deliberate** | "We don't have time for design." | "We must ship now and deal with consequences." |
| **Inadvertent** | "What's layering?" | "Now we know how we should have done it." |

The healthy, manageable kind is **prudent-deliberate** (a conscious loan) and **prudent-inadvertent** (learning). **Reckless** debt — taken from ignorance or carelessness — is the kind to drive out via review, standards, and learning.

### Types of debt (not just code)
Debt hides in many layers; seniors look beyond messy functions:
- **Code debt** — duplication, tangled modules, missing abstractions, dead code.
- **Architectural debt** — wrong boundaries, a distributed monolith, the wrong datastore — the most expensive to repay.
- **Test debt** — missing/flaky tests; raises the interest on *all* other changes because every change is riskier.
- **Dependency debt** — outdated/unpatched libraries, EOL runtimes; accrues *security* interest and eventually forces a painful forced upgrade.
- **Data/schema debt** — a model that no longer fits reality; expensive because migrations are one-way doors.
- **Documentation / knowledge debt** — tribal knowledge, bus-factor-of-one.
- **Process/infra debt** — manual deploys, no CI, flaky pipelines.

### Interest is highest where change is most frequent
Debt only hurts where you keep touching the code. Use **change frequency × complexity** (hotspot analysis — e.g., from git history) to find the debt that actually costs you: the files that change constantly *and* are complex are your highest-interest hotspots. This is how you prioritize cleanup objectively instead of by who complains loudest.

### Making debt visible and fundable
Debt that isn't measured doesn't get paid. Techniques:
- **A debt register / backlog** with each item's estimated principal *and* interest (what it's slowing/risking).
- **Tie it to business metrics** — cycle time, escape-defect rate, incident frequency, onboarding time, security exposure. "This module costs ~30% velocity tax" gets funded; "the code is ugly" does not.
- **Label it on the things it touches** (e.g., flagged TODOs linked to tickets) so it's seen at the point of change.

---

## How to pay it down (without stopping delivery)

- **Boy-scout rule** — leave code a little cleaner than you found it; continuous, opportunistic cleanup on the paths you already touch.
- **"Make the change easy, then make the change"** — small, targeted refactors that unblock the feature you're shipping, under test.
- **Steady allocation** — reserve a fixed fraction of capacity (commonly ~15–25%) each sprint for the highest-interest debt. Beats one-off "debt sprints" that get cancelled under pressure.
- **Strangler fig** — for big architectural debt, route slices through a new implementation while the old one keeps running, then retire the old — incremental, low-risk, no big-bang rewrite.
- **Characterization tests first** — before refactoring legacy code, pin its current behavior with tests so you can refactor safely.
- **Bankruptcy** — for low-interest debt in cold code, *decide not to fix it* and document that decision. Not paying is a legitimate, deliberate call.

---

## Key terms & definitions

- **Technical debt** — implied future cost of an easier-now solution over a better one.
- **Principal / interest** — cost to fix vs. ongoing drag until fixed.
- **Hotspot** — high change-frequency × high complexity code; where interest concentrates.
- **Strangler fig** — incremental replacement pattern that gradually retires legacy.
- **Boy-scout rule** — opportunistic cleanup on touched code.
- **Debt register** — explicit, prioritized inventory of known debt.
- **Bit rot / software entropy** — gradual decay as a system evolves and assumptions drift.
- **Bankruptcy (declaring)** — consciously choosing never to fix low-value debt.

---

## Tradeoffs

- **Pay now vs. defer.** Paying now costs capacity but cuts compounding interest on hot paths; deferring preserves velocity for features but lets high-interest debt compound. Decide by interest rate, not aesthetics.
- **Incremental vs. big-bang.** Incremental (strangler, boy-scout) is lower-risk and keeps delivery flowing but is slow; a big rewrite is faster *on paper* but is the highest-risk move in software and usually overruns — rarely the right call.
- **Fixing vs. isolating.** Sometimes you don't fix bad code — you *wrap and isolate* it behind a clean interface so the rot can't spread, then replace it later.
- **Local cleanup vs. team standards.** Cleaning one file helps a little; fixing the *process* that produced reckless debt (review, CI, linting, standards) prevents it at the source.

---

## Common pitfalls & misconceptions

- **"All debt must be eliminated."** No — low-interest debt in cold code is fine to leave. Chasing zero debt is its own waste.
- **Prioritizing by ugliness, not interest.** Refactoring the code that annoys you instead of the code that's actually slowing the team.
- **The big-bang rewrite.** "Let's just rewrite it" is the classic trap — high risk, long no-value period, usually re-creates the same debt. Prefer strangler.
- **Debt sprints that get cancelled.** One-off cleanup sprints are the first thing cut under pressure; a steady allocation survives.
- **Justifying in engineer-speak.** "It's not SOLID" won't get funded. Translate to velocity, bugs, security, cost.
- **Refactoring without tests.** Changing legacy behavior with no safety net — you'll introduce bugs and lose trust in cleanup work.
- **Confusing debt with bad work.** Prudent, deliberate debt is a legitimate engineering tool, not a moral failing.
- **Letting dependency debt rot.** Outdated libs feel harmless until a CVE or an EOL forces an emergency, high-risk upgrade.

---

## What interviewers probe

- **Do you reason about *interest*, not aesthetics?** Can you say *which* debt matters and why (hot path, security, compounding)?
- **Can you make the case in business terms?** Velocity, defect rate, incidents, cost — not "the code is ugly."
- **Do you pay it down *safely and incrementally*?** Strangler, boy-scout, tests-first — or do you reach for a risky rewrite?
- **Do you know when *not* to fix it?** Maturity to leave low-interest debt and document the decision.
- **Prevention mindset.** Do you address the *source* of reckless debt (standards, review, CI), not just the symptoms?
- **Stakeholder management.** Can you get debt funded against feature pressure?

---

## Quick-reference summary

1. **Debt = principal (cost to fix) + interest (ongoing drag).** Prioritize by *interest rate*, not by how ugly it is.
2. **Interest concentrates in hotspots** — high change-frequency × complexity. Use git history to find them objectively.
3. **Debt comes in many forms:** code, architecture, tests, dependencies, data/schema, docs, process — not just messy functions.
4. **Make it visible and fundable:** a debt register, tied to business metrics (velocity, bugs, incidents, security, cost).
5. **Pay it down incrementally:** boy-scout rule, "make the change easy," steady ~15–25% allocation, strangler fig — never a big-bang rewrite.
6. **Refactor under characterization tests** so cleanup doesn't introduce bugs.
7. **It's OK to *not* pay** low-interest debt in cold code — declare bankruptcy and document it.
8. **Fix the source of reckless debt** (review, standards, CI, dependency hygiene), not just the instances.
