# Refactoring & Tech Debt — Practice Questions

[← Topic overview](../README.md)

> Topic: Safe refactor, legacy code, tech debt management.

---

### Q1. Define refactoring precisely. Why does the "behavior-preserving" part matter so much?

**Answer:** Refactoring is changing the *internal structure* of code to make it easier to understand and cheaper to change, **without altering its observable behavior**. The behavior-preserving constraint is what makes it *safe*: because outputs don't change, your existing tests stay green throughout, so any test failure means you made a mistake in the transformation, not a deliberate change. The moment behavior changes, you've lost that safety property — you can no longer use "tests still pass" as proof of correctness. That's why mixing a refactor with a feature or bug fix in one commit is dangerous: when something breaks you can't isolate the cause.

---

### Q2. Explain to a junior why you should never mix a refactor and a feature change in the same commit.

**Answer:** Think of two hats: the "refactoring hat" (restructure, tests stay green) and the "feature hat" (add behavior, tests go red→green). If you wear both at once and a test fails, you can't tell whether your restructuring broke something or your new feature did — debugging doubles. Code review also suffers: a reviewer sees 400 changed lines and can't tell which are pure moves (safe) and which are new logic (needs scrutiny), so they either rubber-stamp or block. Keep them in separate commits/PRs: refactor first (prove behavior unchanged), then add the feature on the now-cleaner base. The diff stays readable and the blast radius of each change is clear.

---

### Q3. How do you safely change a 2000-line legacy class that has no tests?

**Answer:** You can't safely refactor untested code, so step one is to get it under test *before* touching structure. Concretely: (1) Identify the **public behavior** you must preserve. (2) Write **characterization tests** that capture what the code currently does — even quirky or arguably-wrong behavior — by feeding inputs and asserting the actual outputs; you're pinning behavior, not judging correctness. (3) Find a **seam** — a place to inject or override a dependency — to break the worst couplings so the class becomes testable (Feathers' techniques). (4) For new behavior, use **sprout method/class**: write the new logic in a fresh, tested unit and call it from the old mess, rather than editing untested code. (5) Now refactor incrementally with the characterization tests as your net, in small commits.

---

### Q4. What's the difference between the Strangler Fig pattern and a big-bang rewrite, and why prefer the former?

**Answer:** A **big-bang rewrite** replaces the whole system at once: you build the new system in parallel for months, then cut over. **Strangler Fig** grows the new system *around* the old incrementally — you put a facade/router in front, migrate one slice of functionality to the new implementation, ship it, then repeat until the old system is fully "strangled" and retired. Prefer Strangler Fig because: you deliver value continuously, each slice is small and reversible (low blast radius), you keep learning from production, and you never have a multi-month period of zero delivery. Big-bang rewrites are notorious failures — you discard years of accumulated bug fixes and edge-case knowledge, and the new system spends ages just catching up to the old one's behavior.

---

### Q5. Tech debt isn't all the same. Explain Fowler's debt quadrant.

**Answer:** Fowler classifies debt on two axes — deliberate/inadvertent and reckless/prudent — giving four kinds:
- **Prudent-deliberate:** "We know the right design, but we'll ship now and refactor next sprint." A legitimate, recorded strategic choice.
- **Reckless-deliberate:** "We don't have time for design." Knowingly cutting corners with no plan — dangerous.
- **Prudent-inadvertent:** "Now that it's done, we see how we should have built it." Debt from learning — unavoidable and healthy to act on.
- **Reckless-inadvertent:** "What's layering?" Debt from ignorance — the worst kind.

The point: not all debt is bad. *Prudent-deliberate* debt is normal engineering when it's a conscious tradeoff with a payback plan. The dangerous quadrants are the reckless ones.

---

### Q6. How do you decide *which* tech debt to pay down first?

**Answer:** Prioritize by **interest, not principal** — i.e. how much the debt actually slows you down, not how ugly it is. The best proxy is **churn × complexity**: code that is both frequently changed (high churn, from git history) and complex/messy (high cyclomatic complexity, many defects) is where debt charges the most interest, because every feature pays the tax. Cold, stable, ugly code that nobody touches charges almost no interest — leave it. I also weight **risk** (debt in security/payment paths or in modules causing recurring incidents) and **blocking impact** (debt that blocks a strategic initiative). The result is a ranked backlog tied to velocity and defect data, so I can justify paydown to the business rather than arguing aesthetics.

---

### Q7. Name three code smells and the specific refactoring that addresses each.

**Answer:**
- **Long parameter list** → **Introduce Parameter Object** (or Preserve Whole Object): bundle the related arguments into a meaningful type, reducing control coupling and clarifying intent.
- **Switch/conditional on a type code** that grows over time → **Replace Conditional with Polymorphism** (or Strategy): each case becomes a subclass/strategy, satisfying Open/Closed.
- **Feature envy** (a method reaches into another object's data more than its own) → **Move Method**: relocate the behavior to the class that owns the data, restoring cohesion and reducing coupling.

(Bonus: **primitive obsession** → introduce **value objects**; **duplicated knowledge** → **Extract Function**.)

---

### Q8 (MCQ). Which of the following is NOT refactoring?

A. Renaming a variable for clarity.
B. Extracting a method from a long function.
C. Fixing a bug so the function returns the correct value.
D. Replacing a type-switch with polymorphism.

**Answer: C.** Fixing a bug changes observable behavior, so by definition it isn't refactoring (which is behavior-preserving). A, B, and D restructure code without changing what it does.

---

### Q9 (MCQ). Michael Feathers defines "legacy code" as:

A. Code older than 5 years.
B. Code written in an outdated language.
C. Code without tests.
D. Code with no documentation.

**Answer: C.** Feathers defines legacy code as code without tests, because tests are what let you change code safely — age and language are irrelevant to that risk.

---

### Q10 (MCQ). The "interest" in the tech-debt metaphor refers to:

A. The one-time cost of writing the code badly.
B. The ongoing extra cost (slower changes, more bugs) you pay until the debt is repaid.
C. The money spent on tooling.
D. The size of the codebase.

**Answer: B.** Interest is the recurring drag the debt imposes on every future change until you "repay the principal" by refactoring. (A describes the principal.)

---

### Q11. When is the right answer "don't refactor this"?

**Answer:** Several cases: (1) **Cold, stable code** with low churn — even if it's ugly, it charges little interest, so a refactor is risk with little payoff. (2) **No tests and no time to write characterization tests** right before a deadline — refactoring blind is reckless; defer it. (3) **Code slated for deletion/replacement** soon — don't polish what you're about to remove. (4) **A looming critical deadline** where the refactor isn't required for the feature — note the debt and schedule it instead. The senior signal is restraint: refactoring is an investment that must earn its return in reduced future cost, and not all code will be touched enough to justify it.

---

### Q12. How do you convince a product manager to allocate time for paying down tech debt?

**Answer:** Speak in their currency — delivery speed, defect rate, and risk — not code aesthetics. I bring data: "This module has the highest churn and causes 40% of our P1 incidents; the last three features in it each took 2× our estimate because of the tangled code." I frame paydown as an investment with a return: faster future features, fewer escaped bugs, less on-call pain. I also propose a *sustainable* model rather than a scary "stop everything for a quarter" — usually a steady ~10–20% capacity for debt plus the Boy Scout rule (improve code we already touch), so feature flow continues. Finally, I tie specific paydown items to upcoming roadmap work ("cleaning this up unblocks the payments revamp you want"), which makes the tradeoff concrete and easy to approve.
