# Clean Code — Practice Questions

[← Topic overview](../README.md)

> Topic: Readability, abstractions, naming, code smells.

---

### Q1. Why is readability considered the single most important property of clean code?

**Answer:** Because code is **read far more often than it is written** — by reviewers, by teammates extending it, and by your future self months later. The dominant cost of software is comprehension during maintenance, not the initial typing. If code is hard to read, every future change is slower and every reader risks misunderstanding it and introducing bugs. Readability is therefore an *engineering* property that directly drives cost-of-change and defect rate, not a matter of taste. "Clever," terse, or micro-optimized code that the next person can't parse is usually a net loss: it saves the author minutes and costs the team hours.

---

### Q2. Explain to a junior why magic numbers are bad and how to fix them.

**Answer:** A magic number is an unexplained literal in the code, like `if (status == 4)` or `price * 0.07`. The problems: (1) the reader has no idea what `4` or `0.07` *mean* — they have to hunt or guess; (2) if the value appears in several places and the rule changes, you must find and update every copy, risking missing one; (3) you can't search for the concept. The fix is to give it a named constant: `if (status == OrderStatus.SHIPPED)` and `price * US_SALES_TAX_RATE`. Now the code reads like a sentence, the value lives in one place, and a search for `US_SALES_TAX_RATE` finds every use. The name documents the *intent* the bare number hid.

---

### Q3. What's wrong with a boolean "flag argument" like `renderPage(true)`? How do you fix it?

**Answer:** A flag argument almost always means the function does **two different things** depending on the flag — which violates "a function should do one thing" and makes call sites cryptic (`renderPage(true)` — true *what*?). The reader must open the function to understand the call. The fix is to **split it into two intention-revealing functions**: `renderPageForPrint()` and `renderPageForScreen()`. If they share logic, extract a private helper they both call. Now each call site reads clearly and each function has a single responsibility. (If the boolean is genuinely *data* being stored, not a behavior switch, that's different — but a flag that selects behavior is the smell.)

---

### Q4. When is a comment a good comment, and when is it a bad one?

**Answer:** **Good comments explain the *why* that the code can't express:** a non-obvious business rule ("waive fee for accounts older than 2 years per 2021 policy"), a workaround for a known upstream bug (with a ticket link), a legal/regulatory constraint, a performance tradeoff, or a warning ("must run before `flush()`"). Also legitimate: public API documentation and TODOs with context. **Bad comments restate the *what*** — `i++; // increment i` adds nothing; commented-out dead code is noise that version control already preserves; and outdated/misleading comments are worse than none because they actively deceive. The guiding rule: a comment is a small admission you couldn't express intent in the code itself — so first try a better name or an extracted function; comment only when the *why* genuinely can't live in the code.

---

### Q5. What is the Single Level of Abstraction Principle (SLAP) and why does it improve readability?

**Answer:** SLAP says every statement within a function should sit at the **same conceptual level**. A `processOrder()` that mixes high-level steps (`validate(order); charge(order); ship(order)`) with low-level detail (manually formatting a date string, looping over bytes) forces the reader to constantly shift mental gears. Keeping one level per function lets it read like a short paragraph or table of contents: the high-level function names the steps, and each step is its own lower-level function. This makes the overall flow obvious at a glance, makes each piece independently nameable and testable, and is the practical reason "small functions that do one thing" produces readable code.

---

### Q6. Command-Query Separation — what is it and why does it matter for clean code?

**Answer:** CQS says a method should either be a **command** (performs an action / changes state, returns nothing meaningful) or a **query** (returns information without side effects) — never both. It matters because hidden side effects in a query are a major source of bugs and confusion: a method named `getUser()` that *also* creates the user if missing surprises every caller and makes the code unsafe to call freely (you can't call it just to check). Separating them means queries are safe and repeatable, commands clearly signal mutation, and names don't lie. The classic violation is a `check…()` or `get…()` method that quietly mutates state.

---

### Q7. How does the choice of name change with the variable's scope?

**Answer:** Name length should **scale with the size of the scope** where the name is used. A loop counter `i` or `x, y` in a 3-line block is fine — the context is right there, and a verbose name would add noise. But a field on a class used across hundreds of lines, or a module-level constant referenced everywhere, needs a fully descriptive, unambiguous name (`retryBackoffMillis`, not `rbm`) because the reader encounters it far from its definition with no local context. The principle: the further a name travels from its declaration, the more self-explanatory it must be.

---

### Q8 (MCQ). Which is the clearest sign a function is doing more than one thing?

A. It has a descriptive name.
B. You can extract a chunk into a separate, meaningfully-named function.
C. It returns a value.
D. It has fewer than 10 lines.

**Answer: B.** If you can pull out a cohesive section and give it its own meaningful name, that section was a distinct responsibility — a sign the function did more than one thing. Length alone (D) doesn't prove it, and returning a value (C) or having a good name (A) is unrelated.

---

### Q9 (MCQ). Which comment is most likely a *good* comment?

A. `// loop through users`
B. `// set x to 0`
C. `// Workaround for vendor API bug #4821: it returns 200 on failure, so we re-check the body.`
D. `// TODO`

**Answer: C.** It explains a non-obvious *why* (a vendor bug and the reason for defensive code) that the code itself can't convey, and references a ticket. A and B merely restate the code; D is a context-free TODO that helps no one.

---

### Q10 (MCQ). You find commented-out code blocks scattered through a file. The best action is:

A. Leave them; they might be useful later.
B. Add a comment explaining why they're commented out.
C. Delete them — version control preserves the history.
D. Move them to the bottom of the file.

**Answer: C.** Commented-out code is dead weight that confuses readers ("is this important? should it be active?"). Version control already preserves it, so delete it. Keeping (A) or relocating (D) it just spreads the noise.

---

### Q11. Is shorter code always cleaner? Give an example where adding lines improves clarity.

**Answer:** No — clean code optimizes for *clarity*, not minimal character count. A dense one-liner can be far harder to read than a few well-named lines. Example: replacing a cryptic nested ternary `return a ? (b ? x : y) : z;` with explicit branches, or replacing `return u && u.acc && u.acc.active && !u.acc.locked;` with an **explaining variable**: `const isUsable = user?.account?.active && !user.account.locked; return Boolean(isUsable);`. The longer version names the concept ("is usable") so the reader grasps intent immediately. Similarly, guard clauses add a couple of `return` lines but flatten deep nesting into something scannable. Brevity that sacrifices comprehension is a false economy.

---

### Q12. How do you keep a team's code clean without endless style debates in review?

**Answer:** Automate the objective, mechanical things so reviews can focus on judgment. Concretely: a **formatter** (Prettier/gofmt/Black) enforced in CI ends whitespace/brace debates and keeps diffs about logic; a **linter/static analyzer** (ESLint, RuboCop, SonarQube) catches smells, dead code, and complexity automatically; **complexity gates** flag functions that need decomposition. With the mechanical stuff handled by tools, code review time is spent on what tools can't judge — **naming, intent, abstraction level, and design**. This both raises the floor consistently and removes the friction and bikeshedding that make reviews unpleasant. Pair it with agreed conventions and the Boy Scout rule so quality trends upward over time.
