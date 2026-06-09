# Design Patterns — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Creational/structural/behavioral, when NOT to use.

Design patterns are **named, reusable solutions to recurring design problems** in a context. They're a *vocabulary* first (so a team can say "use a Strategy here" and be understood) and a *toolbox* second. The Gang of Four (GoF) catalog has 23 patterns in three families. The senior skill is not memorizing all 23 — it's recognizing the underlying force (varying behavior, decoupling creation, adapting interfaces) and knowing **when a pattern is overkill**.

---

## The three families

### Creational — *how objects get made* (decouple construction from use)
- **Factory Method** — a method (often overridden) decides which concrete class to instantiate. Callers depend on the abstract product.
- **Abstract Factory** — a factory of related factories; produces *families* of objects that must be used together (e.g. a `WidgetFactory` yielding matching `Button` + `Checkbox` for a theme).
- **Builder** — assemble a complex object step by step; avoids telescoping constructors and supports immutable objects with many optional fields.
- **Prototype** — create new objects by cloning an existing instance (useful when construction is expensive or the concrete type is decided at runtime).
- **Singleton** — exactly one instance, globally accessible. The most overused/abused pattern (see anti-patterns below).

### Structural — *how objects are composed* (assemble into larger structures)
- **Adapter** — wrap an incompatible interface to match what a client expects (the "wall plug adapter"). Integration glue.
- **Decorator** — wrap an object to add responsibilities dynamically, preserving the interface; stackable (e.g. `BufferedInputStream(GzipInputStream(FileInputStream))`). Composition-based alternative to subclass explosion.
- **Facade** — a single simplified interface over a complex subsystem.
- **Proxy** — a stand-in controlling access to a real object (lazy-loading, caching, remote, access control).
- **Composite** — treat individual objects and compositions uniformly via a tree (e.g. files and folders both implement `Node`).
- **Bridge** — split an abstraction from its implementation so both vary independently (avoids a combinatorial subclass matrix).
- **Flyweight** — share immutable intrinsic state across many objects to save memory (e.g. glyphs in a text editor).

### Behavioral — *how objects communicate / distribute responsibility*
- **Strategy** — encapsulate interchangeable algorithms behind a common interface; pick one at runtime. The cleanest answer to "a method full of `if/switch` on a type."
- **Observer** — subjects notify subscribers of state changes (pub/sub, event systems, reactive UIs).
- **Command** — package a request as an object (enables queue, undo/redo, logging, retry).
- **State** — object changes behavior when its internal state changes; replaces sprawling state-flag conditionals with state classes.
- **Template Method** — a base class fixes the algorithm skeleton; subclasses fill in specific steps.
- **Iterator** — sequential access to a collection without exposing its representation.
- **Chain of Responsibility** — pass a request along a chain of handlers until one handles it (middleware pipelines).
- **Mediator** — centralize complex many-to-many interactions in one object.
- **Visitor** — add operations to an object structure without modifying the classes (double dispatch); great when structure is stable but operations grow.
- **Memento** — capture/restore an object's state without violating encapsulation (snapshots).

---

## Patterns most asked at senior interviews (know these cold)

- **Strategy vs Template Method** — Strategy uses *composition* (inject the algorithm), Template Method uses *inheritance* (override hook methods). Prefer Strategy for flexibility/testability; Template Method when steps are tightly coupled to a fixed skeleton.
- **Decorator vs Inheritance** — Decorator adds behavior at runtime and composes; inheritance is static and explodes combinatorially (`BufferedGzipEncryptedStream`…).
- **Adapter vs Facade** — Adapter changes *one* interface to match an expectation; Facade *simplifies* a whole subsystem behind a new, smaller interface.
- **Proxy vs Decorator** — same structure (wrap + same interface), different *intent*: Proxy controls *access*; Decorator *adds* behavior.
- **Factory vs Builder** — Factory decides *which* type; Builder controls *how* a single complex instance is assembled step by step.
- **Observer vs Pub/Sub** — Observer typically has direct subject→observer references; pub/sub adds a broker/event-bus for full decoupling.

---

## When NOT to use patterns (the senior differentiator)

- **Patternitis / cargo-culting:** applying a pattern because it's "best practice," not because a force demands it. A `FactoryFactory` for one product is comedy, not architecture.
- **Singleton as global state:** hides dependencies (a class secretly reaches for `Logger.getInstance()`), wrecks testability (shared state across tests, hard to mock), and creates lifecycle/threading hazards. Prefer dependency injection of a single instance managed by a container.
- **Premature Strategy/Visitor:** if there's exactly one algorithm today and no second on the horizon, a plain function beats an interface + class. (YAGNI.)
- **Pattern over language feature:** many GoF patterns exist to compensate for older OO languages. In modern languages a first-class function *is* a Strategy/Command; a closure *is* a lightweight object; iterators/generators are built in. Don't hand-roll a `Command` class where a lambda suffices.
- **Readability cost:** each pattern adds indirection. If the indirection doesn't buy decoupling you actually need, it's pure cost for the next reader.

Rule of thumb: introduce a pattern to **resolve a force that has already appeared** (a real second variant, a real testability pain), not to decorate the design.

---

## Key terms

- **Intent** — the problem a pattern solves; patterns are distinguished by intent, not structure (Proxy vs Decorator look identical structurally).
- **Participants** — the roles (e.g. Strategy: `Context`, `Strategy` interface, `ConcreteStrategy`).
- **Double dispatch** — selecting behavior based on two runtime types; the mechanism behind Visitor.
- **Inversion of Control (IoC)** — the framework calls your code (Template Method, Observer, DI containers); "don't call us, we'll call you."
- **Anti-pattern** — a commonly-reached-for "solution" that causes more harm than good (God object, Singleton-as-global, anemic domain model).

---

## Tradeoffs cheat sheet

| Pattern | Buys you | Costs you |
|---|---|---|
| Strategy | Swap algorithms, testable, no big switch | More types; indirection |
| Decorator | Compose behavior at runtime | Many small wrappers; debugging stacks |
| Adapter | Integrate incompatible code | Extra layer; can mask a bad interface |
| Observer | Decoupled events | Hard-to-trace control flow; memory leaks (unremoved listeners) |
| Singleton | One instance | Global state, hidden deps, test pain |
| Factory/Abstract Factory | Decouple creation, swap families | Indirection; can be overkill |
| Visitor | Add ops without touching classes | Adding a new *element* type touches every visitor |

---

## What interviewers probe

- **Can you map a *symptom* to a pattern?** "A method has a giant `switch` on `type` that grows every release" → Strategy or polymorphism.
- **Intent over structure:** asked the difference between Proxy and Decorator (identical structure, different intent).
- **When NOT to use it** — do you reach for Singleton reflexively? Do you over-abstract?
- **Modern alternatives:** "Could a first-class function replace this Command/Strategy class?"
- **Refactor live:** "Here's nested conditionals — refactor with State." They watch whether you over-engineer.
- **Pattern tradeoffs:** every pattern adds indirection; can you name the cost?

---

## Quick-reference summary

- Three families: **Creational** (make objects), **Structural** (compose objects), **Behavioral** (communicate/assign responsibility).
- Patterns are **vocabulary + reusable solutions**, distinguished by **intent**, not structure.
- High-yield: **Strategy, Decorator, Adapter, Factory, Observer, Builder, State**.
- Same structure, different intent: **Proxy vs Decorator**, **Adapter vs Facade**.
- **Composition over inheritance:** Strategy/Decorator beat subclass explosions.
- **When NOT to:** patternitis, Singleton-as-global, premature abstraction, hand-rolling what a lambda/closure already gives you.
- Apply a pattern to **resolve a force that already appeared**, never to decorate.
