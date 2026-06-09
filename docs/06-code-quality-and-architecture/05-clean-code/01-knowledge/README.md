# Clean Code — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Readability, abstractions, naming, code smells.

Clean code is code that is **easy to read, understand, and change** — optimized for the human who maintains it next, not for the machine and not for the author's cleverness. The single most important property is **readability**, because code is read far more often than it's written. A senior engineer writes code that communicates intent so clearly that comments become largely unnecessary.

---

## Why readability dominates

- Code is read ~10x more than written; the bottleneck of software is *comprehension*, not typing.
- Every minute the next engineer spends decoding unclear code is cost — and they then introduce bugs from misunderstanding.
- "Clever" code (terse one-liners, micro-optimizations, exotic tricks) usually trades the author's brief satisfaction for everyone else's ongoing confusion. Boring, obvious code wins (KISS).
- A useful metric: **WTFs/minute** (Robert Martin's joke that's also true) — clean code is measured by how rarely a reader is confused.

---

## Naming — the highest-leverage skill

Good names are the cheapest documentation. Principles:

- **Intention-revealing:** `elapsedTimeInDays`, not `d`. The name should answer *why it exists, what it does, how it's used* without a comment.
- **Avoid disinformation:** don't call something a `list` if it's a `set`; don't abbreviate ambiguously.
- **Searchable / pronounceable:** `MAX_RETRIES` beats the magic number `3`; `generationTimestamp` beats `genYmdHms`.
- **Length scales with scope:** a loop index `i` is fine in a 3-line loop; a field used across a class needs a full name.
- **One word per concept:** don't mix `fetch`, `get`, `retrieve` for the same idea across the codebase.
- **Avoid encodings/Hungarian notation** (`strName`, `m_count`); modern tooling makes them noise.
- **Verb phrases for functions** (`isValid`, `calculateTotal`), **noun phrases for classes/values** (`Invoice`, `CustomerRepository`).
- **Magic numbers/strings → named constants.** `if (status == 4)` should be `if (status == Order.SHIPPED)`.

Naming is the most-probed "clean code" skill because a bad name fails silently every time it's read.

---

## Functions

- **Small and focused:** a function should do **one thing** at one level of abstraction. If you can extract a meaningfully-named sub-function, it was doing more than one thing.
- **One level of abstraction per function:** don't mix high-level policy (`processOrder`) with low-level detail (string byte manipulation) in the same body.
- **Few arguments:** 0–2 ideal, 3 is a smell, 4+ usually means a missing parameter object. **Avoid flag arguments** (`render(true)`) — they mean the function does two things; split it.
- **No hidden side effects:** a function named `checkPassword` that *also* initializes a session is a lie. Command-Query Separation: a function either *does* something (command) or *answers* something (query), not both.
- **Prefer exceptions/Result over error codes;** use **guard clauses / early returns** to flatten nesting instead of deep `if/else` pyramids.
- **DRY at the knowledge level,** not blind text dedup (see Design Principles).

---

## Comments — a double-edged tool

- The best comment is the one you **didn't need** because the code is self-explanatory. Prefer renaming/extracting over commenting.
- **Bad comments:** restating the code (`i++; // increment i`), commented-out dead code (delete it — that's what version control is for), misleading/outdated comments (worse than none).
- **Good comments:** the *why*, not the *what* — explaining a non-obvious business reason, a workaround for a known bug, a legal/regulatory constraint, a performance tradeoff, or a warning ("this must run before X"). Also: public API docs, TODOs with context, and explanations of *intent* the code can't express.
- A comment is a small failure to express yourself in code — sometimes necessary, never the first resort.

---

## Code smells (clean-code lens)

Smells are surface symptoms of deeper design problems. Common ones at the "clean code" granularity:

| Smell | Why it hurts | Typical fix |
|---|---|---|
| **Magic numbers/strings** | Unexplained, unsearchable | Named constants |
| **Deep nesting / arrow code** | Hard to follow control flow | Guard clauses, extract |
| **Long function** | Does too much, untestable | Extract function |
| **Long parameter list** | Hard to call, control coupling | Parameter object |
| **Flag arguments** | Function does two things | Split into two functions |
| **Duplicated code** | Change in many places | Extract (if same knowledge) |
| **Dead code / commented code** | Noise, false signal | Delete (git remembers) |
| **Inconsistent naming/style** | Cognitive load | Conventions + linter/formatter |
| **God class / long class** | Low cohesion | Extract class |
| **Primitive obsession** | Domain meaning lost | Value objects |
| **Boolean blindness** | `True`/`False` carries no meaning | Enums / named types |

A smell is a *prompt to look closer*, not automatic proof of a defect.

---

## Abstractions & structure

- **Right level of abstraction:** under-abstraction = duplication and detail leakage; over-abstraction = needless indirection that hides the real flow. Aim for the *minimum* abstraction that captures the genuine concept.
- **Single Level of Abstraction Principle (SLAP):** within a function, keep statements at one conceptual level so it reads like a short paragraph.
- **Encapsulation:** hide internal representation; expose behavior, not data (tell, don't ask). Avoid exposing mutable internals.
- **Newspaper structure:** a file reads top-down — high-level first, details below; related things close together.
- **Boy Scout Rule:** leave code a little cleaner than you found it on every change.
- **Consistency:** a consistent *adequate* style beats a mix of individually-"better" styles; cognitive load comes from variety.

---

## Tooling that enforces cleanliness cheaply

- **Formatters** (Prettier, gofmt, Black) — end style debates; make diffs about logic, not whitespace.
- **Linters/static analysis** (ESLint, RuboCop, SonarQube) — catch smells, complexity, dead code automatically.
- **Cyclomatic complexity / cognitive complexity** metrics — flag functions that need decomposition.
- **Code review** — the human layer for naming, intent, and design that tools can't judge.

The senior move: automate the objective stuff (format, lint, complexity gates) so reviews focus on the *judgment* parts — names, abstractions, design.

---

## Common misconceptions / pitfalls

- "Clean code = short code." No — clarity, not brevity. A few extra well-named lines often beat a dense one-liner.
- "More comments = better." No — strive to need fewer; outdated comments mislead.
- "Always DRY." No — wrong abstraction is worse than duplication.
- "Clean code is about aesthetics." No — it's about **cost of change** and **defect rate**; readability is an engineering property.
- "Performance vs clean code is a tradeoff." Rarely at the readability level; optimize hotspots with measurement, keep the rest clear.

---

## What interviewers probe

- **Live naming/refactor:** "Here's messy code — clean it." They watch names, decomposition, guard clauses, magic-number removal.
- **Comment judgment:** can you tell a *why* comment from a redundant *what* comment? Will you delete dead code?
- **Function design:** do you spot flag arguments, side effects, mixed abstraction levels?
- **Pragmatism:** do you over-engineer in the name of "clean," or know when consistency/simplicity wins?
- **Self-review:** can you critique your *own* code and articulate why a change improves readability?

---

## Quick-reference summary

- Clean code optimizes for the **next human reader**; readability is the top property because code is read ≫ written.
- **Naming** is the highest-leverage skill: intention-revealing, searchable, one word per concept, length scales with scope, no magic numbers.
- **Functions:** small, one thing, one abstraction level, ≤2–3 args, no flag args, no hidden side effects (Command-Query Separation), guard clauses over deep nesting.
- **Comments:** explain **why**, not what; delete dead/commented code; the best comment is an unneeded one.
- **Smells** (magic numbers, deep nesting, flag args, long functions, primitive obsession) are prompts to look closer.
- Hit the **right** abstraction level (SLAP) — neither under- nor over-abstracted.
- Automate format/lint/complexity; reserve review for **judgment** (names, design). Apply the **Boy Scout Rule**.
