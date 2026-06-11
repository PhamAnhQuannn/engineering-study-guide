# Refactoring & Tech Debt — Real-World Situations

[← Topic overview](../README.md)

> Topic: Safe refactor, legacy code, tech debt management.

On-the-job scenarios. Each follows: **model approach → diagnose with data → communicate → root-cause fix → prevention.**

---

### S1. Every feature in the "billing" module takes 3× the estimate and breaks something else

**Approach:** This is classic high-interest debt — shotgun surgery and low cohesion. Treat it as a measurable velocity/risk problem, not "the code is ugly."
**Diagnose with data:** Pull git churn and defect density for the module; map cyclomatic complexity. Likely findings: one God class, type-switch sprawl, and changes that ripple across many files (shotgun surgery). Identify the few hotspots driving most of the pain.
**Communicate:** Show product the data — "billing has the highest churn × complexity and caused N incidents; each change pays a tax." Propose targeted paydown tied to upcoming billing roadmap work, not a blanket rewrite.
**Root-cause fix:** Get the hotspots under **characterization tests**, then refactor incrementally: extract cohesive classes (split by reason-to-change), replace the type-switch with polymorphism, introduce value objects for money/currency. Keep refactor commits separate from feature commits.
**Prevention:** Boy Scout rule on every billing touch; a small recurring debt budget; complexity/churn dashboard to catch the next hotspot early.

---

### S2. Leadership wants to rewrite the legacy monolith from scratch

**Approach:** Rewrites are the highest-risk option; push for incremental migration unless the case is truly exceptional.
**Diagnose with data:** Quantify what the monolith actually does (endpoints, edge cases, integrations) and where the real pain is — is it the architecture, or just messy internals that could be refactored in place? Estimate the rewrite's "catch-up" cost (re-implementing years of bug fixes).
**Communicate:** Lay out the failure history of big-bang rewrites (months of zero delivery, lost edge-case knowledge, the new system rarely catches up). Propose **Strangler Fig** as the lower-risk path that still modernizes.
**Root-cause fix:** Put a facade/router in front; carve out one bounded capability, build it new behind the facade, route traffic to it, verify, then expand slice by slice — each reversible. Retire old modules as they're strangled.
**Prevention:** Establish module boundaries and contract tests so future modernization can proceed incrementally; avoid letting the system become an undifferentiated ball of mud again.

---

### S3. You must add a feature to a 1500-line untested class on a tight deadline

**Approach:** Don't refactor blind, and don't bury more logic in the mess. Add new behavior safely beside the old.
**Diagnose with data:** Identify the seam where the new behavior hooks in and the minimal current behavior you must not break.
**Communicate:** Set the expectation that you'll **sprout** the new logic in a tested unit now and log the larger refactor as debt for later — a deliberate, recorded tradeoff to hit the date.
**Root-cause fix:** Use **sprout method/class**: write the new feature in a fresh, fully unit-tested class/function, and make the smallest possible call to it from the legacy class. The new code is clean and tested; the untested mess is barely touched. Add a characterization test around the one call site you modified.
**Prevention:** File the debt ticket with churn/risk context; next time the class is touched, expand the test net and begin extracting. Over several touches the class gets incrementally tamed.

---

### S4. A refactor "to clean things up" caused a production incident

**Approach:** A behavior-preserving refactor that changed behavior means the safety net failed. Stabilize, then learn — blamelessly.
**Diagnose with data:** Compare the diff against the incident; find which transformation altered behavior (an edge case the tests didn't cover, or a refactor mixed with a subtle logic change). Check whether the PR mixed refactor + feature (a common cause).
**Communicate:** Run a blameless retro. The lesson is process, not the individual: refactors need a real net and must be isolated from behavior changes.
**Root-cause fix:** Roll back or hotfix; add a regression test for the exact missed case; if the PR mixed hats, that's the real defect to call out.
**Prevention:** Require refactors to be separate commits/PRs with tests green throughout; add characterization tests before risky refactors; prefer automated IDE refactorings over hand edits; expand coverage on edge cases the incident revealed.

---

### S5. The team has stopped refactoring entirely because "we don't have time"

**Approach:** Debt is compounding; reframe refactoring as continuous and cheap, not a separate expensive project.
**Diagnose with data:** Show the trend — rising cycle time, rising defect rate, estimates consistently blown. Connect it to accumulating debt in high-churn modules.
**Communicate:** Make the case that *not* refactoring is the expensive choice (interest compounding). Propose a sustainable model rather than a scary freeze.
**Root-cause fix:** Adopt the **Boy Scout rule** (leave touched code a little better) plus a small fixed capacity (~10–20%) for larger paydowns, prioritized by churn × complexity. Refactor *as part of* feature work in the same area ("make the change easy, then make the change"), so it's not a separate budget line to defend each time.
**Prevention:** Track velocity/defect metrics so the benefit is visible; bake "leave it better" into the definition of done and code review; maintain a visible, ranked debt backlog so paydown is deliberate.

---

### S6. A widely-used internal library API is poorly designed; many teams depend on it

**Approach:** You can't break dozens of consumers at once. Migrate via abstraction, not a flag day.
**Diagnose with data:** Inventory the call sites and the worst API warts. Identify which consumers are high-traffic/critical.
**Communicate:** Publish a migration plan and timeline; give consumers a clear new API and a deprecation window with dates.
**Root-cause fix:** Introduce the improved API *alongside* the old one (often the old one becomes a thin adapter over the new). Use **Branch by Abstraction** internally so both coexist. Provide codemods/examples to ease consumer migration, migrate consumers incrementally, then remove the old API once usage hits zero.
**Prevention:** Version the library and enforce backward compatibility; add contract tests with key consumers so breaking changes are caught in CI; design new public APIs more conservatively (smaller surface, easier to evolve).

---

### S7. A dependency is years out of date and now has a known CVE

**Approach:** This is dependency/security debt with a hard risk deadline. Patch fast, but safely.
**Diagnose with data:** Check the CVE severity and exploitability in *your* usage, the gap between current and required version, and the breaking changes in between. Run the test suite against a trial upgrade to surface incompatibilities.
**Communicate:** Flag the security risk to stakeholders with severity and exposure; agree on an urgency-appropriate timeline.
**Root-cause fix:** If a patch release fixes the CVE, take the smallest safe bump first. If a major upgrade is required, do it behind tests; if breaking changes are large, isolate the dependency behind an adapter so the migration is contained, and upgrade in steps. Add tests around the affected integration before upgrading.
**Prevention:** Automated dependency scanning (Dependabot/Renovate + SCA) in CI, a policy/SLA for patching by severity, and regular small upgrades so you never accumulate a multi-version, high-risk gap again.
