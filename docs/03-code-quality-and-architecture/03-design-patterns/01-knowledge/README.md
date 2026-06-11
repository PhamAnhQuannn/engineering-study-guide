# Design Patterns — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Creational/structural/behavioral, when NOT to use.

Design patterns are **named, reusable solutions to recurring design problems** in a context. They're a *vocabulary* first (so a team can say "use a Strategy here" and be understood) and a *toolbox* second. The Gang of Four (GoF) catalog has 23 patterns in three families. The senior skill is not memorizing all 23 — it's recognizing the underlying force (varying behavior, decoupling creation, adapting interfaces) and knowing **when a pattern is overkill**.

> **🛒 Where we are in building ShopFast** — Last topic we applied [Design Principles](../../01-design-principles/01-knowledge/README.md) to give `catalog`, `cart`, and `order` clean seams. Now we name the recurring *shapes* those seams take: this topic shows the GoF patterns that keep ShopFast's module boundaries stable as new requirements arrive. **Next:** [Testing](../../03-testing/01-knowledge/README.md) — those clean seams only pay off if we can verify them with a fast test suite.

---

## Teaching arc: naming the shapes in ShopFast

### What it is

A **design pattern** is a *named, context-specific solution to a recurring design force*. "Force" means the pressure that makes naive code break — a growing `switch` that gains a case every release, an unstable third-party interface you must adapt, a payment flow that must be queued and retried.

Think of patterns as Lego connector pieces: you don't invent a new way to join bricks every time — you reach for the standard click connector. The value is **shared vocabulary** (your whole team knows what "Strategy" means) plus a **proven structure** (it has known costs and tradeoffs).

The GoF catalog has three families:

```
Creational   ← HOW objects are made        (decouple construction from use)
Structural   ← HOW objects are composed    (assemble into larger structures)
Behavioral   ← HOW objects communicate     (distribute responsibility)
```

### What it looks like

A ShopFast scenario before/after two of the highest-yield patterns — **Strategy** (behavioral) and **Adapter** (structural):

```
BEFORE — a switch that grows every time a new payment provider arrives:

  checkoutService.pay(order, "stripe")   → if type=="stripe" use Stripe SDK
                                         → if type=="paypal" use PayPal SDK
                                         → adding Klarna = edit this switch + retest all cases

AFTER — Strategy pattern: new provider = new class, zero edits to checkout:

  <<interface>>           StripeGateway
  PaymentGateway  ◄──────  PayPalGateway
  + charge(order)  ◄──────  KlarnaGateway
        ▲
        │ inject
  CheckoutService           ← never changes when a new provider is added
```

```
BEFORE — OrderService talks directly to a third-party shipping SDK that changes its API:

  OrderService → ShipFastSdk.createShipment(...)   ← breaks if SDK updates

AFTER — Adapter: wrap the vendor behind YOUR interface:

  OrderService → ShippingPort (your interface) → ShipFastAdapter → ShipFastSdk
                                               → DHLAdapter     → DhlSdk
  OrderService is immune to vendor API changes.
```

### The code that builds it

**Strategy pattern** applied to ShopFast's payment flow:

```typescript
// The interface (the "strategy contract") — owned by ShopFast, not any vendor
interface PaymentGateway {
  charge(orderId: string, amountCents: number): Promise<ChargeResult>;
}

// Concrete strategies — one file per provider; adding Klarna = new file only
class StripeGateway implements PaymentGateway {
  async charge(orderId: string, amountCents: number) {
    return this.stripeClient.paymentIntents.create({ amount: amountCents, ... });
  }
}

class PayPalGateway implements PaymentGateway {
  async charge(orderId: string, amountCents: number) {
    return this.paypalClient.orders.capture({ id: orderId, ... });
  }
}

// Context — CheckoutService never imports Stripe or PayPal directly
class CheckoutService {
  constructor(private gateway: PaymentGateway) {}  // injected — swappable

  async checkout(order: Order) {
    const result = await this.gateway.charge(order.id, order.totalCents);
    if (!result.success) throw new PaymentFailedError(result.error);
    await this.orderRepo.markPaid(order.id);
  }
}
```

**Adapter pattern** wrapping an external shipping SDK:

```typescript
// Your stable interface — what the order module depends on
interface ShippingPort {
  createShipment(orderId: string, address: Address): Promise<TrackingNumber>;
}

// Adapter wraps the messy third-party SDK
class ShipFastAdapter implements ShippingPort {
  async createShipment(orderId: string, address: Address) {
    // translate YOUR domain types → SDK types
    const res = await this.sdk.ship({
      ref: orderId,
      destination: { street: address.line1, city: address.city },  // SDK uses different shape
    });
    return res.trackingId;   // translate SDK response → your domain type
  }
}
```

### The code that calls it / uses it

How the composition root wires a Strategy or swaps it for tests:

```typescript
// production wiring — real gateway
const checkoutService = new CheckoutService(new StripeGateway(stripeClient));

// test wiring — fake gateway, no network, no money moved
class FakePaymentGateway implements PaymentGateway {
  async charge() { return { success: true }; }  // always succeeds
}
const checkoutService = new CheckoutService(new FakePaymentGateway());

// test: what happens when payment fails?
class AlwaysFailGateway implements PaymentGateway {
  async charge() { return { success: false, error: "card_declined" }; }
}
```

### Types & differences

**GoF pattern catalog — reach-for guide:**

| Family | Pattern | One-line intent | Reach for it when |
|---|---|---|---|
| Creational | **Factory Method** | Method decides which concrete class to make | You need to swap *which* type, not *how* to build it |
| Creational | **Builder** | Assemble complex object step by step | Many optional fields; avoid telescoping constructors |
| Creational | **Singleton** | One global instance | Rarely — prefer DI of a single instance; see anti-patterns |
| Structural | **Adapter** | Wrap incompatible interface to match expectation | Integrating a third-party SDK or legacy code |
| Structural | **Decorator** | Wrap object to add behavior, preserving interface | Adding cross-cutting behavior (logging, caching) without subclassing |
| Structural | **Facade** | Single simplified interface over a complex subsystem | Hiding a noisy subsystem behind a clean entry point |
| Structural | **Proxy** | Stand-in controlling access to the real object | Lazy loading, access control, caching, remote objects |
| Behavioral | **Strategy** | Interchangeable algorithms behind a common interface | A method full of `if/switch` on type that grows each release |
| Behavioral | **Observer** | Subjects notify subscribers of state changes | Event systems, reactive UIs, decoupled side-effects |
| Behavioral | **Command** | Package a request as an object | Queue, undo/redo, retry, audit log |
| Behavioral | **State** | Object changes behavior when internal state changes | Replacing sprawling state-flag conditionals |
| Behavioral | **Chain of Responsibility** | Pass request along handlers until one handles it | Middleware pipelines, plugin chains |

**Same structure, different intent — classic interview trap:**

| Pair | Structure | Intent differs |
|---|---|---|
| **Proxy vs Decorator** | Both wrap + same interface | Proxy controls *access*; Decorator *adds* behavior |
| **Adapter vs Facade** | Both wrap something | Adapter changes *one* interface to match; Facade *simplifies* a whole subsystem |
| **Factory vs Builder** | Both create objects | Factory decides *which* type; Builder controls *how* a single complex instance is assembled |
| **Observer vs Pub/Sub** | Both notify | Observer has direct subject→observer refs; Pub/Sub adds a broker for full decoupling |
| **Strategy vs Template Method** | Both vary an algorithm | Strategy uses *composition* (inject); Template Method uses *inheritance* (override) |

### How ShopFast applies it

**Strategy — payment providers:**

ShopFast is pre-launch with Stripe as the only payment provider. YAGNI (You Aren't Gonna Need It) says don't abstract yet. But: the checkout flow is tested, PCI (Payment Card Industry) compliant, and sensitive. When the business adds PayPal six months later, the Strategy pattern means a new `PayPalGateway` file is the *entire* change — the checkout flow is not edited and its tests do not change. OCP (Open/Closed Principle) in practice.

**Adapter — the `CatalogApi` interface:**

ShopFast's `order` module depends on `CatalogApi`, an interface it owns. The `catalog` module provides `CatalogApiImpl`. This is simultaneously DIP (Dependency Inversion Principle) and an Adapter boundary: if catalog's data source changes from Postgres to Elasticsearch, only `CatalogApiImpl` changes. The order module is completely unaware.

**Observer — order-placed events:**

When `POST /v1/orders` creates an order, side-effects (send confirmation email, decrement inventory, post analytics event) must not slow down the checkout response. ShopFast pushes an `order.placed` event to a queue; email, inventory, and analytics workers observe and process asynchronously. That's Observer/Pub-Sub: the `OrderService` (subject) emits an event; workers (observers) subscribe. Adding a new side-effect (e.g. loyalty points) = a new worker, zero changes to `OrderService`.

**Builder — order assembly:**

An `Order` has many optional fields: discount code, gift message, split shipping address, loyalty points applied. A Builder avoids a constructor with 8 optional parameters:

```typescript
const order = new OrderBuilder()
  .forUser(userId)
  .withItem(productId, qty)
  .withDiscountCode("SAVE10")    // optional
  .withGiftMessage("Happy B-Day") // optional
  .build();                       // validates and produces immutable Order
```

> **If you skip patterns:** adding a second payment provider requires editing the checkout switch statement — tested, PCI-sensitive code changes for an unrelated reason. Every new event side-effect bloats `OrderService`. Each added vendor SDK ships untested integration glue directly inside business logic. The codebase becomes a place where a small feature request means a large, risky change.

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
- **Premature Strategy/Visitor:** if there's exactly one algorithm today and no second on the horizon, a plain function beats an interface + class. (YAGNI — You Aren't Gonna Need It.)
- **Pattern over language feature:** many GoF patterns exist to compensate for older OO languages. In modern languages a first-class function *is* a Strategy/Command; a closure *is* a lightweight object; iterators/generators are built in. Don't hand-roll a `Command` class where a lambda suffices.
- **Readability cost:** each pattern adds indirection. If the indirection doesn't buy decoupling you actually need, it's pure cost for the next reader.

Rule of thumb: introduce a pattern to **resolve a force that has already appeared** (a real second variant, a real testability pain), not to decorate the design.

---

## Key terms

- **Intent** — the problem a pattern solves; patterns are distinguished by intent, not structure (Proxy vs Decorator look identical structurally).
- **Participants** — the roles (e.g. Strategy: `Context`, `Strategy` interface, `ConcreteStrategy`).
- **Double dispatch** — selecting behavior based on two runtime types; the mechanism behind Visitor.
- **IoC (Inversion of Control)** — the framework calls your code (Template Method, Observer, DI containers); "don't call us, we'll call you."
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
