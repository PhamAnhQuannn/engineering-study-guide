# OOP & Functional — Practice Questions

[← Topic overview](../README.md)

> Topic: OOP, functional, immutability, generics.

A mix of factual recall, "explain to a junior," and MCQs. Answer first, then check.

---

### Q1. Why is "composition over inheritance" usually the right default?

**Answer:** Inheritance couples a subclass to its parent's implementation, creating the **fragile base class** problem: a change in the base ripples unpredictably into subclasses, and deep hierarchies become rigid. It also forces an "is-a" relationship that often doesn't truly hold (Square is-a Rectangle breaks LSP). **Composition** ("has-a"/"uses-a") assembles behavior from small, swappable parts, is easier to test (inject collaborators), avoids the diamond problem, and adapts to change. Use inheritance only for genuine subtype substitutability; reach for composition + interfaces otherwise. Go and Rust drop class inheritance entirely for this reason.

---

### Q2. What is a pure function, and name three concrete benefits.

**Answer:** A pure function's return value depends only on its arguments and it has **no observable side effects** (no I/O, no mutation of external/shared state). Benefits: (1) **testability** — no setup/mocks, same input always yields same output; (2) **parallelism** — no shared mutable state means no data races; (3) **referential transparency** — you can cache/memoize results and reason about code by substitution. Bonus: easier debugging, since behavior is local.

---

### Q3. Explain immutability's performance cost and how persistent data structures address it.

**Answer:** Naive immutability copies the whole structure on every "update," which is O(n) in time and memory. **Persistent data structures** use **structural sharing**: the new version shares all unchanged nodes with the old one and only allocates the path to the changed node. For a balanced tree that's O(log n) per update instead of O(n). Libraries: Clojure's vectors/maps, Scala's immutable collections, Immer/Immutable.js in JS. So "immutable = slow" is a misconception when the right structures are used.

---

### Q4. "Explain to a junior": what does `final` (Java) / `const` (JS) actually guarantee?

**Answer:** It makes the **binding** immutable — you can't reassign the variable to point at a different object. It does **not** make the object itself immutable. `final List<Integer> xs = new ArrayList<>(); xs.add(1);` is perfectly legal — you can't do `xs = ...`, but you can mutate the list. For true immutability you need an immutable type (`List.of(...)`, `Collections.unmodifiableList`, a `record`, or a frozen object). Same in JS: `const obj = {}` lets you do `obj.x = 1`; use `Object.freeze` for shallow immutability.

---

### Q5. What is a monad, in practical engineering terms? Give two everyday examples.

**Answer:** A monad is a type that wraps a value in some **context** and provides a way to **chain** computations that produce more wrapped values, threading the context automatically. Practically: it's an interface with `of`/`unit` (wrap) and `flatMap`/`bind` (chain). Examples: `Optional`/`Maybe` threads the "value might be absent" context so you don't null-check at every step; `Result`/`Either` threads error short-circuiting; `Promise`/`Future` threads asynchrony; `Stream` threads "many values." You use them daily without the jargon — `optional.flatMap(...).map(...)` is monadic composition.

---

### Q6. What does the Liskov Substitution Principle require, and give a classic violation.

**Answer:** Objects of a subtype must be usable **anywhere** the supertype is expected, without changing correctness — subclasses must honor the base's contract (preconditions no stronger, postconditions no weaker, invariants preserved). Classic violation: `Square extends Rectangle`. A `Rectangle` lets you set width and height independently; if `Square` overrides setters to keep sides equal, code that does `r.setWidth(5); r.setHeight(4); assert area == 20` breaks when `r` is a `Square`. The "is-a" was modeling-correct but behaviorally wrong.

---

### Q7. PECS — what does it mean and when do you use it?

**Answer:** **Producer Extends, Consumer Super**, a Java generics/variance mnemonic. If a parameterized type *produces* values you read out, use `? extends T` (covariant): `List<? extends Number>` lets you read `Number`s. If it *consumes* values you write in, use `? super T` (contravariant): `List<? super Integer>` lets you add `Integer`s. If you both read and write, use an exact type `List<T>` (invariant). It maximizes the API's flexibility while staying type-safe.

---

### Q8 (MCQ). Which is **not** one of the classic four pillars of OOP?

- A. Encapsulation
- B. Inheritance
- C. Recursion
- D. Polymorphism

**Answer: C.** Recursion is a general programming technique, central to FP, not an OOP pillar. The four pillars are encapsulation, abstraction, inheritance, polymorphism.

---

### Q9 (MCQ). Referential transparency means:

- A. Variables are passed by reference.
- B. An expression can be replaced by its value without changing program behavior.
- C. References are garbage collected.
- D. Code is transparent to the debugger.

**Answer: B.** It's a property of pure expressions: substituting the expression with its computed value is behavior-preserving, which enables memoization and equational reasoning.

---

### Q10 (MCQ). Java generics use which implementation strategy?

- A. Monomorphization (a copy per concrete type)
- B. Reification (runtime type info preserved)
- C. Type erasure (one runtime class, casts inserted)
- D. Dynamic typing

**Answer: C.** Java erases type parameters at runtime, so `List<String>` and `List<Integer>` share a class and there's no runtime type info. Rust/C++ monomorphize (A); C# reifies (B).

---

### Q11. When would you deliberately choose OOP over FP for a module?

**Answer:** When you have **stateful domain entities with invariants** that must be protected behind an interface (an `Account` enforcing non-negative balance, an `Order` state machine), or when you need **plug-in polymorphism at a boundary** (a `PaymentGateway` interface with many implementations injected at runtime). OOP's encapsulation and subtype polymorphism shine here. Conversely, for **data transformations and pipelines** (parsing, ETL, aggregations) and concurrency-heavy logic, FP's purity and immutability are cleaner. Mature designs blend both: "functional core, imperative shell."

---

### Q12. What is the diamond problem and how do languages resolve it?

**Answer:** With multiple inheritance, if class D inherits from B and C, which both inherit from A and both override a method, which version does D get? Resolutions: **Python** uses the **MRO** via C3 linearization (a deterministic order) so `super()` follows a single chain; **Java** forbids multiple class inheritance but allows multiple interfaces — if two interfaces provide conflicting *default* methods, the compiler forces you to override and disambiguate explicitly; **C++** requires `virtual` inheritance to avoid duplicate base subobjects. Composition sidesteps the whole problem.
