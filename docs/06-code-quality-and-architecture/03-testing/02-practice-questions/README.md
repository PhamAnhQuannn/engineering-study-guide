# Testing Strategy — Practice Questions

[← Topic overview](../README.md)

> Topic: Unit/integration/e2e, TDD, mocking, coverage, flaky tests.

---

### Q1. What is the test pyramid, and when would you deviate from it?

**Answer:** The pyramid prescribes many fast, isolated **unit** tests at the base, fewer **integration** tests in the middle, and few slow, brittle **E2E** tests at the top — because cost, runtime, and flakiness rise as you go up while feedback speed falls. You deviate when your bugs don't live in pure logic: an I/O-heavy app whose units are thin glue gets more value from **integration** tests (the "Testing Trophy" shape), because mocking everything would just test that mocks return what you told them. The senior point: the pyramid is a default heuristic, not a law — shape the portfolio to where defects actually originate, and avoid the **ice-cream cone** (mostly E2E), which is slow and flaky.

---

### Q2. Explain the difference between a stub, a mock, and a fake to a junior.

**Answer:**
- A **stub** returns canned data so the code under test can proceed — e.g. `userRepo.find()` returns a fixed user. You don't assert on the stub itself; it's just input.
- A **mock** is a stub *with expectations*: you pre-program "this method should be called once with these args," and the test **fails if that interaction didn't happen.** Use it to verify a side effect, like "an email was actually sent."
- A **fake** is a real, lightweight working implementation — e.g. an in-memory repository that genuinely stores and queries objects. It behaves like the real thing without the cost (no DB).

Rule of thumb: use **stubs/fakes** for state-based tests (assert on the result), and reserve **mocks** for when the *interaction itself* is the behavior you care about. Over-mocking couples tests to implementation and makes them brittle.

---

### Q3. Why is "don't mock what you don't own" good advice?

**Answer:** When you mock a third-party library directly, your mock encodes *your assumption* of how that library behaves. If the vendor changes behavior (different return shape, new exception, changed semantics), your tests stay green because they're asserting against your stale assumption — you get false confidence and a production break. Instead, wrap the third-party dependency behind a thin interface *you* own (an adapter), and fake/mock that interface in unit tests. Then verify the real adapter against the real library with a small set of **integration/contract tests**. This localizes vendor risk to one place and keeps the rest of your suite fast and honest.

---

### Q4. A teammate proposes a CI gate requiring 90% line coverage. What's your take?

**Answer:** Coverage is a useful *diagnostic* (it shows what code never executed) but a poor *target*. A hard 90% gate triggers Goodhart's law: people write assertion-free tests, test trivial getters, and chase the number instead of meaningful behavior — coverage goes up while real confidence doesn't. Line coverage also can't tell you assertions are *correct*; you can execute every line and assert nothing. I'd rather (a) treat coverage as a code-review signal and watch for *drops* on critical modules, (b) demand meaningful assertions in review, and (c) use **mutation testing** on critical paths to actually measure whether tests catch injected faults. If a number is needed, gate on *not regressing* coverage in changed files rather than a blanket global threshold.

---

### Q5. What makes a test flaky, and how do you handle flakiness on a team?

**Answer:** A flaky test passes or fails non-deterministically on identical code. Top causes: **timing/async** (sleep-based waits, races), **shared/leaked state** (DB rows, globals, singletons, test-order dependence), **real I/O** (network, clock, randomness), and **environment** (timezone, locale, CPU speed). Handling: (1) **quarantine** the flaky test so it stops blocking the pipeline and eroding trust; (2) file it as a **bug with an owner and a deadline**; (3) **fix the root cause** — replace sleeps with condition polling, inject a fake clock, seed randomness, isolate state and run tests in random order to surface coupling. Crucially, I avoid blanket auto-retries as a "fix" because retries also mask genuine intermittent product bugs.

---

### Q6. What is mutation testing and why is it stronger than coverage?

**Answer:** Mutation testing tools (PIT for Java, Stryker for JS) automatically introduce small faults — "mutants" — into your code (flip a `>` to `>=`, negate a condition, replace a return value) and then run your tests. If a test fails, the mutant is "killed" (good — your tests detected the fault). A surviving mutant means your tests executed that code but didn't actually *check* its behavior. That's the gap line coverage can't see: coverage proves a line *ran*, mutation testing proves your **assertions are meaningful**. It's more expensive to run (many test runs), so teams target it at critical, logic-dense modules rather than the whole codebase.

---

### Q7. Explain Red-Green-Refactor and one situation where strict TDD is a poor fit.

**Answer:** **Red:** write a failing test for the next small behavior. **Green:** write the minimum code to pass it. **Refactor:** clean up with the test as a safety net, then repeat. It drives testable design, prevents over-building, and documents intent. A poor fit: **exploratory/spike work** where you don't yet know the design or even the desired behavior — writing tests first just locks in guesses you'll throw away. Also UI/visual tweaks and throwaway prototypes. In those cases I spike to learn, then either delete the spike and TDD the real implementation, or write tests right after to pin the behavior I converged on.

---

### Q8 (MCQ). Which test double *asserts* that an interaction occurred?

A. Stub
B. Dummy
C. Mock
D. Fake

**Answer: C — Mock.** A mock is pre-programmed with expectations and fails the test if the expected calls don't happen. Stubs just return canned data, dummies are unused filler, and fakes are working lightweight implementations.

---

### Q9 (MCQ). 100% line coverage on a module guarantees:

A. The module has no bugs.
B. Every line was executed by some test.
C. Every branch outcome was tested.
D. Assertions are correct.

**Answer: B.** Line coverage only guarantees each line executed at least once. It does not guarantee branch coverage (C), correct assertions (D), or absence of bugs (A) — you can run a line while asserting nothing.

---

### Q10 (MCQ). The "ice-cream cone" testing anti-pattern refers to:

A. Too many unit tests, no E2E.
B. A balanced pyramid.
C. Mostly E2E/manual tests with few unit tests — slow and flaky.
D. Using fakes instead of mocks.

**Answer: C.** The ice-cream cone is the inverted pyramid: heavy reliance on slow, brittle E2E/manual tests and too few fast unit tests, producing a slow, flaky, expensive suite.

---

### Q11. How do you decide what to write as a unit test vs an integration test?

**Answer:** I push **logic** down to unit tests and **wiring/contracts** up to integration tests. Pure decision logic — pricing rules, validation, state machines, parsing — gets fast unit tests with many input/output cases (table-driven), because that's where subtle correctness bugs live and feedback must be instant. Anything that depends on a real boundary behaving correctly — SQL queries, ORM mappings, serialization, transaction semantics, HTTP routing — gets an integration test against a real (or realistic, e.g. Testcontainers) dependency, because mocking those just tests my assumptions. The heuristic: if mocking the collaborators would make the test assert "the mock returns what I told it," it belongs at the integration level.

---

### Q12. Your unit test for a class requires mocking 8 collaborators. What is that telling you?

**Answer:** That mock-heavy setup is a **design smell**, not just a testing inconvenience. Needing 8 mocks usually means the class has too many dependencies — likely a Single Responsibility violation (it's doing too much) and/or poor cohesion. The test pain is feedback that the *production* design is too coupled. The fix is usually to **refactor the production code**: split the class along its real responsibilities, extract collaborators behind narrower interfaces, and possibly separate pure logic (no dependencies, trivially unit-tested) from the orchestration glue (covered by a thinner integration test). Tests that are hard to write are a signal to change the code under test, not to write a more elaborate mock harness.
