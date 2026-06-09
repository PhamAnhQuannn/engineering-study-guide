# Cross-Functional Work — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Work with PM/design, requirement clarification, scope.

Each prompt presents named options. Give a reasoned recommendation, then "what would change the answer."

---

### D1. The deadline can't fit the full scope. What gives?

**Options**
- **A — Slip the date.**
- **B — Cut scope** (ship a subset / vertical slice).
- **C — Cut quality** (skip tests, take debt).

**Recommendation:** Default to **B — cut scope** via MoSCoW: ship the Musts as a coherent vertical slice, defer Shoulds/Coulds. Scope is the most reversible lever and preserves a usable, trustworthy product. **A (slip)** is right when the remaining scope is genuinely indivisible or the deadline is soft. Avoid **C** as a default — silent quality cuts create debt that's invisible until it bites, and erode trust.

**What would change the answer:** A hard external deadline (regulation, contract, marketing event) removes A. If you *do* take debt (C), it must be **deliberate, documented, and time-boxed** with a payback plan — and the PM must agree. The decision owner (PM) makes the final call; your job is to surface the options with costs.

---

### D2. A vague feature request arrives. Estimate now or clarify first?

**Options**
- **A — Give a quick estimate** to keep momentum.
- **B — Clarify problem, success metric, NFRs, and acceptance criteria first.**
- **C — Start building** the obvious interpretation.

**Recommendation:** **B.** Estimating or building on an ambiguous spec produces a confident number for the wrong thing. Spend the short time to clarify the underlying problem, success metric, the unstated non-functional requirements, and write testable acceptance criteria. *Then* estimate — the estimate is now meaningful and you've often reshaped the work for the better.

**What would change the answer:** For trivial, well-understood asks a rough estimate (A) is fine. Under extreme time pressure, a *ranged* estimate with stated assumptions ("2–5 days assuming X") beats a false-precision point estimate. Never jump straight to C for anything non-trivial.

---

### D3. You disagree with the PM's chosen approach.

**Options**
- **A — Build it their way** without comment.
- **B — Build your way** quietly.
- **C — Raise it with evidence, propose an alternative, then disagree-and-commit.**

**Recommendation:** **C.** Surface your concern *once*, clearly, with data and a concrete alternative (not just "I don't like it"). If the PM still chooses their path, commit fully and execute well. This preserves your judgment, the PM's ownership of priority, and team trust.

**What would change the answer:** If the disagreement is about a **safety/security/legal/data-integrity** risk (not a preference), escalate harder and put the concern in writing — disagree-and-commit doesn't apply to "this will lose customer money/data." If you have no evidence, gather a little before raising it; opinion rarely beats a decision, data often does.

---

### D4. Communicate a technical constraint: deep dive vs. impact summary.

**Options**
- **A — Walk the stakeholder through the technical mechanism** in detail.
- **B — Lead with business impact + options, offer detail on request.**

**Recommendation:** **B.** Non-engineers make decisions on cost, risk, and timeline — not on join cardinality. Lead with "this approach adds ~2 weeks and a scaling risk; here are two cheaper alternatives and their tradeoffs," and keep the mechanism available if they want it. This respects their time and enables a real decision.

**What would change the answer:** If the stakeholder *is* technical (a staff engineer, a CTO) or explicitly asks for depth, give it. For decisions with long-term architectural consequences, a written design doc with the detail (so it's reviewable and durable) is better than any verbal summary.

---

### D5. Coordinate two interdependent teams: API contract first vs. build-then-integrate.

**Options**
- **A — Agree the API contract up front**, then both teams build to it in parallel.
- **B — One team builds first; the other integrates against the real thing.**
- **C — Build against a shared mock** based on the agreed contract.

**Recommendation:** **A + C.** Define the contract (schema, error cases, idempotency, versioning) early so both teams unblock in parallel, and let the consumer build against a **mock of that contract** while the producer implements it. This is the fastest path and surfaces interface disagreements before code is written. **B** serializes the teams and creates late integration surprises.

**What would change the answer:** If the contract is genuinely unknowable until one side prototypes (high uncertainty/spike territory), a thin throwaway B-style spike to discover the shape, *then* lock the contract, is reasonable. Tight org coupling (Conway's law) may force closer collaboration than a clean contract handoff.

---

### D6. A stakeholder keeps adding "small" requirements mid-project.

**Options**
- **A — Absorb them** to keep everyone happy.
- **B — Refuse new scope** until the project ships.
- **C — Accept, but make each addition visibly trade against scope or date.**

**Recommendation:** **C.** Nothing is free. For each addition, re-estimate and show "this pushes the date by X or displaces feature Y — which do you want?" This keeps you collaborative *and* protects the commitment, and forces the owner to prioritize. **A** is silent scope creep that sinks deadlines; **B** is rigid and damages the relationship.

**What would change the answer:** A genuinely critical, cheap addition discovered mid-flight (a compliance must, a blocking bug) may just be absorbed. A formal change-control process may already define how additions are handled — use it.

---

### D7. Align stakeholders: synchronous meeting vs. async written doc.

**Options**
- **A — Call a meeting.**
- **B — Write a design doc / RFC and gather async feedback.**
- **C — Doc first to align, meeting to resolve open questions.**

**Recommendation:** **C.** A written RFC scales across time zones, creates a durable record, and lets people engage thoughtfully; reserve the meeting for the few genuinely contentious open questions the doc surfaces. Meetings are for *deciding*, docs for *aligning and persisting*. Pure A loses the record and excludes async/remote folks; pure B can stall on a deadlock that a 30-minute call would break.

**What would change the answer:** High urgency or high emotional charge (conflict, sensitive topics) favors a synchronous conversation first. Tiny, low-stakes decisions don't need a doc at all — match ceremony to stakes.

---

### D8. QA/instrumentation: build it in now vs. add after launch.

**Options**
- **A — Bake testability and analytics events into the feature now.**
- **B — Ship the feature, add tests/instrumentation in a follow-up.**

**Recommendation:** **A.** Acceptance criteria, testability, and the events needed to measure success are part of "done," not optional extras. Without them you can't verify quality or tell whether the feature worked, and retrofitting is harder and usually deprioritized ("we'll do it later" = never). Coordinate with QA and Data *during* design, not after.

**What would change the answer:** A true emergency hotfix may ship first and be hardened immediately after. A genuinely throwaway experiment with a binary externally-observable outcome may not need full instrumentation — but anything you'll be judged by needs measurement from day one.
