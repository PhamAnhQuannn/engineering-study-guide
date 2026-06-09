# Decision Making — Real-World Situations

[← Topic overview](../README.md)

> Topic: Tradeoff reasoning, build vs buy, tech selection.

On-the-job decision scenarios. Each follows: **model the approach → diagnose with data → communicate → root-cause fix → prevention.**

---

### S1. A vendor you depend on triples its pricing at renewal

**Approach:** Treat as a forced build-vs-buy re-evaluation, not a panic migration. Quantify the new annual cost and your exit cost.

**Diagnose with data:** Pull actual usage, the per-unit cost curve, and the engineering cost to replace (build or alternative vendor). Estimate migration time and risk. Identify lock-in points (proprietary APIs, data formats).

**Communicate:** Bring finance and your manager a one-pager: current cost, projected cost, three options (accept, switch vendor, build) with TCO and timeline for each. Make a recommendation, don't just present options.

**Root-cause fix:** Negotiate first (leverage = credible alternative). If switching, prioritize de-risking the lock-in points. Stage the migration behind an abstraction layer.

**Prevention:** For future vendor choices, score **exit cost** explicitly and wrap third-party APIs behind an internal interface so swapping is a code change, not an architecture change.

---

### S2. You championed a technology choice that's now visibly failing in production

**Approach:** Separate ego from the decision. Own it publicly and fast.

**Diagnose with data:** Is the tech wrong, or is the *usage* wrong? Gather failure metrics — is it a fundamental limitation or a fixable misconfiguration/missing expertise? Distinguish "bad decision" from "bad outcome of a reasonable decision."

**Communicate:** Run a blameless review. State what you knew at the time, what changed, and the options now. Don't defend the sunk cost.

**Root-cause fix:** If it's fixable, fix it. If the tech is fundamentally wrong, plan a phased migration; don't rip-and-replace under pressure.

**Prevention:** Bake a **review trigger** into the original ADR next time ("revisit if p99 > X or ops load > Y"), so course-correction is a planned checkpoint, not a crisis.

---

### S3. Two senior engineers are deadlocked on a Type-1 architecture decision and the team is blocked

**Approach:** A blocked decision is itself a cost. Convert disagreement into a decidable question.

**Diagnose with data:** Force both sides to write down their criteria and the *evidence* behind their position. Often the disagreement is about unstated assumptions or different success criteria, not the tech.

**Communicate:** Name an accountable decider (DACI "D") if none exists. Run a timeboxed spike to gather missing data where the disagreement is empirical.

**Root-cause fix:** Decider chooses, records the rationale and the dissent, and the team **disagrees and commits**. Set a checkpoint to validate.

**Prevention:** Establish up front, for each major decision, *who decides* and *by when* — ambiguity about the decider is the usual root cause of deadlock.

---

### S4. Leadership pushes a "decide today" mandate on an irreversible call with thin data

**Approach:** Resist false urgency on one-way doors without being obstructionist.

**Diagnose with data:** Identify what's actually irreversible vs what can be staged. Find the smallest reversible first step that buys learning without the full commitment.

**Communicate:** Reframe: "We can decide the reversible 80% today and run a 2-week spike on the 20% that's irreversible." Quantify the cost of being wrong vs the cost of a short delay.

**Root-cause fix:** Ship the reversible slice; timebox the spike; commit the irreversible part once the key assumption is validated.

**Prevention:** Educate stakeholders on one-way vs two-way doors so "decide today" gets matched to reversibility, not calendar pressure.

---

### S5. A build-vs-buy decision must be made but the team has strong "not invented here" bias

**Approach:** Surface the bias and re-anchor on TCO and core-vs-context.

**Diagnose with data:** Map the capability: is it core differentiation or undifferentiated lifting? Estimate 3-year TCO of building (including maintenance and on-call) vs buying.

**Communicate:** Present the opportunity cost concretely — "building this is 4 engineer-months we don't spend on the product." Acknowledge the team's craftsmanship desire while reframing where it's best spent.

**Root-cause fix:** Buy/adopt the context capability; redirect the team's energy to the core. If genuinely no vendor fits, build — but with eyes open on maintenance.

**Prevention:** Make "core vs context" an explicit step in the decision template so NIH bias is checked structurally, not personally.
