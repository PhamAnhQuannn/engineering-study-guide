# Testing Strategy — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Unit/integration/e2e, TDD, mocking, coverage, flaky tests.

Each prompt frames a testing tradeoff. Give a recommendation and state **what would change the answer**.

---

### D1. Real database (Testcontainers) vs in-memory fake vs mocked repository for data-access tests

**Options:** (A) Spin up a real DB in a container per test run. (B) In-memory fake repository. (C) Mock the repository interface.

**Recommendation:** Use a **layered** approach. Test pure business logic with a **fake or mock (B/C)** for speed — fast, isolated, runs on every save. But test the **data-access layer itself against a real DB (A)** with Testcontainers, because SQL, indexes, constraints, transactions, and ORM mappings only behave correctly against the real engine; mocks there just test your assumptions. Don't mock the DB and claim your queries work.

**What would change the answer:** If the DB is exotic/managed (e.g. a cloud-only service) and a container isn't faithful, lean on a small set of tests against a real staging instance. If the project is tiny and data logic trivial, a fake everywhere may be acceptable to start.

---

### D2. London (mockist) vs Detroit (classicist) TDD for a new service

**Options:** (A) Mockist — mock all collaborators, assert interactions, design outside-in. (B) Classicist — use real collaborators where cheap, assert on resulting state.

**Recommendation:** Default **classicist/state-based (B)** for most logic: tests survive refactors (they don't pin internal call sequences) and read as behavior specs. Use **mockist (A)** selectively at boundaries where the *interaction is the behavior* (an email was sent, a payment was charged, an event was published) or to drive design outside-in for a brand-new component with unclear collaborators.

**What would change the answer:** Heavy side-effecting code (lots of "did we call X?") legitimately needs interaction tests. A team practiced in outside-in design may prefer mockist throughout. If tests are constantly breaking on refactors, that's a signal you've over-mocked and should shift toward state-based.

---

### D3. Investing in more E2E tests vs more integration tests to catch regressions

**Options:** (A) Grow the E2E suite to cover more flows. (B) Invest in integration/contract tests; keep E2E to critical happy paths.

**Recommendation:** Prefer **B**. E2E tests give the highest confidence per test but the worst cost/flakiness/runtime, so a large E2E suite becomes slow and untrustworthy (people start ignoring red). Cover component interactions with integration tests and cross-service agreements with **contract tests** (Pact), reserving a *small* E2E set for the few business-critical end-to-end journeys.

**What would change the answer:** If most of your bugs are genuinely emergent cross-system issues that only surface end-to-end (complex UI workflows, third-party redirects), you need a bit more E2E — but invest first in making them reliable (stable selectors, deterministic data) before adding volume.

---

### D4. Enforce a coverage threshold in CI vs no hard gate

**Options:** (A) Hard global gate (e.g. fail under 85%). (B) No gate; rely on review. (C) Gate only on *not regressing* coverage of changed lines.

**Recommendation:** **C** is the best balance: it prevents new untested code from sneaking in without punishing legacy modules or incentivizing fake tests to hit a global number. Pair it with review for meaningful assertions and mutation testing on critical modules. Avoid a blunt global gate (A), which encourages gaming.

**What would change the answer:** In regulated/safety-critical contexts, a high mandated coverage floor may be a compliance requirement regardless of Goodhart effects — then (A) is non-negotiable, but back it with mutation testing so coverage isn't hollow. A tiny mature team with strong review discipline might run fine with (B).

---

### D5. Snapshot tests vs explicit assertions for a serialized output

**Options:** (A) Snapshot/approval test (capture output, diff on change). (B) Hand-written explicit assertions on specific fields.

**Recommendation:** Use **snapshots (A)** for large, stable serialized structures (API response shapes, generated config, rendered markup) where writing per-field assertions is tedious and the whole shape matters. Use **explicit assertions (B)** for the small set of fields whose *values* carry business meaning, so the test communicates intent and won't be blindly re-baselined. Often: a snapshot for shape + a few explicit assertions for the load-bearing values.

**What would change the answer:** If reviewers habitually re-record snapshots without reading the diff, snapshots become rubber stamps — drop them for explicit assertions. If the output is huge and mostly incidental, snapshots win to avoid brittle, low-value assertions.

---

### D6. Quarantine-and-fix vs auto-retry vs delete for a chronically flaky test

**Options:** (A) Quarantine it (exclude from the blocking run) and assign an owner to root-cause it. (B) Add automatic retries so it "passes." (C) Delete it.

**Recommendation:** **A**. Quarantine restores pipeline trust immediately while keeping the test visible as a tracked bug with an owner and deadline, so the underlying nondeterminism gets fixed. Auto-retry (B) is a trap: it hides not just test flakiness but real intermittent *product* bugs the test was catching. Delete (C) only if the test provides no value and overlaps coverage already provided elsewhere.

**What would change the answer:** If investigation proves the flakiness is purely environmental and the scenario is already covered by a stable test, deletion (C) is fine. A *bounded* single retry can be acceptable for inherently networked E2E against external systems — but only with monitoring so retries don't silently climb.

---

### D7. Test-first (TDD) vs test-after for an upcoming feature with unclear requirements

**Options:** (A) Strict TDD from the start. (B) Spike to learn, then TDD the real implementation. (C) Test-after.

**Recommendation:** **B**. When requirements/design are unclear, writing tests first locks in guesses you'll discard. Do a throwaway **spike** to learn the shape of the problem, delete it, then TDD the production implementation now that the contract is clear — you get TDD's design benefits without thrashing. Reserve pure test-after (C) for code where the design is already obvious and tests mainly guard against regression.

**What would change the answer:** If requirements are actually crisp (a well-specified algorithm or API contract), skip the spike and TDD directly (A). For genuinely throwaway prototypes that will never ship, minimal or no tests is the right call.
