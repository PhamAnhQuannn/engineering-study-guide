# Problem Decomposition — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Break epics into shippable slices, scoping, estimation.

Each prompt frames options for *how to decompose, sequence, or scope*. Recommendation + "what would change the answer."

---

### D1. First slice: walking skeleton (thin end-to-end, trivial case) vs the highest-value feature fully built?

**Recommendation: Walking skeleton.** Prove the architecture integrates end to end before investing in any single feature's depth. The skeleton de-risks deploy, auth, and data flow so every later slice is an increment, not an integration gamble. The highest-value feature, built before the pipes are proven, risks discovering integration problems after major investment.

**What would change the answer:** if the architecture is already proven (extending a mature system), skip the skeleton and slice by value directly.

---

### D2. Sequence slices risk-first vs value-first?

**Recommendation: Risk-first when uncertainty is high; value-first when execution risk is low.** New, ambiguous projects should attack the project-killing unknown early. A well-understood project with low technical risk should sequence by value to start returning ROI sooner.

**What would change the answer:** a hard external demo/deadline may force an early visible-value slice even if it's not the riskiest; a research-heavy project should be almost entirely risk-first.

---

### D3. Up-front detailed design vs emergent design through slices?

**Recommendation: Design the skeleton, interfaces, and risky boundaries up front; let the rest emerge.** Big-design-up-front ignores what you'll learn from real slices and ages badly; zero design risks slices that don't compose. The senior move is designing exactly the load-bearing decisions (data model spine, key interfaces, the irreversible bits) and deferring reversible details.

**What would change the answer:** regulated/safety-critical domains warrant more up-front design; throwaway prototypes warrant almost none.

---

### D4. Estimate in story points (relative) vs hours/days (absolute)?

**Recommendation: Relative sizing for planning, with ranges.** Humans estimate relative complexity better than absolute time, and points decouple the estimate from individual speed. Translate to a date range via team velocity. Use absolute time only when committing to an external date, and always as a range reflecting the cone of uncertainty.

**What would change the answer:** stakeholders who only understand dates need the translation done for them; a solo, well-understood task can be estimated directly in hours.

---

### D5. Thin slices with frequent ships vs larger batches with less overhead?

**Recommendation: Thin slices** for anything risky or novel — the feedback and reduced integration risk outweigh per-slice ceremony. For low-risk, well-trodden work, slightly larger batches reduce overhead. Calibrate slice size to *risk and feedback need*, not habit.

**What would change the answer:** heavyweight release/QA process per ship (push toward larger batches but fix the process); or high uncertainty (push toward the thinnest possible slices).

---

### D6. Build a shared foundation first vs build independent slices that may duplicate work?

**Recommendation: Independent slices first; extract the shared foundation once the pattern is real.** Premature shared foundations create coupling and sequencing dependencies before you know the right abstraction. A little duplication across the first 2–3 slices is cheaper than the wrong abstraction. Refactor to shared once the repetition is concrete (rule of three).

**What would change the answer:** an obvious, stable shared primitive (auth, logging) that every slice needs from day one — build that once up front.

---

### D7. Spike the unknown first vs start building and learn as you go?

**Recommendation: Spike when the unknown is a feasibility/architecture question whose answer reverses the plan.** A timeboxed throwaway spike is cheap insurance against building on a false assumption. Just-start-building is fine when the uncertainty is in details that won't change the overall approach.

**What would change the answer:** if a spike can't realistically resolve the unknown (it needs production scale/data), prefer a thin reversible production slice behind a flag instead.

---

### D8. When the deadline won't fit, cut scope vs cut quality vs extend the deadline?

**Recommendation: Cut scope.** Defer must-have-laters, ship a coherent minimum. Cutting quality/correctness just moves cost into the future with interest (bugs, incidents, rework). Extending the deadline is a real option but usually a last resort and a leadership decision — surface it early with data, never silently.

**What would change the answer:** a regulatory/contractual fixed scope where the date is the only lever (then extend or add people, with eyes open on Brooks's Law); or genuine non-essential quality (polish, edge cases) that's legitimately "later," not "skipped."
