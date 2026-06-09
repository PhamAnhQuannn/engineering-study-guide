# Problem Decomposition — Real-World Situations

[← Topic overview](../README.md)

> Topic: Break epics into shippable slices, scoping, estimation.

On-the-job scenarios. Each follows: **model the approach → diagnose with data → communicate → root-cause fix → prevention.**

---

### S1. A PM hands you a vague 2-quarter epic and wants "a date" tomorrow

**Approach:** You can't responsibly commit a date to an undecomposed epic. Convert ambiguity into a sliced plan before you commit numbers.

**Diagnose with data:** Identify the biggest unknowns and which ones could blow the estimate (the risky slices). Find reference-class data — the closest project the team actually shipped.

**Communicate:** Give a *ranged* estimate now ("roughly 1–2 quarters, ±50%, tightening after a 1-week spike on the unknown X"), explain the cone of uncertainty, and commit to a firmer date after decomposition and the spike. Offer milestones with demonstrable value, not one far-off date.

**Root-cause fix:** Decompose into a walking skeleton + risk-first vertical slices. Spike the top unknown. Re-estimate against actuals.

**Prevention:** Establish a norm that estimates for undecomposed work are ranges, and that a spike precedes any committed date for novel work.

---

### S2. Your team has been "almost done" for three sprints because everything integrates at the end

**Approach:** This is classic horizontal slicing / integration hell. Stop adding layers and force end-to-end integration.

**Diagnose with data:** Look at what's actually shippable end to end (likely nothing). The work is 90% per-layer-complete but 0% integrated — the dangerous shape.

**Communicate:** Be honest with stakeholders that "90% done per component" ≠ "90% done," and reset expectations with an integrated walking-skeleton milestone.

**Root-cause fix:** Build a walking skeleton through the existing pieces immediately to surface integration bugs, then convert remaining work into vertical slices that each ship something demonstrable.

**Prevention:** Require every story to be a vertical slice (passes INVEST) and demonstrable end to end. Make "deployable to prod behind a flag" the definition of done per slice.

---

### S3. A junior decomposed an epic into ten tasks that only deliver value together

**Approach:** Tasks are not slices. Coach the difference without taking over.

**Diagnose with data:** Walk the ten tasks: can any subset ship and provide value or learning? If not, it's one big-bang dressed as ten items.

**Communicate:** Ask guiding questions — "which two of these, together, would let us demo *one* real scenario end to end?" Let them rediscover the vertical cut.

**Root-cause fix:** Re-cut into 3–4 vertical slices, each independently shippable, sequenced risk-first. Pair on the first one.

**Prevention:** Add INVEST and "is this slice independently shippable?" to the team's story-writing checklist and review backlog grooming together.

---

### S4. Mid-project, a spike reveals the chosen approach can't meet a hard requirement

**Approach:** This is the spike doing its job — better now than at the deadline. Treat it as planned learning.

**Diagnose with data:** Confirm the finding with the spike's evidence. Quantify the gap (e.g., "approach maxes at 2k RPS, requirement is 8k") and identify which slices are affected vs salvageable.

**Communicate:** Surface immediately, blamelessly: here's what the spike found, here are the options and their re-plan cost. No hiding it to "make up time."

**Root-cause fix:** Re-sequence around the new constraint; keep the slices that still hold; spike the alternative approach for the affected path.

**Prevention:** Front-load feasibility spikes for hard non-functional requirements *before* committing the roadmap, not mid-project.

---

### S5. Two slices you thought were independent turn out to be tightly coupled, blocking parallel work

**Approach:** Hidden coupling broke the independence assumption. Make the dependency explicit and break it if cheap.

**Diagnose with data:** Map the actual dependency — is it a shared data structure, an interface, or a deploy-order constraint? Determine whether it's essential or accidental.

**Communicate:** Tell both owners and re-sequence transparently rather than letting them block each other silently.

**Root-cause fix:** Introduce a stable interface or contract so the two slices can be developed against a mock and integrated independently (e.g., consumer-driven contract). If coupling is essential, serialize the work and adjust the plan.

**Prevention:** When slicing, explicitly check the "I" in INVEST and identify shared touchpoints up front; define interface contracts early so parallel slices integrate against a stable boundary.
