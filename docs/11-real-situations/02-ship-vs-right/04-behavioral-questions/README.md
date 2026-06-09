# Ship-Now vs Do-Right — Behavioral (STAR) Questions

[← Topic overview](../README.md)

> Topic: Deadline pressure, quality tradeoffs.

Senior STAR prompts about deadline-vs-quality judgment. "What good looks like" lists the scored signals; the sample answers are concise models. The recurring signal: you made the tradeoff *deliberate and transparent*, protected non-negotiables, and either paid the debt back or had a plan to.

---

### B1. Tell me about a time you shipped something you knew wasn't perfect to hit a deadline.

**What good looks like:** A *deliberate*, documented tradeoff; you protected the non-negotiables (correctness/security) and cut only the reversible parts; you had a payback plan.

**Sample answer:**
- **S:** We had a contractually-committed launch in a week; the feature was functional but lacked exhaustive edge-case handling and an automated ops step.
- **T:** Hit the date without shipping something dangerous.
- **A:** I separated negotiable from non-negotiable. I made sure the core write path was correct, idempotent, and monitored — that was non-negotiable. I deferred rare edge cases (graceful "try again" instead of full handling) and ran the ops step manually with a runbook for week one. I shipped behind a flag, ramping over launch week. I documented each shortcut as a ticket with an owner and date.
- **R:** We hit the date with zero correctness incidents. All three deferred tickets were closed in the next sprint, so the "temporary" parts didn't become permanent.

---

### B2. Describe a time you pushed back on a deadline.

**What good looks like:** You renegotiated openly using the scope/time/quality triangle and data, rather than quietly crunching or quietly cutting corners.

**Sample answer:**
- **S:** A PM committed a date that, to me, forced cutting corners on a flow handling user PII.
- **T:** Protect data safety without just saying "no."
- **A:** I laid out the triangle with specifics: "At this date I can ship safely if we drop PII fields X and Y from v1; the full set needs N more days; shipping it all unsafely risks a breach." I gave the PM the choice rather than absorbing it silently.
- **R:** We shipped the narrower, safe scope on the original date and added the rest two weeks later. The PM later told me they valued getting a real decision instead of a surprise. We also added a privacy review gate before dates get committed.

---

### B3. Tell me about a time you over-engineered something.

**What good looks like:** Self-awareness that "do it right" can become gold-plating; a lesson about YAGNI / simplicity.

**Sample answer:**
- **S:** Early on, I built a config-driven, plugin-based framework for what turned out to be a single integration.
- **T:** Deliver the integration.
- **A:** I'd justified the complexity as "doing it right and future-proofing," but it slowed the delivery and added bugs, and the imagined second use case never came. A reviewer pushed me toward the simple version. I cut the framework and shipped a straightforward implementation.
- **R:** It shipped faster and had fewer bugs. The lesson — build the simplest thing that works and extract abstractions only on the third real case — has saved me from that trap many times since.

---

### B4. Describe a time a "temporary" solution caused problems later.

**What good looks like:** Honesty about how temporary becomes permanent; the systemic fix (tickets, expiry, visibility).

**Sample answer:**
- **S:** Under deadline I shipped a hardcoded script for a data sync, meaning to replace it "soon." It quietly became load-bearing.
- **T:** It later started failing silently and caused a data drift.
- **A:** I owned it, fixed the immediate drift, then replaced the script properly using a strangler approach with tests. Crucially, I traced *why* it lasted: there was no ticket and no expiry, so it was invisible.
- **R:** We replaced it cleanly, and I introduced a team rule that any "temporary" shortcut requires a ticket with an expiry date and a review. Several other latent hacks surfaced and got cleaned up because of that rule.

---

### B5. Tell me about a time you advocated for paying down technical debt.

**What good looks like:** You used data and business language, targeted the highest-interest debt, and paid it down incrementally rather than demanding a big-bang rewrite.

**Sample answer:**
- **S:** Velocity on a core service had dropped sharply; people dreaded touching one tangled module.
- **T:** Make the case to invest in cleanup against heavy feature pressure.
- **A:** I measured the tax — stories touching that module took ~3x longer and had a higher bug rate. I presented it as "~30% velocity tax, payback in a few weeks," tied to a roadmap item it was blocking. I proposed a 20%-per-sprint allocation on the worst hotspots, refactoring under test, not a big rewrite.
- **R:** Leadership funded it. Within two months, cycle time on that module dropped measurably and the on-call bug rate fell. The incremental approach meant no destabilizing big-bang change.

---

### B6. Describe a situation where you chose quality/correctness over speed and it was the right call.

**What good looks like:** You held the line on a non-negotiable (money/data/security) under pressure and it prevented a serious problem.

**Sample answer:**
- **S:** Under launch pressure, there was a push to skip idempotency on a payment-charge endpoint to save time.
- **T:** Decide whether to take the shortcut.
- **A:** I refused to cut that specific corner — double-charging customers is irreversible and trust-destroying. Instead I cut a secondary, reversible feature from the launch to free up the time, and built the charge path with idempotency keys and proper retry handling.
- **R:** We launched on time minus one minor feature. A few weeks later a client retry storm hit that endpoint — and because of the idempotency keys, zero customers were double-charged. The corner I refused to cut would have been a costly incident.

---

### B7. Tell me about a time you had to make a judgment call between shipping fast and building it right, with incomplete information.

**What good looks like:** A clear decision frame (reversibility, blast radius), comfort with "good enough," and owning the outcome.

**Sample answer:**
- **S:** We needed a feature out quickly but I wasn't sure how it would scale, and we had no time to fully load-test.
- **T:** Decide how much to invest before shipping.
- **A:** I applied a reversibility lens: the data model and API shape were one-way doors, so I took the time to get *those* right; the implementation behind them was a two-way door, so I shipped a simple version and put it behind a flag with good observability so I'd see scaling problems early.
- **R:** It shipped on time. When traffic grew, the metrics flagged a hotspot early and we optimized the internal implementation without touching the API or schema — exactly because we'd done the irreversible parts right and kept the reversible parts simple.
