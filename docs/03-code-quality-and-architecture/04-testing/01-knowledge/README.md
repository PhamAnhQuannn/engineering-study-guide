# Testing Strategy — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Unit/integration/e2e, TDD, mocking, coverage, flaky tests.

Tests exist to let you **change code with confidence and ship fast without fear.** A senior engineer designs a *test portfolio* — the right mix of fast/narrow and slow/broad tests — and treats the suite as production code (it must be reliable, readable, and fast, or the team routes around it).

> **🛒 Where we are in building ShopFast** — Last topic we introduced [Design Patterns](../../02-design-patterns/01-knowledge/README.md) to give ShopFast's modules clean, swappable seams. Those seams are only valuable if they're verified — this topic covers how to build the test portfolio that makes changing `catalog`, `cart`, and `order` safe. **Next:** [Refactoring](../../04-refactoring/01-knowledge/README.md) — with a test net in place, we can safely reshape the code as requirements evolve.

---

## Teaching arc: testing the ShopFast checkout flow

### What it is

A **test** is an automated check that a piece of software behaves as expected. Tests are not just a safety net — they are a **design tool, a specification, and an insurance policy** that lets you move fast without fear.

Think of a test suite as a fire drill. You don't run it because things are broken today; you run it so that when things do break — or when you make a risky change — you find out in 30 seconds, not from a customer in production.

Three roles:
1. **Specification** — a test says "when a user checks out with a valid cart, an order is created and payment is charged once." That's a requirement, written as code.
2. **Safety net** — run after every change; catches regressions in seconds.
3. **Design pressure** — code that is hard to test is usually hard to change. Testability pain is a design signal.

### What it looks like

The test pyramid — the most important shape to internalize:

```
         /\
        /  \   E2E (End-to-End) / UI
       /    \  — few, slow (minutes), brittle, high confidence
      /------\
     /        \ Integration
    /          \ — some, medium speed (seconds–minutes)
   /------------\
  /              \ Unit
 /                \ — many, fast (milliseconds), isolated
/------------------\
```

**Why the pyramid matters:** bugs found at the bottom cost 1x to fix. Bugs found at the top cost 10x (slow to run, slow to diagnose, slow to fix). You want maximum signal from the cheapest, fastest layer.

### The code that builds it

**Unit test** — tests one unit in isolation. No DB, no network, no clock:

```typescript
// Unit test for PricingService — pure logic, zero infrastructure
describe("PricingService.applyTax", () => {
  it("adds 10% tax to the price", () => {
    const pricing = new PricingService();
    expect(pricing.applyTax(1000)).toBe(1100);   // 1000 cents → 1100 cents
  });

  it("rounds to the nearest cent", () => {
    const pricing = new PricingService();
    expect(pricing.applyTax(333)).toBe(366);      // 333 * 1.1 = 366.3 → 366
  });
});
```

**Integration test** — `CheckoutService` with a real (in-memory test) DB and a fake payment gateway:

```typescript
// Integration test: verifies that placeOrder creates a DB record AND charges payment
describe("CheckoutService.placeOrder (integration)", () => {
  let db: TestDatabase;
  let checkoutService: CheckoutService;

  beforeEach(async () => {
    db = await TestDatabase.start();             // real Postgres in Docker via Testcontainers
    checkoutService = new CheckoutService(
      new CatalogApiImpl(db),
      new PricingService(),
      new FakePaymentGateway(),                  // no real money — controlled fake
      new OrderRepository(db),
    );
  });

  afterEach(() => db.rollback());                // clean state between tests

  it("creates an order record and charges the gateway exactly once", async () => {
    const gateway = new SpyPaymentGateway();     // spy records calls
    const svc = new CheckoutService(new CatalogApiImpl(db), new PricingService(), gateway, new OrderRepository(db));

    await svc.placeOrder("user-1", "product-42");

    const orders = await db.query("SELECT * FROM orders WHERE user_id = 'user-1'");
    expect(orders).toHaveLength(1);              // one order in DB
    expect(gateway.chargeCallCount).toBe(1);     // payment charged exactly once
  });
});
```

**E2E (End-to-End) test** — the full HTTP stack, critical happy path only:

```typescript
// E2E: POST /v1/orders creates an order (runs against the real running server)
it("POST /v1/orders returns 201 and creates the order", async () => {
  const res = await fetch(`${BASE_URL}/v1/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "test-key-1" },
    body: JSON.stringify({ userId: "user-1", productId: "product-42" }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.id).toBeDefined();
});
```

### The code that calls it / uses it

TDD (Test-Driven Development) flow — writing the test *first* then implementing:

```typescript
// Step 1: RED — write a failing test for idempotency (behavior doesn't exist yet)
it("does not double-charge when the same Idempotency-Key is sent twice", async () => {
  const gateway = new SpyPaymentGateway();
  const svc = new CheckoutService(catalog, pricing, gateway, orderRepo);

  await svc.placeOrder("user-1", "product-42", "idem-key-abc");
  await svc.placeOrder("user-1", "product-42", "idem-key-abc");  // same key = retry

  expect(gateway.chargeCallCount).toBe(1);   // TEST FAILS — not implemented yet
});

// Step 2: GREEN — implement the minimum to pass
// Step 3: REFACTOR — clean up without changing behavior (test stays green)
```

This test documents the idempotency requirement (from SHOPFAST.md: `POST /v1/orders` is not idempotent — client sends an `Idempotency-Key`). The test IS the spec.

### Types & differences

**Test pyramid layers — what each catches:**

| Layer | Speed | What it catches | What it misses |
|---|---|---|---|
| **Unit** | Milliseconds | Logic bugs, edge cases in isolation | Wiring bugs, serialization bugs, DB constraint violations |
| **Integration** | Seconds–minutes | Wiring, DB queries, serialization, module contracts | Full user journey, environment issues |
| **E2E (End-to-End)** | Minutes | Full user journey, env config bugs, browser/client issues | Fine-grained edge cases (too slow to run exhaustively) |
| **Contract** | Fast (isolated) | Provider–consumer API agreement | Internal logic |

**Test double taxonomy (Meszaros):**

| Double | Purpose | Use when |
|---|---|---|
| **Dummy** | Passed but never used (filler arg) | You need to satisfy a constructor but don't care about the dep |
| **Stub** | Returns canned answers (`getProduct() → fixedProduct`) | You need the dep to return something specific |
| **Spy** | A stub that also records calls | You want to assert "was this method called?" |
| **Mock** | Pre-programmed expectations; fails if not called as expected | Verifying genuine interactions (email was sent, charge was called once) |
| **Fake** | A working lightweight implementation (in-memory DB) | Fast, realistic alternative to the real dep |

**Reach for:** Fakes/stubs for state-based tests. Mocks only for genuine interaction verification ("did we charge the payment gateway?"). Never mock what you don't own — wrap third-party libs first.

### How ShopFast applies it

**Portfolio shape:**

ShopFast has a logic-heavy `PricingService` (tax rules, discounts, coupon stacking) — many unit tests. It has I/O-heavy glue: `OrderService` wiring `CatalogApi` + `PaymentGateway` + `OrderRepository` together — integration tests. The checkout API (`POST /v1/orders`) is the most critical user path — one E2E test on the happy path + one for idempotency.

**Idempotency testing:**

SHOPFAST.md states: `POST /v1/orders` is *not idempotent* — client sends an `Idempotency-Key` header; server dedups retried charges. The integration test for this is the *most important test in the codebase* — it documents the requirement that stops double-charging customers. It's an integration test (not unit) because idempotency requires the dedup table to be a real DB write.

**Fake vs mock for the payment gateway:**

`FakePaymentGateway` is a working in-memory implementation: it stores charges in a map, returns success, and supports the idempotency key check. `SpyPaymentGateway` adds call-count assertions. The real Stripe client is only hit in a small set of manual or canary integration checks — never in the unit or CI integration suite.

**Flaky test vigilance:**

ShopFast's checkout involves async queue workers (email, inventory). E2E tests that poll "did the email arrive?" using `sleep(500)` are a flakiness trap. The fix: inject a `FakeClock` in unit tests; in integration tests, await a deterministic signal (the `order.placed` event committed to the queue) rather than sleeping.

> **If you skip tests:** adding idempotency-key dedup to `POST /v1/orders` without an integration test means a mobile client that retries on a dropped connection will double-charge the customer — and you'll find out from Stripe dispute reports, not from CI. Without a unit-test net for `PricingService`, every coupon rule change is a manual QA session. Without E2E on checkout, a misconfigured environment variable silently routes all orders to the test Stripe account.

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

- Benefits: forces testable design (DIP/seams emerge), documents intent, prevents over-building (YAGNI — You Aren't Gonna Need It), gives immediate feedback, keeps coverage honest.
- **Classicist (Detroit/Chicago) vs Mockist (London)** schools:
  - *Detroit/state-based:* test behavior via real collaborators, assert on resulting state. Fewer mocks, tests survive refactors, but failures less localized.
  - *London/interaction-based:* mock collaborators, assert on interactions. Highly isolated, drives outside-in design, but couples tests to implementation → brittle.
- TDD (Test-Driven Development) is a design tool, not a religion. It shines for logic with clear contracts; it's awkward for exploratory/UI/spike work. Many seniors do "test-after" or test-alongside for some code and strict TDD for tricky logic.

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
- **Behavior-focused:** test *what* (observable behavior/contract), not *how* (private internals), so tests survive refactors. Use **AAA (Arrange, Act, Assert)**. One logical assertion per test. Descriptive names that read as specifications.

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
- **TDD (Test-Driven Development) pragmatism:** can you discuss when TDD helps and when it doesn't?

---

## Quick-reference summary

- Build a **portfolio**: many fast unit, some integration, few E2E; shape it to where your bugs live. Avoid the ice-cream cone.
- **TDD (Test-Driven Development):** Red→Green→Refactor; a design tool, not dogma. Know London (mockist) vs Detroit (classicist).
- **Doubles:** dummy/stub/spy/mock/fake — prefer fakes/stubs; mocks only for real interactions; don't mock what you don't own.
- **Coverage** shows what's untested, not what's correct; **mutation testing** is a stronger signal; don't weaponize coverage gates.
- **Flaky tests:** root-cause (timing, shared state, real I/O), quarantine + fix, never blanket-retry.
- Good tests are **F.I.R.S.T. (Fast, Isolated, Repeatable, Self-validating, Timely)**, behavior-focused, and treated as production code.
