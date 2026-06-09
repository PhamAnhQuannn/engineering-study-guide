# Testing Strategy — Real-World Situations

[← Topic overview](../README.md)

> Topic: Unit/integration/e2e, TDD, mocking, coverage, flaky tests.

On-the-job scenarios. Each follows: **model approach → diagnose with data → communicate → root-cause fix → prevention.**

---

### S1. The CI suite takes 45 minutes and people merge on red "because it's probably flaky"

**Approach:** Two problems — slowness and eroded trust. Tackle trust first; an ignored suite is worthless.
**Diagnose with data:** Pull per-test timing and a flaky-test report (re-run history). Typically a small set of E2E/integration tests dominate runtime, and a handful of flaky tests cause most "ignore the red" behavior. Bucket: slow-but-reliable vs flaky.
**Communicate:** Share the breakdown — "8 tests = 60% of runtime; 5 tests = 90% of false failures." Propose a plan and a target (e.g. < 10 min PR feedback).
**Root-cause fix:** Parallelize and shard the suite; move expensive E2E to a post-merge/nightly stage with PRs running the fast unit+integration layer; **quarantine** flaky tests into a non-blocking lane with owners; replace sleeps with condition-based waits. Convert redundant E2E into faster integration/contract tests.
**Prevention:** Enforce a PR-stage time budget, a flaky-test dashboard with auto-quarantine after N failures, and a policy that red is *never* merged (now credible because red means red).

---

### S2. A production bug shipped despite "90% coverage" on the affected module

**Approach:** Coverage measured execution, not correctness. Find the assertion gap and the missing scenario.
**Diagnose with data:** Read the bug's failing input, then the existing tests. Common findings: tests executed the buggy line but asserted nothing meaningful, or they covered the happy path and missed the edge (null, empty, boundary, concurrency). Run **mutation testing** on the module — surviving mutants pinpoint weak assertions.
**Communicate:** Reframe with the team: coverage % gave false comfort; here's the specific untested behavior. Avoid blame; focus on the systemic gap.
**Root-cause fix:** Add a failing test reproducing the bug (regression test), fix the code, and strengthen the weak assertions the mutants exposed.
**Prevention:** Stop treating coverage as a quality target; add mutation testing on critical modules in CI; add a checklist for edge cases (null/empty/boundary/error paths) in code review; use property-based tests where invariants exist.

---

### S3. A flaky E2E test fails ~10% of runs and the team just clicks "re-run"

**Approach:** Re-running normalizes ignoring failures and can mask a real intermittent product bug. Treat flakiness as a bug.
**Diagnose with data:** Collect failure logs/screenshots/videos across runs; look for patterns — does it fail under load, at certain times, after a specific prior test? Classic causes: fixed `sleep` shorter than real latency, non-unique test data colliding across parallel runs, animation/timing races, or a genuine backend race the test happens to expose.
**Communicate:** File it as a tracked bug with an owner; quarantine it from the blocking run so it stops eroding trust, and say so explicitly.
**Root-cause fix:** Replace sleeps with explicit waits on a stable condition/selector; make test data unique per run; control randomness/clock. If the root cause is an actual product race, fix the product — the test was right.
**Prevention:** Ban fixed sleeps in E2E (lint/helper), require unique data factories, run tests in randomized order in CI to surface ordering coupling, and auto-quarantine + alert on repeated flakes.

---

### S4. Inheriting a legacy module with zero tests that you must change safely

**Approach:** You can't safely refactor untested legacy code. Pin behavior first, then change.
**Diagnose with data:** Identify the seams and the public behavior you must preserve. The code is likely hard to test (statics, hidden deps, long methods) — that's expected.
**Communicate:** Set expectations that step one is *characterization*, not feature work, and why it de-risks the change.
**Root-cause fix:** Write **characterization/golden tests** that capture current behavior (even quirky behavior), introduce seams (extract a dependency behind an interface, use the "sprout method/class" technique from Feathers), get the change under test, then refactor with the golden tests as a net. Keep the behavior-preserving refactor and the feature change in *separate* commits.
**Prevention:** Leave the module better than you found it (boy-scout rule); document the seams; gate further changes behind the new tests so it doesn't regress to untestable.

---

### S5. Two teams' services break in integration despite each team's tests being green

**Approach:** Classic contract mismatch — each side tested its assumption, not the shared agreement.
**Diagnose with data:** Diff what the consumer expects vs what the provider actually returns (field added/removed, type changed, nullability, error codes). The provider's unit tests and the consumer's mocks each encoded a *different* version of the contract.
**Communicate:** Bring both teams to the actual payload diff; agree on the canonical contract and who owns it.
**Root-cause fix:** Introduce **consumer-driven contract tests** (e.g. Pact): the consumer publishes expectations, the provider verifies them in its own CI. This catches drift on each side *fast* without slow cross-service E2E. Fix the immediate mismatch and add the contract.
**Prevention:** Make contract verification a required check on both pipelines; version the API and enforce backward compatibility; add a small smoke E2E for the critical joined flow.

---

### S6. Leadership wants "100% coverage" mandated across the org

**Approach:** Redirect from a vanity metric to actual confidence, without dismissing the legitimate underlying concern (insufficient testing).
**Diagnose with data:** Show examples where high coverage coexisted with real bugs (S2-style), and the cost: chasing the last 10% drives assertion-free tests on trivial code (getters, generated mappers) and slows delivery.
**Communicate:** Acknowledge the goal (quality), propose better proxies. Bring numbers on where bugs actually originate.
**Root-cause fix:** Replace the blanket mandate with: (a) coverage as a non-regression check on *changed* code, (b) mutation testing on critical modules to measure real test strength, (c) required meaningful assertions in review, (d) tracking escaped-defect rate as the true outcome metric.
**Prevention:** Establish testing standards and a definition of done that emphasize behavior coverage and edge cases over a single percentage; review the escaped-defect trend, not the coverage trend.
