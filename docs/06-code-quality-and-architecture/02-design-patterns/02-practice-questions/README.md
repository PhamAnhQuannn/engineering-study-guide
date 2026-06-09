# Design Patterns — Practice Questions

[← Topic overview](../README.md)

> Topic: Creational/structural/behavioral, when NOT to use.

---

### Q1. Proxy and Decorator have the same structure (wrap an object, expose the same interface). What distinguishes them?

**Answer:** **Intent.** Both hold a reference to a wrapped object and implement the same interface, but they exist for different reasons:
- **Decorator** *adds or augments behavior* — logging, buffering, encryption — layered and stackable. The client *wants* the extra behavior.
- **Proxy** *controls access* to the real object — lazy instantiation, caching, access control, remote calls. The client ideally doesn't know the proxy is there; behavior is meant to be transparent.

Patterns are classified by intent, not by code shape — this is the canonical example of why.

---

### Q2. Explain the Strategy pattern to a junior and contrast it with Template Method.

**Answer:** Strategy says: instead of hard-coding one algorithm inside a class, define an interface for "the algorithm" and inject which concrete one to use. Example: a `PriceCalculator` takes a `DiscountStrategy`; you can pass `BlackFridayDiscount` or `LoyaltyDiscount` without touching the calculator. It uses **composition** — you plug behavior in.

Template Method solves a similar "swap a step" problem but with **inheritance**: a base class defines the algorithm skeleton (`processFile()` calls `open()`, `parse()`, `close()` in order) and subclasses override the variable steps. The skeleton is fixed; only the hooks change.

Pick Strategy when you want runtime flexibility, easy testing (inject a fake), and to avoid inheritance coupling. Pick Template Method when the steps are tightly bound to a fixed sequence owned by the base class.

---

### Q3. Why is Singleton often called an anti-pattern? When is one instance still fine?

**Answer:** The problem isn't "one instance" — it's the *classic Singleton implementation* (`getInstance()` static accessor):
- It's **global mutable state** in disguise, so distant code becomes coupled and order-dependent.
- It **hides dependencies**: a class that calls `Config.getInstance()` doesn't declare that it needs Config, so you can't tell from its signature and can't inject a fake.
- It **breaks tests**: shared state leaks across test cases; mocking a static is painful.
- Threading/lifecycle hazards (double-checked locking bugs, init order).

Having exactly one instance is often legitimate (a connection pool, a metrics registry). The fix is to make it a *normal object* whose single lifecycle is managed by a DI container and **injected** into consumers, rather than fetched via a static. Same "one instance," no global-state pathology.

---

### Q4. A service method has a `switch(paymentType)` with 6 branches, and it grows every time we add a payment provider. Which patterns address this and how?

**Answer:** This is an Open/Closed violation begging for **Strategy** (or plain **polymorphism**). Define a `PaymentProcessor` interface with `process(payment)`; implement `CardProcessor`, `PayPalProcessor`, etc. Replace the switch with a lookup (a `Map<PaymentType, PaymentProcessor>` or a **Factory** that returns the right processor). Adding a provider now means adding a class and registering it — no edit to the dispatch logic. If selection logic is complex, a **Factory Method/Abstract Factory** can own the "which processor" decision. The result: the conditional disappears and each provider is independently testable.

---

### Q5. What is the Decorator pattern good for that subclassing is bad at? Give an example.

**Answer:** Decorator adds responsibilities *at runtime* and *composes* them, avoiding the combinatorial subclass explosion you'd get from inheritance. Example: Java I/O streams — you want optional buffering, gzip, and encryption in any combination. With inheritance you'd need `BufferedStream`, `GzipStream`, `BufferedGzipStream`, `EncryptedBufferedGzipStream`… (2^n classes). With Decorator you stack wrappers: `new EncryptedStream(new GzipStream(new BufferedStream(raw)))`. Each decorator implements the same `Stream` interface and adds one behavior. You can mix and match freely, choose at runtime, and add a new behavior by writing one new decorator instead of N new subclasses.

---

### Q6. Adapter vs Facade — what's the difference?

**Answer:** Both put a layer in front of existing code, but:
- **Adapter** makes *one* existing interface match a *different* expected interface so an otherwise-incompatible client can use it. Intent: convert/translate. (e.g. wrap a 3rd-party `LegacyLogger` so it satisfies your `Logger` interface.)
- **Facade** provides a *new, simpler* interface over a *whole complex subsystem* to reduce client coupling and cognitive load. Intent: simplify. (e.g. an `OrderFacade.placeOrder()` that hides inventory, payment, shipping, and notification subsystems.)

Adapter usually wraps one object and doesn't simplify; Facade fronts many and deliberately simplifies.

---

### Q7. When is the Observer pattern a poor choice, and what are its failure modes?

**Answer:** Observer decouples subjects from subscribers, but the costs are real:
- **Hard-to-follow control flow:** a single `setState()` can fan out to dozens of observers, making the execution path implicit and hard to debug.
- **Memory leaks / "lapsed listener":** observers that aren't unregistered keep the subject (or themselves) alive — a classic leak, especially in GUIs.
- **Ordering and reentrancy bugs:** observers firing during notification can mutate the subject and trigger cascades or infinite loops.

It's a poor choice when you need predictable, ordered, synchronous flow or when there's exactly one consumer (just call it directly). For cross-service decoupling, a proper message broker/event bus with explicit subscriptions is safer than in-process Observer.

---

### Q8 (MCQ). You need to add several new *operations* over a fixed tree of node types (e.g. an AST), without modifying the node classes. Which pattern fits best?

A. Strategy
B. Visitor
C. Singleton
D. Adapter

**Answer: B — Visitor.** Visitor lets you add operations (type-check, pretty-print, optimize) to a stable object structure via double dispatch, without editing each node class. Caveat that interviewers love: Visitor makes adding a *new node type* painful (every visitor must change), so it's ideal only when the structure is stable but operations grow.

---

### Q9 (MCQ). Which statement about the Builder pattern is most accurate?

A. It decides which subclass to instantiate at runtime.
B. It controls access to an expensive object.
C. It assembles a complex object step by step, useful for many optional fields and immutability.
D. It shares immutable state across many instances to save memory.

**Answer: C.** Builder assembles a complex object incrementally, avoiding telescoping constructors and enabling immutable objects with many optional parameters. (A is Factory, B is Proxy, D is Flyweight.)

---

### Q10 (MCQ). A teammate wraps every dependency in a Singleton "for easy access anywhere." The biggest concrete problem at code-review time is:

A. It uses too much memory.
B. It introduces hidden global state and untestable hard-coded dependencies.
C. It violates the Iterator pattern.
D. It always causes deadlocks.

**Answer: B.** The defining harm of Singleton-as-global is hidden dependencies and global mutable state, which destroy testability and make coupling implicit. (Memory isn't the issue; deadlocks are only a risk with bad locking; Iterator is unrelated.)

---

### Q11. Many GoF patterns are "less necessary" in modern languages. Give two examples.

**Answer:** (1) **Strategy / Command** in languages with first-class functions: instead of an interface + concrete classes, you pass a function/lambda or closure. `sort(items, byPriceDescending)` is a Strategy; `queue.add(() -> sendEmail(user))` is a Command — no boilerplate class hierarchy. (2) **Iterator** is built into most languages (generators, `for...of`, `IEnumerable`, range-based loops), so you rarely implement the GoF Iterator by hand. Others: **Singleton** is often replaced by a DI container's lifetime management, and **Template Method**'s hook-overriding can be done by passing higher-order functions. The patterns' *intent* is still valuable vocabulary; the heavyweight class machinery often isn't needed.

---

### Q12. How do you decide whether to introduce a pattern at all?

**Answer:** I ask whether a concrete **force** is already present that the pattern resolves: a real second variant of an algorithm (Strategy), a genuine need to add behavior at runtime (Decorator), an actual incompatible interface to integrate (Adapter), real test pain from a hard dependency (DIP/seams). If the force is hypothetical, I default to the simplest direct code (YAGNI) because every pattern adds indirection that the next reader pays for. I also weigh the *cost axis*: Visitor is great until node types change; Observer is great until flow becomes untraceable. So the decision is: name the force, confirm it's real and recurring, check the pattern's specific downside doesn't bite my situation, then apply the lightest mechanism (often a function before a full class hierarchy).
