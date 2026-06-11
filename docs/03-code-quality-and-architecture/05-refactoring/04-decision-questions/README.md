# Refactoring & Tech Debt — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Safe refactor, legacy code, tech debt management.

Each prompt frames a real tradeoff. Give a recommendation and state **what would change the answer**.

---

### D1. Big-bang rewrite vs Strangler Fig vs in-place refactor for a critical aging service

**Options:** (A) Rewrite from scratch in parallel, then cut over. (B) Strangler Fig — incrementally route slices to a new implementation behind a facade. (C) Refactor in place under tests.

**Recommendation:** Default to **C** if the architecture is fundamentally sound (the problem is messy internals) — it's the lowest risk and keeps delivering. Choose **B (Strangler Fig)** if the technology/architecture must genuinely change (old framework, wrong data model) but the system is too critical to stop: migrate slice by slice, reversible per slice. Avoid **A** except in rare cases — big-bang rewrites discard accumulated edge-case knowledge and deliver zero value for months.

**What would change the answer:** A rewrite (A) becomes defensible only when the system is small, the old code is genuinely unmaintainable/unsafe to touch, *and* you can keep the old one running during the build. If the change is purely internal cleanup, never rewrite — refactor (C).

---

### D2. Refactor-first vs feature-first when the area you must change is messy

**Options:** (A) Refactor the area first (separate commit), then add the feature on a clean base. (B) Add the feature into the mess now, refactor "later." (C) Interleave both in one change.

**Recommendation:** **A** — Kent Beck's "make the change easy, then make the easy change." Refactor under tests in its own commit so the diff is verifiably behavior-preserving, then implement the feature cleanly. Never **C** (mixing hats makes failures un-isolable and reviews unreadable). **B** almost always means "never," and the mess compounds.

**What would change the answer:** Under a hard deadline where the refactor is large and not strictly required, do the minimal feature with a clearly-recorded debt ticket (a *prudent-deliberate* choice) and schedule the cleanup. If there are no tests and no time to add characterization tests, refactoring blind is reckless — defer it.

---

### D3. Pay down high-churn ugly code vs cold ugly code first

**Options:** (A) The frequently-edited, complex module. (B) The equally-ugly but rarely-touched module. (C) Whatever is loudest in code review.

**Recommendation:** **A.** Debt charges *interest* only when you touch the code; the cost proxy is **churn × complexity.** High-churn complex code taxes every feature and breeds incidents — that's where paydown buys the most velocity and risk reduction. Cold code (B), however ugly, charges near-zero interest; leave it. Decide with data (git churn, complexity, defect density), not with whoever complains most (C).

**What would change the answer:** If the "cold" module is a security/payment/compliance hotspot, its *risk* interest is high even at low churn — bump its priority. If a strategic initiative is blocked by a specific module, that module jumps the queue regardless of churn.

---

### D4. Dedicated "tech-debt sprint/quarter" vs continuous Boy-Scout-rule paydown vs fixed capacity budget

**Options:** (A) Periodically freeze features for a debt sprint. (B) Continuously improve code you already touch (Boy Scout rule). (C) Reserve a fixed slice (~10–20%) of every cycle for debt.

**Recommendation:** **B + C.** Continuous opportunistic cleanup keeps high-churn code healthy with no scheduling overhead, and a small recurring budget funds the larger paydowns that don't fit opportunistically. This is sustainable and keeps feature flow intact. Avoid **A** as the primary mechanism — debt freezes are hard to sell, often slip, and debt re-accumulates immediately after.

**What would change the answer:** A *targeted* time-boxed effort (a form of A) is justified for a specific, scoped initiative — e.g. "two weeks to migrate off the deprecated auth library" — because it's a discrete project, not an open-ended "clean everything."

---

### D5. Automated IDE refactor vs manual hand-editing for a large rename/extract

**Options:** (A) Use the IDE's safe automated refactoring (Rename, Extract Method, Move). (B) Hand-edit with find-and-replace.

**Recommendation:** **A** wherever the tool supports it. Automated refactorings are semantics-aware — Rename updates only the right symbol (not string matches), Extract Method preserves behavior mechanically — so they're far less error-prone than manual edits across many files. Manual find-and-replace risks clobbering unrelated matches and shadowed scopes.

**What would change the answer:** If the language/tooling lacks reliable automated refactoring, or the change is too semantic for the tool, hand-edit — but do it in tiny, reviewed steps with tests green after each, and lean on the type checker.

---

### D6. Stop and add tests first vs refactor carefully without tests on legacy code

**Options:** (A) Invest in characterization tests, then refactor. (B) Refactor cautiously without tests, relying on manual checking. (C) Don't refactor; just sprout new code beside the mess.

**Recommendation:** **A** is the right default — characterization tests pin current behavior and make the refactor safe; without them, "careful" refactoring is hoping. If you truly can't justify the test investment right now, **C** (sprout method/class) lets you add new behavior in a tested unit *without* touching the untested mess, deferring the bigger refactor. Avoid **B**.

**What would change the answer:** If the legacy code is so entangled that even getting it under test requires risky changes, break minimal **seams** first (inject one dependency) to enable a single characterization test, then proceed. If the module is slated for deletion soon, don't invest at all — sprout (C) or work around it.

---

### D7. Accept prudent tech debt to hit a launch vs slip the date to do it right

**Options:** (A) Ship with recorded, prudent-deliberate debt and a payback plan. (B) Slip the launch to build it cleanly. (C) Ship reckless debt with no plan.

**Recommendation:** Usually **A** when the deadline carries real business value and the debt is contained, reversible, and *documented* with a payback ticket — that's legitimate engineering (Fowler's prudent-deliberate quadrant). Never **C**: undocumented reckless debt compounds invisibly. Choose **B** only when the debt would land in a high-risk area (security, data integrity, payments) where the interest/risk is unacceptable.

**What would change the answer:** If the corner-cutting touches data correctness, auth, or money, the risk outweighs the schedule — slip (B) or de-scope. If the "debt" is actually a one-way door that's expensive to reverse later, treat it like an architecture decision and don't take it lightly just to hit a date.
