# OOP & Functional — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: OOP, functional, immutability, generics.

> **🛒 Where we are in building ShopFast** — Last topic we went deep on the [Language & Runtime](../../01-language-deep-dive/01-knowledge/README.md) — type systems, the GIL (Global Interpreter Lock), GC (Garbage Collection), and the concurrency model the language hands us. Now we decide *how to structure the code that runs on that runtime*. OOP (Object-Oriented Programming) shapes how ShopFast's `catalog`, `cart`, and `order` modules hide their state and talk to each other. FP (Functional Programming) shapes how we process orders and transform data safely. **Next:** [Error Handling](../../03-error-handling/01-knowledge/README.md) — once the code is structured, we need to decide what happens when it goes wrong.

---

## Teaching arc: structuring ShopFast's code

### What it is

A **programming paradigm** is a style of organizing code — a set of rules for where state lives, how behavior is grouped, and how pieces compose. Think of it like the difference between building with LEGO bricks (OOP: self-contained objects that snap together) and building with pipes and filters (FP: data flows through a chain of transformations, emerging changed at the end).

Neither is universally better. Senior engineers reach for OOP when they have *stateful domain entities with invariants to protect* (a `Cart` that must never go negative, an `Order` that can only transition forward through valid states). They reach for FP when they have *data transformation pipelines* where immutability prevents the subtle aliasing bugs that appear when two threads touch the same cart at the same time.

### What it looks like

Here is the same ShopFast concept — "apply a discount to a cart" — written in both styles so the contrast is concrete:

```python
# OOP (Object-Oriented Programming) style — state lives inside the object
class Cart:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self._items: list[dict] = []      # ← hidden; callers can't corrupt it directly

    def add_item(self, product_id: str, price_cents: int, qty: int) -> None:
        # Invariant enforced HERE, not scattered across callers
        if qty <= 0:
            raise ValueError("Quantity must be positive")
        self._items.append({"product_id": product_id, "price": price_cents, "qty": qty})

    def apply_discount(self, pct: float) -> None:
        # Mutates in place — caller gets nothing back; object changed
        for item in self._items:
            item["price"] = int(item["price"] * (1 - pct))

    def total_cents(self) -> int:
        return sum(i["price"] * i["qty"] for i in self._items)
```

```python
# FP (Functional Programming) style — data flows through pure functions; no mutation
from dataclasses import dataclass, replace
from typing import Sequence

@dataclass(frozen=True)          # frozen=True → immutable after construction
class CartItem:
    product_id: str
    price_cents: int
    qty: int

def apply_discount(items: Sequence[CartItem], pct: float) -> list[CartItem]:
    # Pure function: same input → same output; original items never touched
    return [replace(item, price_cents=int(item.price_cents * (1 - pct)))
            for item in items]

def total_cents(items: Sequence[CartItem]) -> int:
    return sum(i.price_cents * i.qty for i in items)
```

### Implement it / see it in code

The real power of paradigm choice shows in **how modules talk to each other**. ShopFast's `order` module must use the catalog to fetch product prices — but it must not reach into catalog's database tables directly (that would couple the modules). OOP solves this with an interface; FP solves it with a function parameter:

```python
# OOP approach: program to an interface (abstraction), not an implementation
from abc import ABC, abstractmethod

class CatalogApi(ABC):                     # the interface — catalog module defines this
    @abstractmethod
    def get_price_cents(self, product_id: str) -> int: ...

class OrderService:
    def __init__(self, catalog: CatalogApi):  # depends on abstraction, not concrete class
        self._catalog = catalog

    def place_order(self, user_id: str, product_id: str, qty: int) -> dict:
        price = self._catalog.get_price_cents(product_id)  # catalog does its job
        total = price * qty
        # ... persist order ...
        return {"user_id": user_id, "total_cents": total}

# In tests: inject a FakeCatalog. In prod: inject the real PostgresCatalog.
# The order module never changes when catalog's implementation changes.
```

```python
# FP approach: pass the price-lookup as a function — same decoupling, less ceremony
from typing import Callable

def place_order(
    user_id: str,
    product_id: str,
    qty: int,
    get_price: Callable[[str], int],   # ← inject behavior as a function
) -> dict:
    total = get_price(product_id) * qty
    return {"user_id": user_id, "total_cents": total}

# In tests: pass a lambda. In prod: pass catalog.get_price_cents.
```

### Where it lives in real systems

**ShopFast's modular monolith** makes paradigm choice concrete:

1. **OOP protects the `Order` state machine.** An order transitions: `pending → confirmed → shipped → delivered`. The OOP encapsulation rule says: *only the `Order` object transitions its own state*. If you expose `order.status = "shipped"` as a public field, any caller can set nonsense states. Wrap it: `order.mark_shipped()` validates the transition and enforces invariants. This is the exact pattern that prevents double-charges — the `Order` object refuses to transition to `charged` if it is already `charged`.

2. **FP makes the pricing pipeline testable and safe under concurrency.** Applying promotions, taxes, and currency rounding to a cart is a data transformation. If each step is a pure function taking `Sequence[CartItem]` → `Sequence[CartItem]`, you can test each step in isolation, compose them freely, and run them in parallel without locks — there is no shared mutable state to race on. This matters because ShopFast's read-heavy catalog (50:1 read:write ratio) means many concurrent pricing reads.

3. **Composition over inheritance keeps the module seams clean.** The temptation is to make `DigitalOrder` extend `Order` and override `ship()`. The problem: every time `Order` adds a method, all subclasses break (fragile base class). Instead, compose: `Order` holds a `FulfillmentStrategy` object. A digital order gets a `DigitalFulfillment`; a physical order gets a `PhysicalFulfillment`. When ShopFast adds gift-card fulfillment, you add a new strategy, not a new subclass of `Order`.

4. **Generics let the cart repository stay type-safe without code duplication.** A `Repository<T>` that handles `save(entity: T)` and `find(id: str) -> Optional[T]` works for `Cart`, `Order`, and `Product` without repeating the Postgres wiring. Java erases the type at runtime (type erasure); Go 1.18+ monomorphizes or uses a dictionary dispatch. Either way, the interface is clean and the compiler checks your types.

### Types & differences

| Concept | OOP (Object-Oriented Programming) | FP (Functional Programming) |
|---|---|---|
| **Unit of reuse** | Class / object | Function |
| **Where state lives** | Encapsulated inside objects | Passed explicitly; "updated" copies returned |
| **Polymorphism mechanism** | Subtype dispatch (vtable) | Parametric + higher-order functions |
| **Error flow** | Exceptions thrown up the call stack | `Result`/`Either` returned as values |
| **Composition style** | Inheritance + delegation (has-a) | Function composition (`f ∘ g`) |
| **Concurrency story** | Locks protect shared mutable state | Immutability removes shared mutable state |
| **Reach for it when** | Stateful entities, invariants, plug-in seams | Data pipelines, transformations, concurrent reads |

**ADTs (Algebraic Data Types) bridge both worlds.** A `Result = Ok(value) | Err(error)` sum type (discriminated union in TypeScript, sealed class in Kotlin, enum in Rust) is OOP's polymorphism applied to FP's error-as-value idea. Pattern-matching forces exhaustive handling — you can't forget the `Err` case the way you forget a `try/catch`.

### Gotchas

| Pattern | The trap | ShopFast consequence |
|---|---|---|
| **Deep inheritance** | Fragile base class — changing `Order` breaks all subclasses | Adding a `refund()` method to `Order` silently changes behavior in `SubscriptionOrder` |
| **Mutable default args (Python)** | Shared across all calls at def-time | A cart shared between two users' requests — catastrophic data leak |
| **"Pure" function that secretly mutates** | Breaks referential transparency; concurrency bugs | Discount function that modifies the passed list in place corrupts concurrent pricing reads |
| **Deep recursion without TCO** | Stack overflow | TCO (Tail-Call Optimization) is not guaranteed in Python or the JVM — use explicit loops for large catalogs |
| **`.unwrap()` / unchecked cast everywhere** | Swallows the `Result`; runtime panic | Payment `Result` `.unwrap()`-ed in production → unhandled panic on payment failure |
| **Strategy pattern vs just a function** | Over-engineered OOP for a trivial transformation | A one-line discount rule does not need a `DiscountStrategy` class — pass a function |

---

## 1. Object-Oriented Programming

### The four pillars (and the nuance)
- **Encapsulation** — bundle state + behavior; hide invariants behind an interface so callers can't corrupt them. The real value is **invariant protection**, not just "private fields." Expose intent (`account.deposit(x)`), not data (`account.balance = x`).
- **Abstraction** — model the essential, hide the incidental. Program to interfaces, not implementations.
- **Inheritance** — reuse via an "is-a" hierarchy. **The most abused pillar.** Deep hierarchies are rigid and create the fragile-base-class problem. Prefer **composition over inheritance** for "has-a"/"uses-a."
- **Polymorphism** — one interface, many implementations.
  - *Subtype (runtime)*: virtual dispatch on the dynamic type.
  - *Parametric*: generics.
  - *Ad-hoc*: overloading / typeclasses.

### Key principles
- **SOLID** (covered in depth in Tier 6): SRP (Single Responsibility Principle), OCP (Open/Closed Principle), LSP (Liskov Substitution Principle), ISP (Interface Segregation Principle), DIP (Dependency Inversion Principle). For paradigms, **LSP** matters most — a subtype must be substitutable for its base without breaking callers (the classic Square/Rectangle violation).
- **Composition over inheritance** — assemble behavior from small parts (has-a) instead of deep type trees. Go and Rust deliberately omit class inheritance and lean on composition + interfaces/traits.
- **Law of Demeter** — talk to friends, not strangers (`a.getB().getC().doX()` is a smell).

### Method dispatch under the hood
- **vtables**: most OO (Object-Oriented) languages put virtual methods in a per-class table; a call indirects through it (one extra pointer hop). Final/non-virtual methods can be statically bound or inlined.
- **Python**: dynamic attribute lookup via the **MRO (Method Resolution Order**, C3 linearization) for multiple inheritance; everything is a dict lookup unless `__slots__` is used.
- **Go**: no inheritance; interface dispatch uses an itable (interface method table).

### Common pitfalls
- Inheritance for code reuse rather than genuine subtyping → fragile base class.
- "God objects" that violate SRP (Single Responsibility Principle).
- Anemic domain models (data bags + service layer) — debatable, but often a smell of leaked encapsulation.
- Diamond problem in multiple inheritance (resolved by MRO/C3 in Python; Java forbids it for classes, allows default-method conflicts in interfaces that you must resolve).

---

## 2. Functional Programming

### Core ideas
- **Pure functions** — output depends only on input; no side effects. Same input → same output. Enables memoization, parallelism, easy testing, and equational reasoning.
- **Referential transparency** — an expression can be replaced by its value without changing behavior. A direct consequence of purity.
- **Immutability** — data never changes after construction; "updates" produce new values. Eliminates whole classes of aliasing/concurrency bugs.
- **First-class & higher-order functions** — functions are values; pass them, return them, store them. `map`/`filter`/`reduce` are the workhorses.
- **Function composition** — build pipelines: `h = f ∘ g`.
- **Recursion** over mutation-driven loops; **TCO (Tail-Call Optimization)** where the runtime supports it (Scheme yes, Python/Java no — beware stack overflow).

### The FP toolkit
- **Closures** — functions that capture their lexical environment. The basis for currying, partial application, decorators, and stateful generators.
- **Currying / partial application** — transform `f(a, b)` into `f(a)(b)`; specialize functions by fixing arguments.
- **ADTs (Algebraic Data Types)** — sum types (tagged unions: `Result = Ok | Err`) and product types (tuples/records). Pattern matching destructures them exhaustively. Rust enums, Scala/Kotlin sealed classes, Haskell `data`, TS (TypeScript) discriminated unions.
- **Monads (the practical view)** — a pattern for sequencing computations in a context: `Optional`/`Maybe` (absence), `Result`/`Either` (errors), `Future`/`Promise` (async), `Stream` (collections). You don't need category theory; you need "flatMap chains computations and threads the context."
- **Functors** — anything you can `map` over.

### Immutability mechanics
- **Persistent data structures** — structural sharing means an "updated" copy shares most nodes with the original, so immutability isn't O(n) per change (Clojure, Scala, Immer for JS). 
- **`final`/`const`/`val`** make the *binding* immutable, not necessarily the object. True deep immutability needs immutable types all the way down.
- **Value objects / records** — `record` (Java), `data class` (Kotlin), `@dataclass(frozen=True)` (Python), structs (Go) for cheap immutable value semantics.

### Pitfalls
- Performance: naive immutability copies; use persistent structures or builders.
- Deep recursion without TCO (Tail-Call Optimization) → stack overflow (Python, JVM). Rewrite as iteration or use trampolining.
- "Pure" code that secretly does I/O or mutates captured state.

---

## 3. Generics / parametric polymorphism

Write code once that works for many types **without** losing type safety.

- **Type parameters & bounds**: `<T extends Comparable<T>>` (Java), `[T any]` / constraints (Go), trait bounds `<T: Ord>` (Rust).
- **Variance** (see Language Deep-Dive): covariance `? extends`, contravariance `? super`, invariance. The PECS mnemonic: **Producer Extends, Consumer Super**.
- **Implementation strategies**:
  - *Erasure* (Java): one runtime class, casts inserted. No runtime type info.
  - *Monomorphization* (Rust, C++): a specialized copy per concrete type — fast, larger binaries.
  - *Reification* (C#): generic type info preserved at runtime.
  - *Dictionary/stencil hybrid* (Go): shape-based stenciling.
- **Why it matters**: type-safe collections, reusable algorithms, fewer casts, fewer `Object`-typed bags.

---

## 4. Blending the paradigms

Modern languages are **multi-paradigm**. Idiomatic patterns:
- Immutable value objects with methods (OO encapsulation + FP immutability).
- Streams/LINQ/comprehensions: OO collections processed with FP combinators.
- Dependency injection (OO) + pure core / impure shell ("functional core, imperative shell").
- Strategy pattern (OO) is often just "pass a function" (FP).

**Decision heuristic:** use FP for transformations, pipelines, and concurrency-heavy logic where immutability pays off; use OO for stateful domain entities with invariants and for plug-in boundaries (interfaces). Avoid pattern-cargo-culting either way.

---

## 5. What interviewers probe

- "Composition vs inheritance — when and why?" (Expect fragile base class, LSP, has-a vs is-a.)
- "What makes a function pure, and why do you care?" (Testability, parallelism, referential transparency.)
- "Explain immutability's cost and how persistent data structures avoid it."
- "What is a monad, in practical terms?" (Sequencing in a context; `Optional`/`Result`/`Future`.)
- "How do generics work in your language at runtime?" (Erasure vs monomorphization.)
- "Is this design SOLID? Which principle does it violate?"
- Red flag they look for: dogmatism. Green flag: choosing per-problem with stated tradeoffs.

### Common misconceptions
- "OOP means inheritance." No — encapsulation + polymorphism are the load-bearing parts; inheritance is the most optional.
- "FP means no state." No — state is managed at the edges; the core is pure.
- "Immutable is always slower." Not with structural sharing.
- "`final`/`const` makes it immutable." Only the reference.
- "Monads are scary math." They're an interface for chaining contextual computations.

---

## Quick-reference summary

| Concept | OOP (Object-Oriented Programming) | FP (Functional Programming) |
|---|---|---|
| Unit of reuse | class / object | function |
| State | encapsulated, mutable | immutable, threaded explicitly |
| Polymorphism | subtype (vtable) | parametric + ad-hoc |
| Error flow | exceptions | `Result`/`Either` |
| Composition | inheritance / has-a | function composition |
| Concurrency story | locks around shared state | immutability removes shared mutable state |

**Anchor takeaways:** prefer composition over inheritance; protect invariants via encapsulation; pure + immutable code is easier to test and parallelize; generics give reuse without losing type safety; and the senior move is matching paradigm to problem, not to fashion.
