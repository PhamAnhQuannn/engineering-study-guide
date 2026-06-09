# Cross-Functional Work — Real-World Situations

[← Topic overview](../README.md)

> Topic: Work with PM/design, requirement clarification, scope.

On-the-job scenarios. Each follows: **model the approach → diagnose with data → communicate → root-cause/fix → prevention.**

---

### S1. The one-line ticket that means five different things

**Situation:** A PM files: "Add export to the reports page." You can build a dozen things from that sentence.

- **Approach:** Don't guess and build. Convert ambiguity into testable requirements before estimating.
- **Diagnose:** Ask the clarifying questions that surface the real job: *Who* exports and *why*? What format and which fields? How much data (scale/NFR)? Is it on-demand or scheduled? Permissions/PII concerns? Sync download or async-with-email for large sets?
- **Communicate:** Write up the answers as **acceptance criteria** (Given/When/Then) and confirm with the PM: "Confirming scope: finance users export the current filtered view as CSV, up to 1M rows, async with email link, respecting row-level permissions. Out of scope: scheduled exports (fast-follow)."
- **Root-cause fix:** Build to the confirmed criteria; the clarified NFR (1M rows) likely changed the design from a synchronous button to an async job.
- **Prevention:** Adopt a "definition of ready" — no ticket enters a sprint without a problem statement, success metric, and acceptance criteria. Push solution-shaped requests back to the problem.

---

### S2. The deadline and the scope don't fit

**Situation:** Three weeks out, the committed feature set clearly won't fit. The PM expects all of it on the date.

- **Approach:** Make the tradeoff explicit early; don't quietly cut corners or sprint to burnout.
- **Diagnose:** Re-estimate remaining work against capacity; show the gap concretely. Classify scope with **MoSCoW**.
- **Communicate:** "At current velocity we ship the Musts (a coherent, usable slice) on the date, with Shoulds as a fast-follow the week after — or we slip the whole thing two weeks. I recommend the slice. Which do you want?" Bring the options, recommend one, let the PM decide.
- **Root-cause fix:** Ship the vertical slice of Musts; queue the rest, ranked.
- **Prevention:** Surface the risk *the moment* it's visible, not at the deadline; track a burn-up so scope-vs-capacity drift is visible to everyone weekly; resist taking on Shoulds as Musts during planning.

---

### S3. Design hands over a flow that's expensive to build

**Situation:** The designer's mock requires real-time cross-entity aggregation on every keystroke — beautiful, but a performance and effort nightmare.

- **Approach:** Collaborate on the *intent*, not just reject the artifact. Designers optimize UX; you bring the cost dimension.
- **Diagnose:** Identify exactly what's expensive (the per-keystroke aggregation), estimate its cost/risk, and find the underlying user need the design serves (instant feedback).
- **Communicate:** Lead with impact and options: "Live aggregation per keystroke adds ~2 weeks and a latency risk at scale. We can get 90% of the feel with debounced search + cached results, or a slightly different interaction that's much cheaper. Here are the tradeoffs — let's pick together." Avoid jargon; bring alternatives, not a flat no.
- **Root-cause fix:** Co-design a version that meets the UX intent within technical constraints (debounce, precompute, progressive loading).
- **Prevention:** Get engineering into design reviews *early*, before mocks are finalized, so constraints shape the design instead of breaking it late.

---

### S4. Blocked by another team's API that keeps changing

**Situation:** Your feature depends on Team B's service; their endpoint shape keeps shifting and your integration breaks repeatedly.

- **Approach:** Stabilize the interface and decouple your timeline from their churn.
- **Diagnose:** Pin down what's unstable and why (no versioning? no contract?). Quantify the cost (rework, slipped dates) to make the case.
- **Communicate:** Propose to Team B a **versioned, documented contract** and agree on it; clarify **RACI** (who owns the contract, who's consulted on changes). "We've reworked our integration three times; can we lock a v1 contract with deprecation notice for changes? I'll build against a mock of it meanwhile."
- **Root-cause fix:** Build against a **mock/anti-corruption layer** based on the agreed contract so their internal churn no longer breaks you; integrate against the real service once stable.
- **Prevention:** Agree contracts up front for any cross-team dependency; require versioning + deprecation policy; use consumer-driven contract tests to catch breaking changes before they ship.

---

### S5. A decision you argued against gets made — now what?

**Situation:** You pushed for approach A with data; leadership chose approach B. The team is watching how you react.

- **Approach:** Disagree-and-commit. The decision is made by the accountable owner; your job now is to make B succeed.
- **Diagnose:** Separate "I dislike this" from "this is a genuine risk." If it's a preference, fully commit. If it's a real safety/data/legal risk, that's a different, harder escalation (in writing).
- **Communicate:** "I made my case for A; we're going with B and I'm fully on board — here's how I'll make it work." Don't re-litigate in standups or undermine it; model good followership for juniors.
- **Root-cause fix:** Execute B well; instrument it so the eventual outcome is measurable and the decision can be revisited on *evidence* if it underperforms.
- **Prevention:** Front-load disagreement into the decision process (RFC review) so concerns are heard *before* the call; capture the decision and rationale in an ADR so it's revisitable with data, not re-argued from opinion.

---

### S6. Sales promised a customer a feature you didn't know about

**Situation:** A sales rep committed a feature to close a deal; the customer now expects it next month and engineering first hears of it from the account manager.

- **Approach:** Don't react emotionally to the process failure; assess feasibility and broker a realistic plan.
- **Diagnose:** Clarify what was actually promised vs. what the customer needs (often narrower). Estimate the real scope and a minimal version that satisfies the commitment.
- **Communicate:** To sales/PM: "Here's what was promised, here's the cheapest version that honors it, here's the timeline and what it displaces. I recommend we deliver the minimal version by the date and the rest as fast-follow." Be solution-oriented, not blame-oriented.
- **Root-cause fix:** Ship the minimal scoped version that meets the customer's actual job; renegotiate the rest.
- **Prevention:** Establish a path for sales/CS to validate commitments with product/eng *before* promising; a public roadmap and a "commit-able vs. not" list reduce surprise commitments.

---

### S7. Stakeholders keep relitigating a settled architecture decision

**Situation:** Every few weeks someone reopens "should we have used X instead?", stalling progress.

- **Approach:** Anchor the team on the recorded decision and the bar for reopening it.
- **Diagnose:** Is new *evidence* driving the reopen, or just discomfort/recency bias? Only new evidence justifies revisiting.
- **Communicate:** Point to the **ADR** capturing the decision, context, and tradeoffs: "We chose X for these reasons; the tradeoffs were known. If there's new evidence that changes the calculus, let's evaluate it — otherwise we're committed and shipping." This respects past alignment without being rigid.
- **Root-cause fix:** If genuine new evidence exists, evaluate it properly (maybe a spike) and either reaffirm or change with a new ADR. If not, close the loop and move on.
- **Prevention:** Record significant decisions as ADRs *when made*, with the rationale and alternatives considered, so they don't get re-argued from scratch; set a norm that decisions reopen only on new evidence.
