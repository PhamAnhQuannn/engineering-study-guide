# Ship-Now vs Do-Right — Real-World Situations

[← Topic overview](../README.md)

> Topic: Deadline pressure, quality tradeoffs.

On-the-job scenarios where speed and quality collide. For each: **model the approach (frame the tradeoff) → de-risk with data/mechanism → communicate the decision → do-it-right on the dangerous part → prevention so the shortcut doesn't become permanent.** The senior move is making the trade deliberate and visible, not heroically absorbing it.

---

### S1. Launch is in 4 days and the feature is 80% done

**Scenario:** Marketing committed a launch date. The feature works but lacks edge-case handling, has thin tests, and one rough manual ops step.

- **Frame the tradeoff:** Separate the *negotiable* (UI polish, exhaustive edge cases, internal code cleanliness) from the *non-negotiable* (correctness on the core path, no data loss, security). Reframe from "ship vs slip" to "what's the smallest correct slice we can ship on the date?"
- **De-risk with a mechanism:** Ship behind a feature flag to a small percentage / internal users first, ramp over launch week. This buys the date and bounds blast radius with a kill switch.
- **Communicate:** Tell the PM exactly what's in and out: "Core flow ships and is tested; rare edge case X shows a graceful 'try again' instead of full handling; the ops step is manual with a runbook for week one." Get explicit agreement.
- **Do-it-right on the dangerous part:** Make sure the core write path is correct, idempotent, and observable before launch — that part is non-negotiable.
- **Prevention:** File tickets with owners/dates for the deferred edge cases and the ops automation; add them to the post-launch sprint so "temporary" doesn't become permanent.

---

### S2. The "temporary" hack that's still in prod two years later

**Scenario:** You discover a critical billing flow runs on a hardcoded "temporary" script someone wrote under deadline pressure long ago. It's fragile and only one person understands it.

- **Frame:** This is accidental debt that turned permanent — a single-person dependency on a money path. Interest is high (bus factor + billing risk), so it's worth paying down, but not via a risky big-bang rewrite.
- **De-risk with data:** Quantify the risk — how often does it run, what breaks if it fails, what's the revenue exposure. Add tests/characterization around current behavior *before* touching it.
- **Communicate:** Make the risk visible to leadership in business terms ("our billing depends on an undocumented script only Alice understands") so the cleanup gets funded.
- **Do-it-right:** Strangler-fig the replacement — wrap it, route a slice through the new implementation, compare outputs, then cut over.
- **Prevention:** A standing policy that any "temporary" shortcut requires a ticket with an expiry date; periodic debt review so temporary hacks surface before they calcify.

---

### S3. PM pushes a deadline you think forces unsafe corners

**Scenario:** A PM wants a feature touching user PII shipped in a week; doing it safely (proper access controls, audit logging, encryption) takes longer.

- **Frame:** Security/PII handling is a non-negotiable and often a one-way door (a leak is irreversible and may have legal consequences). The deadline can't buy out correctness here.
- **De-risk:** Identify the minimum safe version — maybe ship to internal users only first, or ship a narrower scope that touches less PII.
- **Communicate:** Present the scope/time/quality triangle with data: "I can hit the date if we cut PII fields X and Y from v1; full handling needs N more days. Shipping the full set unsafely risks a breach and possibly a compliance violation." Make it a shared, informed decision — don't quietly comply or quietly cut.
- **Do-it-right:** Whatever PII *does* ship gets proper access control, encryption, and audit logging — no exceptions.
- **Prevention:** Add a security/privacy review gate for any feature touching PII so this conversation happens *before* a deadline is committed, not after.

---

### S4. Over-engineering caught in review (the other failure mode)

**Scenario:** A teammate (or you) built an elaborate plugin framework with config-driven everything for a single, simple use case, citing "doing it right." The deadline is now at risk.

- **Frame:** "Do it right" got confused with "do everything." This is speculative generality / YAGNI — gold-plating that adds cost and risk with no current payoff. The right call here is *less* engineering, not more.
- **De-risk:** Propose the simple version that solves the actual requirement; show that the framework's flexibility isn't backed by any real second use case.
- **Communicate:** Frame it kindly — "this is solid engineering, but we only have one case; let's ship the simple version and extract the abstraction when a real second case shows up (Rule of Three)." Avoid making it about the person.
- **Do-it-right:** The "right" thing here is the simplest correct solution that meets the requirement and is easy to change later.
- **Prevention:** Lightweight design review for net-new abstractions; a team norm of "what's the simplest thing that could work?" before building frameworks.

---

### S5. Velocity is collapsing under accumulated debt

**Scenario:** Every feature now takes 3x longer because a core module is a tangle. Leadership keeps pushing features and won't fund a cleanup.

- **Frame:** This is debt whose interest now exceeds the principal — it's taxing every story. But a "stop everything and refactor" sprint won't get approved and is risky.
- **De-risk with data:** Measure it — cycle time, bug rate, and time-in-the-tangled-module per story — to prove the debt is the bottleneck, not a feeling.
- **Communicate:** Translate to business language: "We're paying ~30% velocity tax on this module; N days of cleanup pays back in ~M weeks." Tie the ask to a roadmap item it's blocking.
- **Do-it-right:** Pay it down incrementally — allocate a steady fraction of each sprint (e.g., 20%) to the highest-interest hotspots, refactoring under test as you touch them (boy-scout rule), rather than a big-bang rewrite.
- **Prevention:** Make the debt allocation a standing budget; track a debt/velocity metric so it stays funded; enforce the boy-scout rule in review.

---

### S6. A demo for a major customer needs something flashy by tomorrow

**Scenario:** Sales needs a working demo of a feature for a big prospect tomorrow; building the real thing takes weeks.

- **Frame:** A demo is a *throwaway* context — the reversible/non-production lane. Here, fast is genuinely right; building production-grade for a demo is the gold-plating mistake. But be clear it's a prototype, not a foundation.
- **De-risk:** Build a clearly-labeled prototype (mocked data, happy-path only, behind a demo flag) — explicitly *not* on the production code path so it can't leak into real systems.
- **Communicate:** Set expectations crisply with sales/leadership: "This is a demo prototype, not shippable; the real build is N weeks. We must not promise the prospect it's production-ready." The risk is a demo becoming an implied commitment.
- **Do-it-right:** When/if it becomes a real feature, build it properly from scratch — do **not** promote the demo hack to production.
- **Prevention:** A clear "prototype vs production" boundary and naming convention; a norm that demos never become prod code without a real build; capture what the demo taught you into the real requirements.
