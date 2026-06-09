# Product Thinking — Practice Questions

[← Topic overview](../README.md)

> Topic: User value, prioritization by impact, MVP.

A mix of recall, "explain to a junior," and multiple-choice. Try to answer before reading the model answer.

---

### Q1. What is the difference between an output, an outcome, and an impact? Why does it matter for a senior engineer?

**Answer:**
- **Output** is what you ship — a feature, endpoint, or screen. **Outcome** is the resulting change in user behavior (e.g., more users finish checkout). **Impact** is the business/mission result (revenue, retention, cost saved).
- It matters because effort is finite and outputs are easy to fake as progress (the "feature factory"). A senior engineer reasons *backward* — start from the impact you want, identify the behavior change (outcome) that produces it, and only then design the output. This keeps engineering effort tied to value and lets you challenge work that produces output with no plausible outcome.

---

### Q2. Explain "MVP" to a junior who thinks it means "a buggy, stripped-down version 1."

**Answer:**
An MVP is the *smallest thing that lets us learn whether our core hypothesis is true.* Its purpose is **validated learning**, not shipping something low-quality. Two corrections:
1. "Minimum" refers to **scope**, not quality. The slice you build should work well enough to actually test the hypothesis — if it's so broken users can't use it, you learn nothing.
2. An MVP is a **vertical slice**: a thin but complete path through the whole value loop (e.g., a user can sign up, do the one core action, and get value). It is *not* a horizontal slice — a database and half a UI with no usable flow. Sometimes the cheapest MVP is no code at all: a landing page or a manually-operated "concierge" backend that fakes the feature to see if anyone wants it.

---

### Q3. Walk through RICE scoring with a concrete example.

**Answer:**
RICE = **(Reach × Impact × Confidence) / Effort**.
Say we're comparing a "guest checkout" feature:
- **Reach** = 8,000 checkout starts/quarter that currently require an account.
- **Impact** = 2 (high — removing a forced signup is a known conversion lever; scale 3/2/1/0.5/0.25).
- **Confidence** = 80% (0.8) — we have funnel data showing drop-off at the account step.
- **Effort** = 2 person-months.
- Score = (8000 × 2 × 0.8) / 2 = **6,400**.
Compute the same for each candidate and rank by score. The value is the *discipline*: it forces explicit, comparable numbers, and the Confidence term punishes bets built on hand-waving.

---

### Q4. A stakeholder asks for "a CSV export button." How do you respond as a senior engineer?

**Answer:**
Don't jump to building a button. First uncover the **job-to-be-done**: *why* do they want the data out? If the answer is "Finance reconciles our numbers against their ledger every month," then a button might be wrong — a scheduled email, a read-only API, or a direct integration could serve the actual need better and with less ongoing toil. Restating the request as a job lets you (a) possibly solve it more cheaply, (b) solve it for more users, and (c) avoid building a feature that technically matches the request but doesn't accomplish the goal.

---

### Q5. You have one sprint and two features that both "must ship." How do you decide order?

**Answer:**
"Must ship" is rarely literally true for both. I'd:
1. Pin down the actual **goal/metric** each feature serves and its **deadline driver** (a contract? a marketing date? or just preference?).
2. Estimate **reach and impact** for each, and **effort/risk**.
3. Plot on **value-vs-effort** or run quick **RICE**; the higher score and/or the harder deadline goes first.
4. Consider **sequencing for learning** — if one de-risks the other or unblocks a dependency, do it first.
5. Surface the tradeoff explicitly to stakeholders ("we can do A fully or A+B half each — here's my recommendation and why") so the call is made with eyes open. Disagree-and-commit if overruled.

---

### Q6. What is the "riskiest assumption test" and how does it differ from building an MVP?

**Answer:**
The **RAT** isolates the single assumption that, if false, kills the whole idea — and tests *only that*, as cheaply as possible, often with no production code. An MVP tests the *whole* value proposition end-to-end. The RAT comes first and is narrower: e.g., before building a marketplace MVP, the riskiest assumption might be "sellers will list inventory" — you can test that with manual outreach and a spreadsheet before writing any marketplace code. RAT-first avoids building an MVP that elaborately validates assumptions that were never in doubt while skipping the one that actually mattered.

---

### Q7. Explain leading vs. lagging indicators and why you'd pick a leading metric before building.

**Answer:**
**Lagging** indicators (revenue, churn) confirm impact but arrive too late to steer by — by the time churn moves, the quarter is gone. **Leading** indicators (activation rate, time-to-value, week-1 feature usage) *predict* the lagging metric and move quickly, so you can course-correct mid-flight. You pick the leading metric *before* building because it defines what "working" looks like and forces you to instrument it from day one, rather than retrofitting analytics after launch and discovering you can't tell whether the feature succeeded.

---

### Q8. When should you choose NOT to build a feature at all?

**Answer:**
When the **opportunity cost** outweighs the value: the feature serves few users (low reach) at high effort, when something else in the backlog has a much higher RICE score, or when it fragments the product to satisfy one loud customer rather than the median user. Also when it's not your differentiation and you can **buy/integrate** it cheaper than building+maintaining it (auth, payments, email). "No" and "not now" are core product-thinking outputs — a senior engineer who can't say no becomes a feature factory.

---

### Q9 (MCQ). Which of the following is the *best* description of a "vertical slice"?

A. The data layer fully built, with the UI to follow in a later sprint.
B. A thin but complete path through every layer that delivers usable value end-to-end.
C. The most technically interesting component, built first.
D. Every feature at 50% completeness.

**Answer: B.** A vertical slice cuts through all layers (UI → API → data) to produce one working, valuable user flow. A and D are horizontal/partial slices that deliver no usable value and don't validate the hypothesis. C optimizes for engineer interest, not user value.

---

### Q10 (MCQ). In RICE, what does the **Confidence** term primarily protect against?

A. Features that affect too few users.
B. Overestimating effort.
C. Acting on reach/impact estimates that are little more than guesses.
D. Features with low business value.

**Answer: C.** Confidence (e.g., 100%/80%/50%) discounts the score when your Reach and Impact numbers are speculative, pushing teams to either gather data or treat the score as tentative. Reach handles A; Effort handles B; Impact handles D.

---

### Q11 (MCQ). According to the Kano model, where should you invest *depth* (high polish/effort)?

A. On basic/expected features (table stakes).
B. On differentiators and delighters that are reasons to choose you.
C. Evenly across all features.
D. Only on features the highest-paid stakeholder requests.

**Answer: B.** Basic needs (A) must merely be present — over-investing in them yields little; their absence hurts but their excellence doesn't delight. Depth pays off on differentiators/delighters. C ignores prioritization; D is the HiPPO anti-pattern.

---

### Q12 (MCQ). A PM hands you a spec you believe won't achieve its stated goal. The best senior response is:

A. Build exactly what's specified; it's the PM's call.
B. Quietly build what you think is right instead.
C. Clarify the underlying goal, bring data/your reasoning, propose an alternative, and disagree-and-commit if overruled.
D. Escalate to the PM's manager immediately.

**Answer: C.** Seniors surface concerns with evidence and propose alternatives, but respect the decision owner (disagree-and-commit). A abdicates judgment; B is insubordinate and erodes trust; D skips the direct, respectful conversation that should come first.

---

### Q13. How do you distinguish a "learning bet" from a "scaling investment," and why does it change your engineering approach?

**Answer:**
A **learning bet** is work whose main purpose is to find out whether something is worth doing — uncertain demand, unproven hypothesis. There, favor speed: thin vertical slice, deliberate (documented) tech debt, easy-to-delete code, heavy instrumentation. A **scaling investment** is work on something already validated and load-bearing — there, favor robustness, performance, and maintainability because it must last. Misclassifying is costly both ways: over-engineering a learning bet wastes effort on something you might delete; under-engineering a scaling investment creates fragility under real load. Naming which one you're in, out loud, is a senior signal.
