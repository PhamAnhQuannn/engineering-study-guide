# Tech Debt Calls — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: When to pay debt, when to defer.

Each prompt is a real "pay it / defer it / how" decision. Give the reasoned recommendation, then **what would change the answer**. The through-line: decide by *interest rate and blast radius*, not aesthetics; pay incrementally; justify in business terms.

---

### D1. Pay down debt now vs. defer for feature work

**Context:** A module is messy. Do you clean it this quarter or keep shipping features?

- **A — Clean it now.**
- **B — Defer indefinitely.**
- **C — Defer unless it's high-interest (hot path / blocking / risky).**

**Recommendation:** **C.** "Messy" alone isn't a reason — *interest* is. If the module changes constantly, causes recurring bugs, or blocks a roadmap item, pay it (and justify with the velocity/bug data). If it's stable and rarely touched, defer; the interest is near zero.

**What would change the answer:** A looming forced change (a migration, a dependency EOL, a new feature that must build on it) raises the interest and pulls toward "now."

---

### D2. Incremental refactor vs. big-bang rewrite

**Context:** A core service is widely considered "beyond saving."

- **A — Full rewrite from scratch.**
- **B — Incremental refactor / strangler fig.**
- **C — Wrap and isolate it, replace later.**

**Recommendation:** **B (with C as the on-ramp).** Big-bang rewrites are the highest-risk move in software: a long period delivering no new value, high chance of overrun, and they frequently re-create the same debt because the original complexity was essential, not accidental. Strangler-fig it — route slices through a new implementation behind the old interface, compare, then retire the legacy.

**What would change the answer:** A rewrite is justified only when the platform is truly dead (EOL language/runtime with no migration path, or a fundamentally wrong datastore) *and* the system is small enough to rebuild quickly. Even then, prefer migrating incrementally if at all possible.

---

### D3. Fix the debt vs. isolate it

**Context:** A gnarly legacy component works but is dangerous to touch. You rarely need to change it.

- **A — Refactor it properly now.**
- **B — Wrap it behind a clean interface and leave the internals alone.**

**Recommendation:** **B.** If it works and you rarely touch it, the interest is low — spending principal to make it pretty is poor ROI. Wrapping it behind a clean boundary stops the rot from spreading to new code and lets you replace it later if the calculus changes. This is "declaring bankruptcy" on the internals, deliberately.

**What would change the answer:** If you're about to need frequent changes inside it, or it's a correctness/security risk, the interest jumps and A becomes worth it (under characterization tests).

---

### D4. Dedicated debt sprint vs. steady allocation

**Context:** Debt is dragging the team. How do you structure paying it down?

- **A — Dedicate a full "debt sprint."**
- **B — Reserve ~20% of every sprint for debt.**
- **C — Only fix debt when it blocks a feature.**

**Recommendation:** **B.** A steady allocation targeted at the highest-interest hotspots is sustainable and survives feature pressure. Debt sprints are the first thing cancelled when a deadline looms, so the work never happens. C (opportunistic only) lets architectural debt that *isn't* directly blocking anything quietly compound.

**What would change the answer:** A specific, large piece of debt blocking a committed roadmap item may justify a focused, time-boxed effort (closer to A) — but justified by that concrete blocker, not "the codebase is messy."

---

### D5. Upgrade an aging dependency now vs. later

**Context:** A core library is several major versions behind. The upgrade is painful but nothing's broken yet.

- **A — Upgrade now, proactively.**
- **B — Wait until you're forced (a CVE, an incompatibility, EOL).**
- **C — Upgrade incrementally, one major version at a time.**

**Recommendation:** **C, starting now.** Dependency debt accrues *security* interest and gets exponentially harder the further behind you fall — and "forced" upgrades happen on the worst possible day (mid-incident, under a CVE deadline). Step through majors incrementally with tests at each step. Staying current is cheaper than a heroic catch-up.

**What would change the answer:** If the library is on a stable, rarely-changing, low-exposure path *and* still receives security patches, you can defer (B) — but track its EOL date so "later" doesn't become "never."

---

### D6. Add the feature on the bad abstraction vs. fix the abstraction first

**Context:** The clean way to add your feature requires fixing a wrong abstraction first.

- **A — Add the feature onto the existing (wrong) abstraction.**
- **B — Fix the abstraction first, then add the feature.**
- **C — Make a small, targeted refactor that makes your change clean, then add it.**

**Recommendation:** **C** ("make the change easy, then make the change"). A full abstraction overhaul on a deadline is risky; piling onto a wrong abstraction deepens the debt and makes the *next* change worse. The targeted refactor — just enough to land your change cleanly, under test — is the balanced call.

**What would change the answer:** If the abstraction is wrong in a way that will bite every upcoming feature (it's on the critical path of the roadmap), invest more (toward B) now, because the interest is about to spike.

---

### D7. Track debt formally vs. keep it informal

**Context:** The team "knows" where the debt is but doesn't track it anywhere.

- **A — Maintain a formal debt register with principal + interest estimates.**
- **B — Keep it tribal; everyone knows the bad spots.**

**Recommendation:** **A.** Untracked debt is invisible to planning and to leadership, so it never gets prioritized or funded — and it walks out the door when people leave (bus factor). A register with each item's *interest* (what it slows/risks) lets you rank objectively and make the funding case. Tribal knowledge doesn't scale and isn't fundable.

**What would change the answer:** For a tiny, stable team with a small codebase, heavyweight tracking may be overkill — a lightweight tag-and-ticket habit is enough. The principle (make it visible) still holds; only the ceremony scales down.

---

### D8. Refactor with tests vs. refactor fast without them

**Context:** You need to refactor legacy code that has no test coverage.

- **A — Write characterization tests first, then refactor.**
- **B — Refactor carefully by hand without tests to save time.**

**Recommendation:** **A.** Refactoring untested legacy without a safety net is how cleanup *introduces* bugs and discredits all future debt work. Pin the current behavior with characterization tests first — they catch any behavior change your refactor accidentally makes. The upfront test cost is cheap insurance against a self-inflicted incident.

**What would change the answer:** For a tiny, mechanical, tool-assisted refactor (e.g., an IDE-verified rename) the risk is negligible and tests-first is overkill. The bigger and more behavioral the change, the more non-negotiable the tests become.
