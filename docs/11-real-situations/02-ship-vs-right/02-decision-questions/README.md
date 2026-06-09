# Ship-Now vs Do-Right — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Deadline pressure, quality tradeoffs.

Each prompt is a real deadline-pressure fork. Give the reasoned recommendation, then **what would change the answer**. The through-line: ship fast on the reversible, do-it-right on the irreversible and dangerous, and make every shortcut explicit.

---

### D1. Hit the launch date with a known shortcut vs. slip the date

**Context:** A contractually-committed launch is in 3 days. You can make it only by skipping retry/idempotency on a payment write.

- **A — Ship on time with the shortcut.**
- **B — Slip the date to do payments right.**
- **C — Cut scope: launch without the payment feature, add it next week.**

**Recommendation:** **C, then B over A.** Payments is a money path — idempotency/correctness is a **non-negotiable**; double-charging customers is far more expensive than a slipped feature. Cutting that feature out of the launch (C) keeps the date for everything else and does the dangerous part right later. If C isn't possible, slip (B). Never A.

**What would change the answer:** If the "payment" is a $0 trial activation with no charge and is trivially reversible, the corner is cheap — ship it behind a flag and harden fast.

---

### D2. Write tests now vs. ship and backfill tests

**Context:** Deadline is tight. The feature works in manual testing.

- **A — Full test coverage before shipping.**
- **B — Ship now, backfill tests after.**
- **C — Test only the risky/critical paths now, defer the rest.**

**Recommendation:** **C.** Risk-weight your tests: cover the correctness-critical and hard-to-reverse paths (money, data writes, auth) before shipping; defer exhaustive coverage of low-risk branches. A blanket "no tests, ship it" (B) is reckless on critical code; full coverage of trivial getters (A) is gold-plating under deadline.

**What would change the answer:** If the whole feature is low-risk and reversible (an internal admin page behind auth), B is fine. If it touches money/data, push toward A for that surface.

---

### D3. Quick hack vs. proper abstraction

**Context:** You need a one-off integration by Friday. The "right" way is a generic adapter framework; the fast way is a hardcoded script.

- **A — Build the generic framework.**
- **B — Hardcode the one-off now.**
- **C — Hardcode now, extract the abstraction when the second case appears.**

**Recommendation:** **C (Rule of Three).** Don't build a framework for one case — that's speculative generality / YAGNI. Ship the hardcoded version, and extract the abstraction when a real second use case arrives. Building the framework up front (A) usually produces the *wrong* abstraction because you've only seen one example.

**What would change the answer:** If you *know* with high confidence that 5 more integrations are committed this quarter, the abstraction is no longer speculative — build a thin version of it now.

---

### D4. Refactor first vs. add the feature onto messy code

**Context:** The module you must extend is a mess. Refactor first, or pile the feature on and move on?

- **A — Refactor first, then add the feature.**
- **B — Add the feature onto the mess; defer cleanup.**
- **C — Make the change easy (small targeted refactor), then make the easy change.**

**Recommendation:** **C** (Kent Beck's maxim). Don't do a big-bang refactor on a deadline (A is risky and slow), and don't blindly pile on (B compounds the debt on a hot path). Do the *minimal* refactor that makes your change clean, guarded by tests, then add the feature.

**What would change the answer:** If the module is stable and rarely touched, B is acceptable — debt on cold code accrues little interest. If it's a hot, fast-changing core path, lean further toward C/A because the interest compounds.

---

### D5. Ship behind a flag vs. wait for full confidence

**Context:** A risky new feature is "done" but you're not fully confident it's bug-free.

- **A — Hold until you're confident.**
- **B — Ship to 100% now.**
- **C — Ship behind a flag to a canary / internal users, ramp gradually.**

**Recommendation:** **C.** A flagged, gradual rollout collapses the speed-vs-safety dilemma: you ship now (speed, real feedback) with a bounded blast radius and an instant kill switch (safety). This is almost always superior to both "wait" and "big bang."

**What would change the answer:** If the feature can't be partially rolled out (e.g., a one-shot data migration) or flag infrastructure doesn't exist, fall back to a small canary or a maintenance-window rollout with a rollback plan.

---

### D6. Manual ops step now vs. automate it now

**Context:** Launch needs a recurring operational task. Automating it costs 2 days you don't have.

- **A — Automate now.**
- **B — Do it manually for launch; automate later.**
- **C — Manual now, but with a tracked ticket + a runbook so it's safe and visible.**

**Recommendation:** **C.** Manual is an acceptable *intentional* shortcut for launch — as long as it's documented (runbook so anyone can do it safely) and ticketed (so the automation actually gets prioritized). The danger isn't the manual step; it's the *forgotten* manual step that becomes permanent toil and a single-person dependency.

**What would change the answer:** If the manual step is high-frequency (hourly) or error-prone with real blast radius (touches prod data), automate it now (A) — the interest is too high to defer.

---

### D7. Respect the deadline vs. push back on it

**Context:** A PM hands you a deadline you believe is unrealistic without cutting corners you're uncomfortable with.

- **A — Accept it and crunch / cut quality quietly.**
- **B — Push back and renegotiate scope/time/quality openly.**
- **C — Accept it but secretly cut corners to protect yourself.**

**Recommendation:** **B.** Surface the triangle (scope, time, quality — pick two) with data: "At this date, here's what I can deliver at our quality bar; here's what we'd cut. Which do you want?" That's the senior move — making the tradeoff a shared, informed decision. A leads to burnout and bugs; C destroys trust and produces silent debt.

**What would change the answer:** If it's a genuinely immovable hard deadline (regulatory, contractual, a partner's launch), shift the conversation from "move the date" to "which scope do we cut to protect quality" — but still openly, never silently.

---

### D8. Pay down debt this sprint vs. ship the next feature

**Context:** Velocity is dropping because of accumulated debt, but there's strong feature pressure.

- **A — Dedicate the sprint to debt.**
- **B — Keep shipping features; ignore the debt.**
- **C — Allocate a steady fraction (e.g., 20%) of each sprint to debt on the highest-interest areas.**

**Recommendation:** **C.** A continuous small allocation targeted at the *highest-interest* debt (the code that's slowing the most work or causing the most bugs) beats both a one-time debt sprint that gets cut and ignoring debt until velocity craters. Tie the debt work to a business metric (velocity, incident rate) to keep it funded.

**What would change the answer:** If a specific piece of debt is actively blocking a committed roadmap item or causing recurring incidents, escalate it to a dedicated, time-boxed effort (closer to A) — but justified by that concrete blocker, not "the code is ugly."
