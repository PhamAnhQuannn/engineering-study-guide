# Design Patterns — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Creational/structural/behavioral, when NOT to use.

Each prompt frames a real choice. Give a reasoned recommendation and state **what would change the answer**.

---

### D1. Strategy (composition) vs Template Method (inheritance) for a multi-step ETL job with one variable step

**Options:** (A) Template Method — base class fixes `extract→transform→load`, subclasses override `transform`. (B) Strategy — inject a `Transformer` into a single ETL class. (C) Plain function passed as a parameter.

**Recommendation:** Default to **C/B (composition)**. If the only variation is the transform step and the language has first-class functions, pass the transform as a function — least ceremony, trivially testable, no inheritance coupling. If you need richer behavior or DI wiring, promote it to a Strategy interface. Reserve Template Method (A) for when several steps vary *together* and are genuinely owned by a base class with shared protected state.

**What would change the answer:** If multiple steps vary in a coordinated way and share base-class state/lifecycle, Template Method reduces duplication better. If you're in a codebase with a strong inheritance convention and frameworks built around it, matching the idiom may win.

---

### D2. Singleton via `getInstance()` vs DI-managed single instance vs module-level instance

**Options:** (A) Classic Singleton static accessor. (B) Single instance registered in a DI container, injected into consumers. (C) A module-level/package singleton object imported where needed.

**Recommendation:** Prefer **B (DI-managed)**. You still get exactly one instance, but dependencies are explicit in constructors, you can inject a fake in tests, and lifecycle/threading are container-managed. (C) is acceptable for stateless, dependency-free utilities (e.g. a pure formatter) in languages where module singletons are idiomatic. Avoid (A): it's hidden global state, untestable, and order-coupled.

**What would change the answer:** A tiny script or a truly stateless constant where test isolation doesn't matter — (C) or even (A) is fine and (B)'s wiring is overkill. In performance-critical hot paths where DI resolution adds overhead, a carefully managed module singleton may be chosen.

---

### D3. Decorator vs subclassing vs middleware list for cross-cutting concerns (logging, retry, caching) on a client

**Options:** (A) Decorator chain wrapping the client. (B) Subclass per concern combination. (C) A middleware/interceptor pipeline (Chain of Responsibility).

**Recommendation:** **A or C**, never B. If concerns are independent and you want arbitrary combinations, Decorator (A) composes cleanly with one wrapper per concern. If the framework already has an interceptor concept (HTTP clients, gRPC, Express-style middleware), use the pipeline (C) — it's the same idea with ordering built in and is idiomatic. Subclassing (B) explodes combinatorially and is the wrong tool.

**What would change the answer:** If concerns must share state or ordering is subtle and global, a single pipeline (C) with explicit ordering beats a deep decorator stack that's hard to trace. If there's exactly one concern and it'll never combine, just inline it (YAGNI) — no pattern.

---

### D4. Observer (in-process) vs message broker (out-of-process) for "when X happens, do Y and Z"

**Options:** (A) In-process Observer/event emitter. (B) External broker (Kafka/RabbitMQ) with subscribers. (C) Direct method calls.

**Recommendation:** If producer and consumers live in the **same process/service** and you just want decoupling, start with **A** (or even **C** if there's one consumer — don't over-decouple). Move to **B** when consumers are separate services, you need durability/replay, back-pressure, or independent scaling. Crossing a process boundary with in-process Observer is a mistake; crossing a module boundary in-process with a broker is over-engineering.

**What would change the answer:** Need for at-least-once delivery, retries, ordering guarantees, or cross-team service decoupling pushes hard to (B). A single synchronous consumer with strict ordering and no decoupling need pushes to (C).

---

### D5. Hand-written GoF pattern classes vs language features (lambdas, generators, records)

**Options:** (A) Full GoF class hierarchies (Command class, Iterator class, Strategy interface). (B) Language features — lambdas/closures for Command & Strategy, generators for Iterator, records/data classes for value objects.

**Recommendation:** Prefer **B** in modern languages. A lambda *is* a Strategy/Command; a generator *is* an Iterator; a record *is* an immutable value object. They carry less boilerplate, are easier to read, and convey the same intent. Reserve (A) for when the pattern needs *named, reusable, testable* units with multiple methods or rich state (a Command that supports `undo()` and serialization is a real class).

**What would change the answer:** If the team needs the pattern as explicit vocabulary in the type system, or the "behavior" has multiple operations/lifecycle (undo, audit, persistence), the class version (A) earns its weight. Legacy/older-language constraints can also force (A).

---

### D6. Visitor vs adding methods to each class vs a `switch`/pattern-match over a sealed type hierarchy

**Options:** (A) Visitor (double dispatch). (B) Put each operation as a method on every node class. (C) `switch`/pattern-match on a sealed/enum-like type.

**Recommendation:** Choose by **which axis changes more often**. If **operations** grow but the **node set is stable** (a finished AST gaining new analyses), Visitor (A) or a pattern-match (C, in languages with exhaustive sealed types) keeps each operation in one place. If **node types** grow but operations are few, put methods on the classes (B) so a new node implements them locally. Visitor's cost is exactly the reverse: adding a node type touches every visitor.

**What would change the answer:** A language with exhaustive sealed-type pattern matching makes (C) cleaner and compiler-checked, often beating Visitor's ceremony. A volatile node hierarchy flips the recommendation to (B).

---

### D7. Abstract Factory vs simple Factory Method vs direct `new` for object creation

**Options:** (A) Abstract Factory (families of related products). (B) Factory Method (one product, chosen by subtype/registry). (C) Just call the constructor directly.

**Recommendation:** Start with **C** — direct construction is the simplest and most readable; don't add a factory until creation logic is real (branching on config, expensive setup, multiple variants). Move to **B** when "which concrete type" is a decision worth centralizing. Reserve **A** for the specific case where you must produce *families* of objects that have to match (cross-platform UI widgets, DB driver families) and mixing them would be a bug.

**What would change the answer:** A real need to swap an entire coherent product family at once justifies Abstract Factory; a single varying product justifies Factory Method; one fixed type means no factory at all (YAGNI).
