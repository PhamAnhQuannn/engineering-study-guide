# Product Thinking — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: User value, prioritization by impact, MVP.

Each prompt presents named options. State a reasoned recommendation, then "what would change the answer." There is rarely one right choice — the senior signal is *how you reason*.

---

### D1. Ship a thin MVP next week vs. a polished v1 in two months.

**Options**
- **A — Thin MVP now:** vertical slice, instrument it, learn fast.
- **B — Polished v1 in 2 months:** full feature set, production-hardened.
- **C — RAT first:** no-code/concierge test this week, then decide.

**Recommendation:** If the *demand is unproven*, choose **C then A**. Validate the riskiest assumption cheaply; if it holds, ship the thin MVP to learn with real usage. Pour the two months into polish only after validation.

**What would change the answer:** If demand is already proven (existing users actively asking, contractual commitment) and the risk is *execution/scale* not *desirability*, B becomes defensible — a half-baked launch to known-eager users can burn trust. Also, regulated/safety-critical domains (payments, health) raise the quality floor so "thin" still must be correct.

---

### D2. Build the feature in-house vs. buy a SaaS vs. integrate open source.

**Options**
- **A — Build:** full control, fits exactly.
- **B — Buy (SaaS):** fast, vendor maintains it, recurring cost + lock-in.
- **C — Open source / integrate:** no licence cost, you own ops + patches.

**Recommendation:** Decide by **is this core differentiation?** If yes → **A** (you should own your moat). If it's table stakes (auth, email, payments, search infra) → **B**, because vendor cost is almost always less than building + maintaining + on-call for a commodity. **C** fits when you need control and customization but the wheel is already invented and the project is healthy.

**What would change the answer:** Scale economics (at huge volume, SaaS per-unit cost can exceed a built solution), data-residency/compliance constraints that vendors can't meet, vendor viability risk, or a strategic need to avoid lock-in. Always price in **exit cost**, not just entry cost.

---

### D3. Optimize for a vocal enterprise customer's request vs. the broad self-serve base.

**Options**
- **A — Build the enterprise ask** (large contract, narrow use case).
- **B — Build for the broad base** (many users, smaller individual revenue).
- **C — Generalize the enterprise ask** so it also serves the base.

**Recommendation:** Prefer **C** when feasible — reframe the specific request into the underlying job and solve it for the median user too, capturing the contract *and* broad value. If the ask is irreducibly bespoke, weigh **revenue concentration vs. reach**: one whale that's 30% of revenue may justify A; a long tail of churned self-serve users may make B the bigger lever.

**What would change the answer:** Strategic account importance, whether the request fragments the product (maintenance drag on every future change), and whether saying yes sets a precedent that turns your roadmap into a custom-dev shop.

---

### D4. Instrument-then-ship vs. ship-then-instrument.

**Options**
- **A — Add analytics/events before launch.**
- **B — Ship now, add tracking next iteration.**

**Recommendation:** **A**, almost always for anything you intend to evaluate. If you can't measure whether it worked, you've launched blind and will argue from anecdotes. Defining the success metric and wiring the events is part of "done."

**What would change the answer:** A genuine emergency hotfix or a truly throwaway experiment with a binary, externally-observable outcome (e.g., "does the build pass") may not need instrumentation. But "we'll add it later" usually means never.

---

### D5. One deep, great feature vs. three shallow ones this quarter.

**Options**
- **A — Depth:** make one thing genuinely excellent.
- **B — Breadth:** ship three "good enough" features.

**Recommendation:** Use the **Kano model**. Invest **depth (A)** on differentiators/delighters — the reasons users choose and stay. Spend only enough on table-stakes to clear the bar; there, **breadth (B)** of "present and adequate" beats polishing a basic. Map each candidate to basic/performance/delight before deciding.

**What would change the answer:** Competitive context (if rivals have a feature you lack entirely, closing the gap — breadth — may matter more than perfecting an existing strength), and stage (early products often need depth to earn a beachhead; mature ones broaden).

---

### D6. Cut scope by removing a feature vs. shipping all features at lower quality.

**Options**
- **A — Fewer features, full quality** (drop scope).
- **B — All features, reduced quality** (drop polish/robustness).

**Recommendation:** Strongly prefer **A**. A smaller set done well delivers a coherent, trustworthy experience; "all features at half quality" usually means *nothing* works convincingly and erodes trust uniformly. Cut along feature boundaries, keep each shipped slice solid.

**What would change the answer:** If the features are deeply interdependent so that any subset is unusable, you may be forced toward B — but that's a signal to renegotiate the deadline. Demo-only contexts (sales POC) sometimes legitimately favor breadth-over-depth.

---

### D7. Follow the existing spec exactly vs. propose a cheaper alternative you believe is better.

**Options**
- **A — Build to spec** as written.
- **B — Build your alternative** without asking.
- **C — Raise it: clarify the goal, show data, propose the alternative, let the owner decide.**

**Recommendation:** **C.** Surface your concern with evidence (funnel data, effort comparison, a small spike), propose the alternative concretely, and respect the decision owner with disagree-and-commit if overruled. This preserves both your judgment and the team's trust.

**What would change the answer:** Time pressure can compress this to a one-line async note rather than a meeting, but the principle stands. If you have *no* evidence, gather a little before raising it — opinion vs. spec rarely wins; data vs. spec often does.

---

### D8. Kill an underperforming feature vs. keep iterating on it.

**Options**
- **A — Deprecate/remove it.**
- **B — Keep investing** to turn it around.
- **C — Freeze it:** stop investment, leave it running.

**Recommendation:** Check against the **kill criteria you (hopefully) set up front** and ignore sunk cost. If usage/impact is far below threshold after a fair trial and there's no credible hypothesis for why more iteration changes that → **A** (or **C** if removal cost/risk is high and it's harmlessly idle). Reserve **B** for cases with a *specific, testable* reason the next iteration is different.

**What would change the answer:** A small but strategically critical user segment depending on it, evidence the original launch was botched (so it never got a fair test), or low maintenance cost making "freeze" cheaper than the churn of removal.
