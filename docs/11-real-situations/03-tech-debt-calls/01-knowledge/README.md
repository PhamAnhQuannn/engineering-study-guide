# Tech Debt Calls — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: When to pay debt, when to defer.

> **🛒 Where we are in building ShopFast** — We shipped carefully in [Ship vs. Right](../../02-ship-vs-right/01-knowledge/README.md) and protected the non-negotiables at launch. But over six months of post-launch feature delivery, the shortcuts we took *deliberately* — and a few we took *accidentally* — have piled up. The modular monolith's seams are fraying: the catalog module is directly querying the orders table, there are three different ways to apply discounts, and the checkout path has accumulated conditional branches that nobody fully understands. **Time to make the debt call.** **Next:** Some of this debt will require [Migrations](../../04-migrations/01-knowledge/README.md) — moving data and services without taking the site down.

---

## Teaching arc: paying down ShopFast's modular-monolith seams

### What it is & why it matters

Technical debt is the implied future cost of choosing an easier-now solution over a better one. The senior skill is not "have no debt" — that is neither possible nor desirable — it is **portfolio management of debt**: knowing which debt is accruing dangerous interest, which is harmless, how to make it visible, how to justify paying it in business terms, and how to pay it down safely without halting delivery. You manage debt like a CFO (Chief Financial Officer) manages a balance sheet, not like a perfectionist who can't stand a mess.

Why this matters in interviews: senior engineers are expected to balance engineering quality against business delivery. Interviewers want to hear business-fluent reasoning ("this is costing us 30% velocity on the checkout path") not aesthetic reasoning ("the code is ugly").

---

### A ShopFast situation: the catalog-orders coupling that is slowing every checkout feature

**Context.** Six months after launch, ShopFast's checkout path has become the slowest part of the codebase to change. Any new checkout feature requires touching five files across three modules. The root cause: the `order` module was supposed to depend only on the `CatalogApi` *interface* (as designed — see [Architecture Styles](../../../03-system-design/04-architecture-styles/01-knowledge/README.md)), but under deadline pressure, two engineers added direct SQL queries from the order module into the `catalog.products` table. Now `order` implicitly knows the catalog's schema.

Additionally, there are three different code paths for applying discounts (one in catalog, one in cart, one injected inline into order processing), because each was built by a different engineer under different deadlines, and nobody wanted to refactor existing working code to unify them.

**Timeline**

**Month 6, sprint planning — Symptom.** The team estimates a new "bundle discount" feature at 13 story points. A similar feature three months ago was 3 points. When the lead asks why, the answer is: "We have to update the discount logic in three places, and every time we touch checkout SQL we risk breaking the product-price join." The velocity chart over 6 months shows a consistent 20% decline on checkout-adjacent features.

**Month 6, week 1 — Making it measurable.** Senior engineer Tomas runs a hotspot analysis using git history: files that have changed more than 10 times in 6 months AND have cyclomatic complexity (a measure of code branching — the higher the number, the harder to test and reason about) above 15. Three files come out at the top: `order_processor.ts`, `discount_engine.ts`, and `catalog_query_builder.ts`. These are the hotspots — the high interest-rate debt.

He ties it to a business metric: "These three files account for ~65% of checkout-related bug reports and ~80% of checkout-feature story-point inflation. Fixing the catalog-orders coupling and unifying the discount engine will recover an estimated 2-3 story points per checkout feature going forward. At our current cadence (one checkout feature per 2-week sprint), that's roughly 1 week of recovered capacity per month."

**Month 6, week 1 — The debt register entry.** Tomas creates three debt register entries in the backlog:
1. **DEBT-21: Remove direct SQL queries from order module into catalog tables.** Principal: ~4 days. Interest: ~20% velocity tax on every checkout-adjacent feature. Priority: HIGH (hot path, compounding).
2. **DEBT-22: Unify three discount-engine code paths into one.** Principal: ~3 days. Interest: ~15% velocity tax + 3 bugs/month in discount-related edge cases. Priority: HIGH.
3. **DEBT-23: Outdated `stripe-node` SDK — 2 major versions behind.** Principal: ~1 day of testing. Interest: growing CVE (Common Vulnerability and Exposure) surface; will become a forced emergency upgrade at some point. Priority: MEDIUM (security interest is non-linear).

**Month 6, week 2 — Getting it funded.** In the sprint review, Tomas presents to the PM: "Checkout features are costing us ~60% more story points than they should because of three structural issues. If we allocate 2 sprints to pay down DEBT-21 and DEBT-22, we get an estimated 25% checkout-feature velocity improvement for the remainder of the year. That's a 4-month payback period. Here's the evidence." The PM agrees to 20% of sprint capacity for the next 3 sprints dedicated to DEBT-21 and DEBT-22.

**Month 7, weeks 1-3 — Paying it down safely.** The team uses a combination of approaches:
- **Boy-scout rule** on normal checkout features: whenever a feature touches `order_processor.ts`, the engineer cleans up the nearest direct catalog SQL query (adds a wrapper method behind the `CatalogApi` interface). No separate refactor sprint needed for those small wins.
- **"Make the change easy, then make the change"** for the discount unification: first sprint creates a new `DiscountEngine` class with a unified interface but still delegates to the three old implementations. Second sprint migrates the three call sites. Third sprint deletes the old implementations. Each step is independently shippable and passes tests.
- **Characterization tests first**: before any refactor of `order_processor.ts`, the team writes tests that pin its current observable behavior (inputs → outputs), not its internals. This creates a safety net before restructuring.

**Month 7, sprint 3 — Results.** "Bundle discount" feature (same scope as the 13-point estimate from before) is estimated at 5 points and ships in 3 days. Two checkout-related bugs in that sprint vs. a monthly average of 7. Tomas updates the debt register: DEBT-21 and DEBT-22 marked resolved. DEBT-23 promoted to HIGH after a Stripe-node CVE advisory.

**The lesson.** The decision to pay was justified by *interest rate* (hot path, compounding velocity tax) not aesthetics. The decision to *not* pay a third item (a legacy CSV export feature that is called once a month and unchanged for 18 months) was documented as "declaring bankruptcy" — low interest, cold code, not worth touching.

---

### How to handle it

**The principal vs. interest frame.** The decisive question for "pay now or defer" is NOT "is this code bad?" but **"what is the interest rate, and is it compounding?"** High-interest debt on a hot, fast-changing path is worth paying down. The same ugliness in a stable, rarely-touched module accrues almost no interest and is usually fine to leave — you can declare bankruptcy on it.

**Finding the hotspots.** Use **change frequency × complexity** from git history to identify where interest actually concentrates. The files that change constantly *and* are complex are your highest-interest hotspots. This makes prioritization objective instead of aesthetic.

**Making it visible and fundable.** Debt that isn't measured doesn't get paid. Techniques:
- A **debt register / backlog** with estimated principal *and* interest.
- **Tie to business metrics** — cycle time, escape-defect rate, incident frequency, onboarding time, security exposure. "This module costs ~30% velocity tax" gets funded. "The code is ugly" does not.
- **Label it at the point of change** (flagged TODOs linked to tickets) so it's seen when engineers touch it.

**How to pay it down (without stopping delivery)**
- **Boy-scout rule** — leave code a little cleaner than you found it. Continuous, opportunistic cleanup on paths you already touch.
- **"Make the change easy, then make the change"** — small, targeted refactors that unblock a feature you're shipping, under test.
- **Steady allocation** — reserve a fixed fraction of capacity (commonly ~15–25%) each sprint for highest-interest debt. Beats one-off "debt sprints" that get cancelled under pressure.
- **Strangler fig** — for big architectural debt, route slices through a new implementation while the old one keeps running. Incremental, low-risk, no big-bang rewrite.
- **Characterization tests first** — before refactoring legacy code, pin its current behavior with tests.
- **Bankruptcy** — for low-interest debt in cold code, *decide not to fix it* and document that decision.

---

### What good looks like

- You identify debt by *interest rate*, not by how much it bothers you aesthetically.
- You present debt to stakeholders in business terms — velocity tax, bug rate, security exposure — not technical language.
- You get it funded by showing a payback period (2 sprints of investment → 25% velocity gain for the rest of the year).
- You pay it down incrementally — boy-scout + steady allocation + strangler fig — never a risky big-bang rewrite.
- You refactor under tests, so cleanup doesn't introduce regressions.
- You explicitly declare bankruptcy on low-interest cold debt, which frees attention for the debt that actually matters.
- DEBT-23 (outdated Stripe SDK) is promoted from medium to high when a CVE is published — you revisit the register regularly, not just when it's painful.

---

### Pitfalls

- **"All debt must be eliminated."** Low-interest debt in cold code is fine to leave. Chasing zero debt is its own waste.
- **Prioritizing by ugliness, not interest.** Refactoring the code that annoys you instead of the code that's actually slowing the team.
- **The big-bang rewrite.** "Let's just rewrite it" is the classic trap — high risk, long no-value period, usually re-creates the same debt. Prefer strangler.
- **Debt sprints that get cancelled.** One-off cleanup sprints are the first thing cut under pressure. A steady allocation survives.
- **Justifying in engineer-speak.** "It's not SOLID (Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion)" won't get funded. Translate to velocity, bugs, security, cost.
- **Refactoring without tests.** Changing legacy behavior with no safety net — you'll introduce bugs and lose trust in cleanup work.
- **Letting dependency debt rot.** Outdated libraries feel harmless until a CVE or an EOL (End of Life) runtime forces an emergency, high-risk upgrade.

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
- **Dependency debt** — outdated/unpatched libraries, EOL (End of Life) runtimes; accrues *security* interest and eventually forces a painful forced upgrade.
- **Data/schema debt** — a model that no longer fits reality; expensive because migrations are one-way doors.
- **Documentation / knowledge debt** — tribal knowledge, bus-factor-of-one.
- **Process/infra debt** — manual deploys, no CI (Continuous Integration), flaky pipelines.

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
