# Refactoring & Tech Debt — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Safe refactor, legacy code, tech debt management.

**Refactoring** is changing the *internal structure* of code **without changing its observable behavior**, to make it easier to understand and cheaper to change. **Tech debt** is the implied future cost of choosing an easy-now solution over a better-but-slower one. A senior engineer refactors *continuously and safely* under a test net, and manages debt as an explicit, prioritized backlog — not as a vague "we'll clean up later."

---

## What refactoring is (and isn't)

- **Refactoring (Fowler's definition):** a *behavior-preserving* transformation. If behavior changes, it's not refactoring — it's a rewrite or a feature change. This distinction matters: you must be able to assert "the system does exactly what it did before."
- **Not refactoring:** adding features, fixing bugs (behavior changes), big-bang rewrites. Mixing refactor + feature in one change is a classic mistake — when something breaks you can't tell which caused it.
- **The golden rule:** *separate the two hats.* Either you're adding behavior (tests may go red→green) or refactoring (tests stay green throughout). Never both at once.
- **Prerequisite:** a reliable test net. "Refactoring without tests" is just editing and hoping. For legacy code with no tests, you first add **characterization tests**.

---

## Code smells — symptoms that suggest refactoring

Smells don't *prove* a problem; they're heuristics worth investigating.

| Smell | What it indicates |
|---|---|
| **Long method** | Doing too much; hard to name/test → extract methods |
| **Large class / God object** | Low cohesion, SRP violation → extract class |
| **Long parameter list** | Missing object; control coupling → introduce parameter object |
| **Duplicated code** | Knowledge in many places → extract (if same *knowledge*) |
| **Feature envy** | A method uses another object's data more than its own → move method |
| **Data clumps** | Same group of fields travels together → make it a type |
| **Primitive obsession** | Using `string`/`int` for domain concepts → value objects |
| **Shotgun surgery** | One change forces edits across many classes → poor cohesion/locality |
| **Divergent change** | One class changes for many reasons → SRP violation |
| **Switch/conditional sprawl** | Type-based branching → polymorphism/Strategy |
| **Comments explaining bad code** | Comment compensating for unclear code → rename/extract |

Note the pair: **divergent change** (one module, many reasons) and **shotgun surgery** (one reason, many modules) are opposite cohesion failures.

---

## Core refactoring moves (Fowler catalog)

- **Extract Function/Method** and **Inline** — the most-used moves; trade naming/readability for indirection.
- **Extract Variable** (explaining variable) / **Inline Variable.**
- **Rename** — the highest-value, lowest-risk refactor; good names eliminate comments.
- **Extract Class / Inline Class** — fix low cohesion or excessive indirection.
- **Move Function/Field** — put behavior near the data it uses (fix feature envy).
- **Replace Conditional with Polymorphism** — kill type-switch sprawl.
- **Introduce Parameter Object** / **Preserve Whole Object** — tame long parameter lists.
- **Replace Temp with Query, Decompose Conditional, Replace Magic Number with Constant, Guard Clauses** (replace nested `if` with early returns), **Replace Error Code with Exception/Result.**

Modern IDEs perform many of these *mechanically and safely* (Rename, Extract Method) — prefer automated refactors over hand-editing to avoid introducing bugs.

---

## Working safely with legacy code (Michael Feathers)

Feathers' definition: **legacy code is code without tests** (regardless of age). Tests are what make change safe.

- **The legacy dilemma:** to change safely you need tests; to add tests you often must change the code (break dependencies) — but that change is risky because there are no tests. Break the cycle with minimal, low-risk seams.
- **Seam:** a place where you can alter behavior without editing in that place (inject a dependency, override a method). Finding seams is the key skill.
- **Characterization tests:** capture *current* behavior (even buggy behavior) so a refactor can't change it unintentionally. You're pinning, not validating correctness.
- **Sprout method/class:** add new behavior in a *new* tested unit and call it from the messy old code, rather than editing the untested mess.
- **Wrap method/class:** wrap existing behavior to add the new behavior around it.

---

## Strangler Fig — incremental migration/rewrite

Named after the strangler fig vine. Instead of a risky big-bang rewrite, you grow the new system *around* the old: route a slice of traffic/functionality to the new implementation behind a facade, expand it incrementally, and retire the old piece by piece.

- Pros: continuous delivery of value, reversible per slice, low blast radius, no "stop-the-world" freeze.
- Contrast with **big-bang rewrite** (Joel Spolsky's "single worst strategic mistake"): you lose accumulated bug-fix knowledge, deliver nothing for months, and the new system rarely catches up.
- Companion: the **Branch by Abstraction** technique — introduce an abstraction over the thing you're replacing, build the new implementation behind it, switch, then remove the old. Enables large changes on `main` without long-lived branches.

---

## Tech debt — the metaphor and the management

Ward Cunningham's metaphor: shipping imperfect code is like taking a loan; you move fast now but pay **interest** (slower future changes, more bugs) until you repay the principal (refactor). Martin Fowler's **debt quadrant** classifies it:

|  | **Reckless** | **Prudent** |
|---|---|---|
| **Deliberate** | "No time for design" | "Ship now, refactor next sprint" (a real strategic choice) |
| **Inadvertent** | "What's layering?" (ignorance) | "Now we know how it should've been done" (learning) |

- **Prudent-deliberate** debt is legitimate engineering: a conscious, recorded tradeoff to hit a deadline, with a payback plan.
- **Reckless** debt (deliberate or from ignorance) is the dangerous kind.
- Other taxonomy: **code debt, design/architecture debt, test debt, documentation debt, dependency debt** (outdated/vulnerable libs), **infrastructure debt.**

### Managing debt
- **Make it visible:** a tracked backlog with cost/impact, not tribal knowledge. Annotate hotspots; some teams add a "debt" label and link affected work.
- **Prioritize by interest, not principal:** pay down debt in code you *touch often* (high churn × high complexity = highest interest). Cold, stable code with ugly internals may be fine to leave.
- **The Boy Scout Rule:** leave each module a little better than you found it — continuous small repayments.
- **Opportunistic + budgeted:** combine "fix as you pass through" with a small recurring capacity (e.g. ~10–20% per cycle) for larger paydowns. Avoid both extremes: never paying (debt compounds) and "stop all features to refactor for a quarter" (rarely sells, rarely finishes).
- **Tie to business value:** frame debt paydown in terms of velocity, defect rate, and risk — not aesthetics. "This module causes 40% of our incidents and slows every feature" beats "the code is ugly."

---

## What interviewers probe

- **Behavior preservation:** do you understand refactoring ≠ rewriting, and do you keep the hats separate?
- **Safety net:** how do you refactor code that has no tests? (Characterization tests, seams.)
- **Smell → move:** can you name a smell and the specific refactoring that fixes it?
- **Migration strategy:** big-bang vs Strangler Fig — do you reach for the risky rewrite?
- **Debt as a business conversation:** can you prioritize debt by interest/churn and justify it to non-engineers?
- **Restraint:** do you know when *not* to refactor (cold stable code, looming deadline, no tests + no time to add them)?

---

## Quick-reference summary

- **Refactoring = behavior-preserving** structural improvement; never mix with feature/bug changes ("separate the hats"). Requires a test net.
- **Smells** are heuristics (long method, God object, feature envy, shotgun surgery, primitive obsession…) pointing at specific **Fowler moves** (extract, move, rename, replace-conditional-with-polymorphism).
- **Legacy = code without tests.** Use **characterization tests + seams** (sprout/wrap) to make change safe.
- Prefer **Strangler Fig / Branch by Abstraction** over big-bang rewrites.
- **Tech debt** is a loan paying interest; classify with Fowler's quadrant; prudent-deliberate debt is OK *with a plan*.
- Manage debt: **make it visible, prioritize by interest (churn × complexity), Boy Scout rule, budget a slice, tie to business value.**
- Senior signal: knowing **when not to refactor.**
