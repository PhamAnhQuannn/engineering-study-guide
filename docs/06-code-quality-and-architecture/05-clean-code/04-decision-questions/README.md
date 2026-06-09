# Clean Code — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Readability, abstractions, naming, code smells.

Each prompt frames a real tradeoff. Give a recommendation and state **what would change the answer**.

---

### D1. A clever one-liner vs an explicit multi-line version

**Options:** (A) A dense one-liner (nested ternary / chained comprehension). (B) Several lines with explaining variables and clear control flow.

**Recommendation:** **B** in almost all production code. Clean code optimizes for the next reader, and a clever one-liner trades the author's brief satisfaction for everyone else's repeated confusion. Extract explaining variables, use guard clauses, name the intent. The extra lines are cheap; the comprehension saving compounds across every future read and review.

**What would change the answer:** If the one-liner is an *idiomatic* expression the whole team reads fluently (a standard map/filter pipeline in a functional codebase), it can be clearer than verbose alternatives. In a tiny, throwaway script where no one will maintain it, terseness is harmless.

---

### D2. Add a comment vs rename/restructure the code

**Options:** (A) Add a comment explaining what a confusing block does. (B) Rename variables/extract a function so the code explains itself; comment only the *why* if needed.

**Recommendation:** **B** first. A comment that explains *what* the code does is a signal the code isn't expressing itself — fix the code: rename to intention-revealing names, extract a well-named function. Reserve comments for *why* (business reason, workaround, constraint) that the code genuinely can't convey. Self-explanatory code can't go stale the way comments do.

**What would change the answer:** When the explanation is a *why* the code structurally cannot hold — a regulatory rule, a vendor-bug workaround, a non-obvious performance tradeoff — a comment is the right tool and restructuring won't replace it. Public API surfaces also warrant doc comments regardless.

---

### D3. Consistent-but-imperfect team style vs each engineer's individually "better" style

**Options:** (A) Everyone follows one agreed style/convention even if it's not each person's favorite. (B) Each engineer writes in their own (locally "optimal") style.

**Recommendation:** **A.** Consistency reduces cognitive load far more than any individual style improvement adds — readers spend energy on *variety*, not on a particular convention. A uniform, adequate style across the codebase beats a patchwork of individually-clever styles. Enforce it with a formatter and linter so it's automatic and non-negotiable, not a per-PR argument.

**What would change the answer:** If the agreed convention is actively harmful (encourages bugs, fights the language's idioms), change the convention *for the whole team* — then re-standardize. The goal is consistency around a *good-enough* standard, not freezing a bad one.

---

### D4. Strict function-size / complexity limits vs developer judgment

**Options:** (A) Hard lint rules (max function length, max cyclomatic complexity) that fail CI. (B) Guidelines plus reviewer judgment, no hard gate.

**Recommendation:** A blend leaning on **A for egregious cases, B for nuance.** Automated complexity/length gates are great at catching the truly out-of-control functions cheaply and consistently, freeing review for judgment. But hard limits can also force awkward extractions that *reduce* clarity (splitting a cohesive function just to satisfy a line count). Set the threshold high enough that it only trips on genuinely problematic code, and allow documented exceptions.

**What would change the answer:** A junior-heavy or fast-growing team benefits from firmer automated gates to establish a floor. A senior, disciplined team can lean more on review judgment with looser gates.

---

### D5. Refactor smelly code you're passing through now vs leave it and stay focused on the task

**Options:** (A) Boy Scout rule — clean the bit you touched (rename, extract, kill a magic number). (B) Leave it untouched to keep the diff minimal and focused. (C) Open a separate cleanup PR.

**Recommendation:** **A for small, safe, local improvements** directly in the area you're already changing — that's how a codebase improves continuously without dedicated projects. Keep the cleanup *small and within the touched scope* so the diff stays reviewable. For anything larger, **C** (separate PR) keeps the feature change focused and the refactor independently reviewable.

**What would change the answer:** If the file is untested and the "cleanup" risks behavior changes, don't do it casually (B) — refactoring needs a net. If you're under acute deadline pressure, defer to a ticket rather than expanding scope.

---

### D6. Extract a shared abstraction now vs tolerate duplication a bit longer

**Options:** (A) Extract a shared helper as soon as you see two similar blocks. (B) Wait until a third occurrence (Rule of Three) confirms the real shared concept.

**Recommendation:** **B.** Two similar-looking blocks may be coincidental duplication that will diverge; extracting early risks the *wrong abstraction*, which is costlier than duplication (you then bolt on flags and conditionals to serve diverging callers). Wait for the third instance, which reveals the genuine shared *knowledge*, then extract the right seam.

**What would change the answer:** If the duplicated thing is a single source of truth that *must* stay identical (a tax rate, a validation rule, a protocol constant), centralize it immediately — that's real knowledge duplication, not coincidental code similarity, so the Rule of Three doesn't apply.

---

### D7. Optimize a hot path (sacrificing some readability) vs keep it clean

**Options:** (A) Hand-optimize for performance, accepting denser/less obvious code. (B) Keep it clean and readable.

**Recommendation:** **B by default; A only with measurement.** Most code is not hot, and premature micro-optimization sacrifices readability for speed nobody needed — "premature optimization is the root of all evil." Keep code clean, *profile*, and optimize only the proven hotspots. When you do optimize a hotspot for real, isolate it, comment the *why* (with the benchmark), and contain the ugliness so the rest stays clean.

**What would change the answer:** A measured, genuinely hot inner loop in a latency- or cost-critical path justifies the tradeoff — but document it and keep the optimization local. Without profiling data, assume the clean version is the right one.
