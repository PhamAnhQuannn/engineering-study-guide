# Tech Debt Calls — Real-World Situations

[← Topic overview](../README.md)

> Topic: When to pay debt, when to defer.

On-the-job scenarios about deciding *when* to pay debt and *how* to pay it safely. For each: **model the approach (assess interest/blast radius) → diagnose with data → communicate/justify → pay it down safely → prevention.** The senior signal is portfolio thinking and business framing — not refactoring whatever annoys you.

---

### S1. Velocity is dropping and nobody knows why

**Scenario:** Your team's story throughput has fallen over two quarters. People grumble about "the codebase," but leadership keeps pushing features and won't fund cleanup.

- **Assess:** The problem is diffuse — "the codebase is bad" isn't actionable or fundable. You need to localize the high-interest debt.
- **Diagnose with data:** Run hotspot analysis from git history (change-frequency × complexity) and correlate with bug data. Two files account for most churn, most bugs, and most cycle time. That's your high-interest debt — everything else is noise.
- **Communicate/justify:** Present it in business terms: "These two modules carry ~30% of our defects and ~25% velocity tax; N days of focused cleanup pays back in ~M weeks," tied to the roadmap they're slowing.
- **Pay it down safely:** Allocate ~20%/sprint to those two hotspots, refactoring under characterization tests, not a rewrite.
- **Prevention:** Make the debt allocation a standing budget; track a hotspot/velocity metric so regressions surface; enforce the boy-scout rule in review.

---

### S2. "We should just rewrite it"

**Scenario:** A senior teammate proposes a full rewrite of a critical 5-year-old service that "everyone hates."

- **Assess:** A big-bang rewrite is the highest-risk option — months of no new value, high overrun probability, and the original "essential complexity" usually reappears. Default skepticism is warranted.
- **Diagnose:** Identify *what specifically* is bad — is it truly architectural/platform death (EOL runtime, wrong datastore), or just messy internals behind a workable interface? Usually it's the latter.
- **Communicate:** Reframe from "rewrite vs. keep" to "incremental replacement." Propose a strangler-fig plan: stand up the new implementation behind the existing interface, route one low-risk slice through it, compare outputs, expand.
- **Pay it down safely:** Migrate slice by slice with the old system as a fallback and a comparison oracle; retire legacy paths only once the new ones are proven.
- **Prevention:** Capture *why* the old system rotted (no boundaries, no tests) so the new one doesn't repeat it; document the decision in an ADR.

---

### S3. The dependency that's three majors behind

**Scenario:** A core framework is several major versions behind and now has a published CVE. Nothing was "broken" until this morning.

- **Assess:** Dependency debt accrued *security* interest silently and now it's forcing an upgrade on a bad day. The immediate priority is the CVE, not the full version jump.
- **Diagnose:** Determine whether the CVE is exploitable in your usage and whether a patch exists for your current major (sometimes you can mitigate without the full upgrade). Map the breaking changes across the majors you've skipped.
- **Communicate:** Flag the security exposure to leadership/security with severity and the remediation plan; set expectations that catch-up upgrades are now a multi-step project.
- **Pay it down safely:** Patch or mitigate the CVE first (fast), then step through the major versions *incrementally*, with the test suite gating each step — not one giant jump.
- **Prevention:** Automated dependency scanning (Dependabot/Renovate + CVE alerts), a policy to stay within N majors of latest, and a recurring upgrade cadence so you never fall this far behind again.

---

### S4. The fragile module everyone's afraid to touch

**Scenario:** A legacy billing module has no tests, is poorly understood, and every change risks an incident. You now must add a small feature to it.

- **Assess:** This module is high-interest *because* you're about to touch it and it's a money path. But a full rewrite under a feature deadline is reckless.
- **Diagnose:** Characterize current behavior — write characterization tests capturing the existing outputs (even the weird ones) so you have a safety net before changing anything.
- **Communicate:** Set expectations that the small feature needs a bit of safety-net investment first; explain the bus-factor and correctness risk to justify it.
- **Pay it down safely:** "Make the change easy, then make the change" — a targeted refactor (just enough to land the feature cleanly), guarded by the new tests; add the feature; leave the touched code cleaner.
- **Prevention:** Keep the characterization tests; chip away with the boy-scout rule on each future visit; document the module so the bus factor improves. Over several touches it becomes safe.

---

### S5. Defending the decision NOT to fix something

**Scenario:** A new teammate is appalled by an ugly, non-idiomatic utility module and wants to refactor it immediately.

- **Assess:** Ugly ≠ high-interest. This module is stable, well-isolated, and changed twice in two years. Its interest is near zero, so cleanup is poor ROI right now.
- **Diagnose:** Check the data — change frequency and defect history. It's cold code. There's no compounding cost.
- **Communicate:** Explain the portfolio view kindly: "It offends the eye, but it's stable and isolated; refactoring it spends principal for ~zero interest saved. Let's spend that effort on the hotspots that actually slow us." Validate the instinct, redirect the energy.
- **Decision:** *Deliberately don't fix it* — declare bankruptcy on it and document that it's intentionally left alone, so it isn't re-litigated every quarter.
- **Prevention:** A shared, written prioritization rubric (interest-based) so cleanup energy goes to the right places and "ugly but harmless" code isn't a recurring debate.

---

### S6. Architectural debt: the accidental distributed monolith

**Scenario:** A set of "microservices" are so tightly coupled (shared DB, synchronous chains, deploy-together) that they have all the costs of distribution and none of the benefits. Changes ripple unpredictably.

- **Assess:** This is *architectural* debt — the most expensive kind, and high-interest because it taxes every cross-service change and every deploy. But it can't be fixed in one move.
- **Diagnose:** Map the actual coupling — which services share the DB, which call chains are synchronous, which must deploy together. Quantify the pain (failed deploys, cross-service incidents, change lead time).
- **Communicate:** Make the architecture's cost visible to leadership in delivery and reliability terms; propose a phased decoupling, not a re-architecture sprint.
- **Pay it down safely:** Phase it — first break the shared-DB coupling (give each service its own data and an API/events boundary), then replace synchronous chains with async where appropriate, decoupling deploys. Each phase ships independent value.
- **Prevention:** Enforce service boundaries (no cross-service DB access) in review and CI; add architectural fitness functions; an ADR establishing ownership and contracts so the coupling doesn't silently grow back.
