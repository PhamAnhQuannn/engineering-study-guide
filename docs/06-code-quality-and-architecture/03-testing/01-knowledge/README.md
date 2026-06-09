# Testing Strategy — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Unit/integration/e2e, TDD, mocking, coverage, flaky tests.

Tests exist to let you **change code with confidence and ship fast without fear.** A senior engineer designs a *test portfolio* — the right mix of fast/narrow and slow/broad tests — and treats the suite as production code (it must be reliable, readable, and fast, or the team routes around it).

---

## The test pyramid (and its critics)

The **pyramid** (Mike Cohn) prescribes *many* unit tests, *fewer* integration tests, *few* end-to-end tests:

```
        /\        E2E / UI       — few, slow, brittle, high confidence
       /  \       Integration    — some, medium speed
      /____\      Unit           — many, fast, isolated
```

Rationale: cost and flakiness rise as you go up; feedback speed falls. You want most failures caught by the cheap, fast layer.

- **Testing Trophy** (Kent C. Dodds, common in front-end/JS): emphasizes **integration** as the sweet spot of confidence-per-cost, with static analysis (types/lint) as the base. Reflects that for I/O-heavy apps, unit tests of glue code give false confidence.
- **Ice-cream cone (anti-pattern):** mostly E2E, few unit — slow, flaky, expensive to maintain. A common failure mode.

Senior framing: there's no universal ratio. Choose the shape by **where your bugs actually come from**. Logic-heavy core → more unit. Integration-heavy glue → more integration/contract tests.

---

## Test levels

- **Unit test** — exercises one unit (function/class) in isolation; fast (ms), deterministic, no I/O. Pinpoints failures. Debate: "isolation" means *isolated from other tests*, not necessarily *all collaborators mocked* (see London vs Detroit).
- **Integration test** — multiple components together, often with a real dependency (DB via Testcontainers, real HTTP to a fake server). Catches wiring/contract/serialization bugs unit tests miss.
- **Component/service test** — a whole service in isolation with its dependencies stubbed at the boundary.
- **End-to-end (E2E)** — the full system through the user-facing surface (browser, API). Highest confidence, slowest, flakiest; keep to critical happy paths + a few key failures.
- **Contract test** — verifies a provider and consumer agree on an interface (e.g. Pact). Replaces many slow cross-service E2E tests with fast, isolated checks on each side.

---

## TDD — Test-Driven Development

**Red → Green → Refactor:** write a failing test, write the minimum code to pass, then refactor with the test as a safety net.

- Benefits: forces testable design (DIP/seams emerge), documents intent, prevents over-building (YAGNI), gives immediate feedback, keeps coverage honest.
- **Classicist (Detroit/Chicago) vs Mockist (London)** schools:
  - *Detroit/state-based:* test behavior via real collaborators, assert on resulting state. Fewer mocks, tests survive refactors, but failures less localized.
  - *London/interaction-based:* mock collaborators, assert on interactions. Highly isolated, drives outside-in design, but couples tests to implementation → brittle.
- TDD is a design tool, not a religion. It shines for logic with clear contracts; it's awkward for exploratory/UI/spike work. Many seniors do "test-after" or test-alongside for some code and strict TDD for tricky logic.

---

## Test doubles (Meszaros' taxonomy)

Often loosely called "mocks," but they differ:

| Double | Purpose |
|---|---|
| **Dummy** | Filler passed but never used (e.g. a placeholder arg) |
| **Stub** | Returns canned answers to calls (`repo.find() → fixedUser`) |
| **Spy** | A stub that also records how it was called |
| **Mock** | Pre-programmed with expectations; *asserts* on interactions; fails if not called as expected |
| **Fake** | A working lightweight implementation (in-memory DB, in-memory queue) |

Guidance: prefer **fakes/stubs** for state-based tests; reserve **mocks** for verifying genuine interactions (e.g. "an email *was* sent"). **Don't mock what you don't own** — wrap third-party libs behind your own interface and fake that, so a vendor change can't silently break only your mocks.

---

## Coverage — useful but gameable

- **Line/statement coverage** — % of lines executed. **Branch coverage** — % of decision outcomes taken. **Path coverage** — combinations (usually impractical at 100%).
- Coverage tells you what's **not** tested; it does **not** tell you tested code is *correct* (you can execute a line and assert nothing).
- **Mutation testing** (PIT, Stryker) is a stronger signal: it injects faults ("mutants") and checks tests catch them; surviving mutants reveal weak assertions.
- Anti-pattern: a coverage **gate** (e.g. "must be 90%") that incentivizes assertion-free tests and testing trivial getters. Use coverage as a *diagnostic*, not a target (Goodhart's law).

---

## Flaky tests — the silent killer

A **flaky test** passes/fails non-deterministically on the same code. Flakiness erodes trust: people re-run until green, then ignore real failures. Common causes:

- **Async/timing:** `sleep()`-based waits; race conditions. Fix: poll on a condition / await deterministic signals, control the clock.
- **Shared state / test order dependence:** tests leaking DB rows, globals, singletons. Fix: isolate, reset, run in random order to expose coupling.
- **Real time, real network, real randomness:** fix the seed, inject a fake clock, stub the network.
- **Environment differences:** timezone, locale, CPU speed.

Senior practice: **quarantine** flaky tests (don't let them block the pipeline), track them as bugs with owners, and fix the root cause — never paper over with blanket retries (retries hide real intermittent product bugs too).

---

## Properties of good tests (F.I.R.S.T. + more)

- **Fast** — or they won't be run.
- **Isolated/Independent** — no order dependence, no shared mutable state.
- **Repeatable** — deterministic across machines and runs.
- **Self-validating** — pass/fail with no manual inspection.
- **Timely** — written close to the code (ideally before).
- **Behavior-focused:** test *what* (observable behavior/contract), not *how* (private internals), so tests survive refactors. Use **AAA**: Arrange, Act, Assert. One logical assertion per test. Descriptive names that read as specifications.

---

## Other techniques worth naming

- **Parameterized/table-driven tests** — same logic, many input/output rows.
- **Property-based testing** (QuickCheck, Hypothesis) — assert invariants over generated inputs; finds edge cases humans miss.
- **Snapshot/approval tests** — capture output, diff on change; great for serialized structures, risky if blindly re-baselined.
- **Golden/characterization tests** — pin current behavior of legacy code before refactoring (even if "wrong"), so refactors don't change behavior unintentionally.
- **Smoke tests** — minimal "is it alive" checks post-deploy.

---

## What interviewers probe

- **Where do you put effort?** Do you reflexively chase 100% unit coverage, or reason about where bugs come from?
- **Mocking judgment:** over-mocking (brittle tests), mocking what you don't own.
- **Flaky tests:** can you diagnose and *fix the cause*, not just retry?
- **Coverage nuance:** do you know coverage ≠ correctness; can you name mutation testing?
- **Testability as design:** do hard-to-test symptoms (statics, hidden deps) signal design problems to you?
- **TDD pragmatism:** can you discuss when TDD helps and when it doesn't?

---

## Quick-reference summary

- Build a **portfolio**: many fast unit, some integration, few E2E; shape it to where your bugs live. Avoid the ice-cream cone.
- **TDD:** Red→Green→Refactor; a design tool, not dogma. Know London (mockist) vs Detroit (classicist).
- **Doubles:** dummy/stub/spy/mock/fake — prefer fakes/stubs; mocks only for real interactions; don't mock what you don't own.
- **Coverage** shows what's untested, not what's correct; **mutation testing** is a stronger signal; don't weaponize coverage gates.
- **Flaky tests:** root-cause (timing, shared state, real I/O), quarantine + fix, never blanket-retry.
- Good tests are **F.I.R.S.T.**, behavior-focused, and treated as production code.
