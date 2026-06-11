# Design Principles — Practice Questions

[← Topic overview](../README.md)

> Topic: SOLID, DRY, YAGNI, coupling/cohesion.

A mix of factual recall, "explain to a junior," and multiple-choice. Try to answer before expanding.

---

### Q1. State the Single Responsibility Principle precisely. What does "responsibility" mean?

**Answer:** A module should have **one reason to change** — where a "reason" maps to a single actor or stakeholder whose evolving needs drive changes to that module. It is *not* "a class should do one thing." A `Payroll` class may do many computations, but if all of them answer to the finance team's rules, it has one reason to change. The classic violation is a class that, say, serves both the reporting team (formatting) and the operations team (persistence): two actors → two reasons → split it. The test: "If requirement X changes, does this module change? If requirement Y (owned by a different actor) changes, does it *also* change?" Two yeses on unrelated actors = SRP violation.

---

### Q2. Explain the Dependency Inversion Principle to a junior, with a concrete example.

**Answer:** Normally your business logic calls the database directly: `OrderService` *knows about* `PostgresOrderRepo`. That's backwards — your valuable business rules now depend on a swappable detail. DIP says: define an interface `OrderRepository` that lives next to your business logic and expresses what *it* needs (`save(order)`, `findById(id)`). The Postgres class *implements* that interface. Now the dependency arrow points *into* your domain: both the service and Postgres depend on the abstraction. Benefits: you can unit-test `OrderService` with a fake in-memory repo, swap Postgres for DynamoDB without touching business logic, and your core stays free of framework/DB imports. Note: DIP is the *principle*; dependency injection (passing the repo into the constructor) is just one way to wire it up.

---

### Q3. Is this a DRY violation? Two unrelated services each have a 5-line block that maps an HTTP request to a DTO, and the blocks happen to be identical today.

**Answer:** Not necessarily — and likely you should leave them duplicated. DRY is about a single source of truth for a piece of **knowledge/intent**, not about identical text. These two blocks are identical *by coincidence*; they belong to different services that will evolve for different reasons. If you extract a shared helper, you couple them: when service A's mapping needs a new field, you either fork the helper (re-introducing duplication anyway) or pollute it with a flag that service B must tolerate. Sandi Metz's rule applies: "duplication is far cheaper than the wrong abstraction." Wait for a *third* occurrence that reveals a genuine shared concept before abstracting.

---

### Q4. How can OCP and YAGNI appear to contradict each other? How do you reconcile them?

**Answer:** OCP pushes you to build extension seams (interfaces, strategies) so future behavior is added without modifying existing code. YAGNI tells you not to build for speculative requirements. They collide when you *predict* an extension axis and build the abstraction up front for a change that never arrives — that's speculative generality. Reconcile with the **Rule of Three / react-don't-predict**: write the concrete code first; when a *second real* variation appears, you now *know* the actual axis of change, so introduce the OCP seam then. You pay a small refactor cost once, in exchange for never carrying dead abstractions. OCP earns its keep on axes that have demonstrably changed; YAGNI guards everything else.

---

### Q5. Give a Liskov Substitution Principle violation that compiles fine but breaks at runtime.

**Answer:** The Rectangle/Square problem. `Square extends Rectangle` and overrides `setWidth(w)` to also set height (to preserve square-ness). Client code: `void grow(Rectangle r) { r.setWidth(5); r.setHeight(4); assert r.area() == 20; }`. Passing a `Square` breaks the assertion — setting height clobbered width, area is 16. It compiles because `Square` *is* a `Rectangle` by inheritance, but it is not a behavioral subtype: it strengthened the precondition (width must equal height) and broke the caller's invariant (dimensions independent). The fix is to not model Square as a subtype of mutable Rectangle — make both immutable, or use a common `Shape` with an `area()` and no independent setters.

---

### Q6. What is the Law of Demeter and when is it OK to "break" it?

**Answer:** A method should only call methods on: itself, its parameters, objects it creates, and its direct component objects — i.e. talk only to immediate friends. The point is to avoid `order.getCustomer().getAddress().getZip()` chains that hard-code knowledge of three other objects' internal structure; any of those structures changing ripples to you. Fixes: add a "tell, don't ask" method (`order.shipTo()`) so the order computes what's needed. **When it's fine to "break" it:** fluent builders (`builder.setX().setY().build()`), stream/collection pipelines, and immutable data-transfer objects where chaining is the intended API and there's no hidden coupling to mutable internal state. The principle targets *behavioral* coupling, not method chaining per se.

---

### Q7. Order these coupling types from worst to most acceptable, and define the top and bottom: content, data, control, common, stamp.

**Answer:** Worst → best: **content** > **common** > **control** > **stamp** > **data**.
- **Content coupling (worst):** module A reaches in and modifies module B's internal state/variables directly. Any change to B's internals breaks A invisibly.
- **Common coupling:** modules share global mutable state.
- **Control coupling:** A passes a flag that dictates B's control flow (`render(true)`), so A must know B's internals.
- **Stamp coupling:** passing a whole record when only a field is needed (callee now depends on the record's shape).
- **Data coupling (most acceptable):** passing exactly the primitive data the callee needs. This is the normal, healthy form.

---

### Q8 (MCQ). Which scenario most clearly violates the Interface Segregation Principle?

A. A class implements two small interfaces.
B. An interface has 12 methods; one implementer throws `NotSupportedException` for 6 of them.
C. A function takes 4 parameters.
D. A service depends on a repository interface.

**Answer: B.** ISP says clients shouldn't be forced to depend on methods they don't use. An implementer forced to stub half the methods with "not supported" is the textbook symptom of a fat interface that should be split into role interfaces. (A is fine, even encouraged. C is a different concern. D is normal/good DIP.)

---

### Q9 (MCQ). "Both high-level and low-level modules should depend on abstractions" is the statement of which principle?

A. Single Responsibility
B. Open/Closed
C. Dependency Inversion
D. Liskov Substitution

**Answer: C — Dependency Inversion Principle.** The full statement adds: abstractions should not depend on details; details should depend on abstractions.

---

### Q10 (MCQ). You find a helper function used in 6 places, each call passing a different combination of 5 boolean flags to toggle behavior. This is a sign of:

A. Healthy DRY
B. The "wrong abstraction" — over-DRYing distinct behaviors into one function
C. Good use of OCP
D. Proper ISP

**Answer: B.** A flag-laden shared function that each caller configures differently means you merged behaviors that aren't actually the same knowledge. The boolean parameters are control coupling and a smell. The fix is often to inline the helper back into callers and re-extract only the genuinely shared core.

---

### Q11. What is cohesion, and why is "temporal cohesion" considered weak?

**Answer:** Cohesion measures how strongly the responsibilities *within* a single module belong together. Functional cohesion (all parts contribute to one well-defined task) is best. **Temporal cohesion** groups code only because it runs at the same *time* — e.g. an `init()` method that opens a DB connection, seeds a cache, sets up logging, and reads config. These have nothing in common except "happens at startup." It's weak because the grouping gives you no help understanding or changing the system: a change to logging setup forces you into a method full of unrelated DB/cache concerns, and you can't reuse any one piece independently. Higher-cohesion design splits these into focused initializers each owned by their own module.

---

### Q12. A teammate says "we must make everything an interface for testability and future-proofing." How do you respond as a senior?

**Answer:** I'd push back on the blanket rule. Interfaces have real cost: indirection makes code harder to read and navigate ("which impl runs here?"), and an interface with exactly one implementation is usually speculative generality (YAGNI). Testability rarely requires interfaces for *pure* logic — you test that directly. Introduce a seam (interface/abstraction) where there's a genuine boundary: an external dependency (DB, network, clock, payment gateway) you must fake in tests, or an axis that has *already* varied. So my rule is: abstract at I/O boundaries and at proven points of change, keep internal collaborators concrete until a second implementation actually shows up. This keeps the code soft where it needs to be and simple everywhere else.
