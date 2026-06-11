# Language Deep-Dive — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Idioms, type system, runtime model, gotchas.

> **🛒 Where we are in building ShopFast** — Last topic we tackled [Concurrency Basics](../../../01-fundamentals/05-concurrency-basics/01-knowledge/README.md) — threads, locks, and async patterns. This topic goes one level deeper: the *language* itself. Understanding Python's GC (Garbage Collection), the GIL (Global Interpreter Lock), and the type system tells you *why* a bug happens at checkout or *why* the catalog endpoint saturates a single core. **Next:** [Paradigms](../../02-paradigms/01-knowledge/README.md) — once you know the runtime, you choose how to structure code on top of it.

---

## Teaching arc: the language underneath ShopFast

### What it is

A **programming language's runtime model** is the set of rules that turn source code into running behavior — how values are typed, how memory is managed, how threads are scheduled, and how function calls move data. Think of it like the rulebook for a board game: you can play without reading it, but you'll make illegal moves and lose in surprising ways. Knowing the rulebook lets you *predict* behavior instead of guess.

ShopFast's backend is written in a mainstream language (the curriculum uses Python, Java, Go, and JS/TypeScript examples throughout). Every concrete performance, correctness, or concurrency decision you'll make traces back to these rules.

### What it looks like

The same logical operation — "add two things" — behaves completely differently depending on the language's type system and runtime:

```python
# Python (dynamic, strong typing)
price_cents = 1999
label = "Price: "
# label + price_cents → TypeError: can only concatenate str (not "int") to str
# Python is STRONG: it won't silently coerce int→str for you
result = label + str(price_cents)   # you must be explicit

# A subtler trap: mutable default argument — evaluated ONCE at definition time
def add_to_cart(item, cart=[]):     # ← BUG: 'cart' is shared across ALL calls
    cart.append(item)
    return cart
```

```java
// Java (static, strong, nominal typing + JIT compilation)
int priceCents = 1999;
// Integer cache gotcha: autoboxing to Integer
Integer a = 127;  Integer b = 127;  System.out.println(a == b);  // true  (cached)
Integer c = 128;  Integer d = 128;  System.out.println(c == d);  // false (new objects!)
// ← always use .equals() for object comparison, never ==
```

```go
// Go (static, structural interfaces, AOT compiled)
var price int = 1999
// typed-nil interface gotcha — the #1 Go interview trap:
var err *MyError = nil
var iface error = err          // iface is NOT nil — it holds a (*MyError, nil) pair
fmt.Println(iface == nil)      // false — surprises everyone the first time
```

### Implement it / see it in code

The most interview-critical mental model is **how each language handles concurrency and the cost of that choice**. Here is the same "fetch product from cache or DB" logic in each runtime, showing what the scheduler actually does:

```python
# Python asyncio (cooperative event loop — single thread, non-blocking I/O)
import asyncio

async def get_product(product_id: int) -> dict:
    cached = await redis.get(f"product:{product_id}")   # yields control here; no GIL cost
    if cached:
        return json.loads(cached)
    row = await db.fetchone("SELECT * FROM products WHERE id=$1", product_id)
    await redis.set(f"product:{product_id}", json.dumps(row), ex=60)
    return row
# Works well for I/O-bound catalog reads.
# A blocking call (e.g., a pure-Python loop) here BLOCKS THE WHOLE EVENT LOOP.
```

```go
// Go goroutines (M:N scheduler — cheap, preemptive green threads)
func getProduct(ctx context.Context, id int) (*Product, error) {
    cached, err := redisClient.Get(ctx, fmt.Sprintf("product:%d", id)).Result()
    if err == nil {
        var p Product
        json.Unmarshal([]byte(cached), &p)
        return &p, nil
    }
    // Each goroutine costs ~2 KB stack; you can have hundreds of thousands in flight.
    row := db.QueryRowContext(ctx, "SELECT * FROM products WHERE id=$1", id)
    // ...scan row into Product...
    return &p, nil
}
```

### Where it lives in real systems

**ShopFast's catalog endpoint** makes this concrete in three ways:

1. **The GIL and catalog read throughput.** If ShopFast's backend is CPython and you try to saturate all CPU cores with OS (Operating System) threads, you can't — the GIL allows only one thread to execute Python bytecode at a time. At ~1,800 peak read QPS (Queries Per Second), the catalog endpoint is I/O-bound (Redis + Postgres reads), so the GIL doesn't hurt — `asyncio` releases it on every network call. But if you added CPU-heavy image-processing to the product endpoint, you would hit a wall. Fix: offload to a separate process or a C extension that releases the GIL.

2. **Type system catching a cents-vs-dollars bug at checkout.** ShopFast stores `price` as an integer in cents (e.g., `1999` = $19.99) to avoid floating-point rounding errors. In a statically typed language (Go, Java, TypeScript), you can encode this as a distinct type (`type Cents int`) so the compiler rejects accidentally passing a dollar-float to a function expecting cents. In Python (dynamic typing), you need a runtime check or a `@dataclass` with a validator. A `POST /v1/orders` that charges `$0.19` instead of `$19.99` is a real business-ending bug — the type system is your first line of defense.

3. **GC (Garbage Collection) pauses and checkout latency.** ShopFast's `POST /v1/orders` has a strict latency budget (it calls the payment provider with a 2s timeout). Java's older GC collectors could cause stop-the-world pauses of tens of milliseconds. With ZGC or Shenandoah, pauses are sub-millisecond. Go's concurrent mark-sweep targets sub-1ms STW (Stop-The-World). Understanding GC lets you explain why p99 (99th-percentile latency) spikes under allocation load even when p50 looks fine.

### Types & differences

| Dimension | Python (CPython) | Java (HotSpot JVM) | Go | JS/TypeScript (V8) |
|---|---|---|---|---|
| **Typing** | Dynamic, strong | Static, strong, nominal | Static, structural interfaces | Dynamic (JS) / Static (TS) |
| **Execution** | Bytecode → interpreter (+ experimental JIT in 3.13+) | Bytecode → JIT (Just-In-Time) tiered | AOT (Ahead-Of-Time) native binary | Bytecode → JIT (TurboFan) |
| **Memory mgmt** | Reference counting + cycle GC | Tracing GC (G1, ZGC, Shenandoah) | Concurrent mark-sweep, sub-ms STW | Generational GC |
| **Concurrency** | Threads limited by GIL + `asyncio` event loop | OS threads + virtual threads (Java 21+) | Goroutines (M:N scheduler) | Single-thread event loop |
| **Errors** | Exceptions | Checked + unchecked exceptions | Explicit `(value, error)` return | Exceptions |
| **Param passing** | Pass-by-sharing (copy of reference) | Pass-by-sharing | Pass-by-value (pointers explicit) | Pass-by-sharing |
| **Reach for it when** | Scripting, ML, rapid prototyping | Large JVM ecosystem, strong tooling | Systems, high concurrency, CLI tools | Browser/Node full-stack |

### Gotchas

| Language | Gotcha | Why it matters for ShopFast |
|---|---|---|
| Python | Mutable default argument (`def f(x=[])`) evaluated once at def-time | A route handler that accidentally shares state between requests corrupts cart data |
| Python | Late-binding closures — loop variable captured by reference, not value | Async I/O callbacks in a loop all see the last value of the loop variable |
| Java | `Integer` cache: `==` works for -128..127, breaks above it | Comparing order IDs or product IDs with `==` silently fails on large values |
| Java | Type erasure: `List<String>` and `List<Integer>` are the same class at runtime | Can't dispatch on generic type; can't do `new T[]`; bridge methods add noise |
| Go | Typed-nil interface: `(*T)(nil)` stored in an `error` interface is `!= nil` | `if err != nil` passes even though the underlying pointer is nil — silent success that's actually an error |
| Go | Slice aliasing: `append` may or may not copy the backing array | Concurrent reads/writes to a slice derived from a shared backing array → data race |
| JS/TS | TS types erased at runtime | Zod / io-ts needed for boundary validation; `as unknown as T` is lying to the compiler |
| All | GC pause spikes under high allocation rate | Checkout p99 latency jumps without tuning; profile allocation rate before blaming the network |

---

## 1. Type systems

### Static vs dynamic
- **Static typing** (Java, Go, Rust, TypeScript): types are checked at compile time. Errors caught before runtime; enables aggressive compiler optimization and IDE tooling. Cost: ceremony, slower iteration, sometimes fighting the checker.
- **Dynamic typing** (Python, Ruby, JS): types attached to *values*, checked at runtime. Fast iteration, more flexible metaprogramming; bugs surface later, often in prod.

### Strong vs weak
Orthogonal to static/dynamic. **Strong** = few implicit coercions (Python: `"1" + 1` → `TypeError`). **Weak** = lots of coercion (JS: `"1" + 1` → `"11"`, `[] + {}` → `"[object Object]"`). Python is strong+dynamic; JS is weak+dynamic; Java is strong+static.

### Nominal vs structural
- **Nominal** (Java, Go interfaces are structural but its classes are nominal): compatibility by declared name/inheritance.
- **Structural** (TypeScript, Go interfaces): compatibility by shape. A type satisfies an interface if it has the right members, regardless of whether it "declares" it. Go interfaces are *implicitly* satisfied — no `implements` keyword.

### Type inference
Hindley–Milner-style inference (full) vs local inference. Go/Java infer locally (`var x = foo()`, `:=`); they cannot infer function parameter types. TypeScript and Rust do much deeper flow-based inference.

### Generics / parametric polymorphism
- **Java**: generics are erased — `List<String>` and `List<Integer>` are the same class at runtime (type erasure). Consequences: no `new T[]`, no `instanceof List<String>`, bridge methods, `@SuppressWarnings`.
- **Go**: added generics in 1.18 via type parameters with constraints (interface-based). Monomorphized/dictionary hybrid (GCShape stenciling).
- **C++/Rust**: monomorphization — a separate specialized copy per type. Zero runtime cost, larger binaries.
- **Variance**: covariance (`? extends T`), contravariance (`? super T`), invariance. Java arrays are *covariant and unsound* (`Object[] a = new String[1]; a[0]=1` → `ArrayStoreException`).

### Top, bottom, null
- **Top type**: `Object` (Java), `any`/`unknown` (TS), `interface{}`/`any` (Go).
- **Bottom type**: `never` (TS), `Nothing` (Scala/Kotlin) — the type of expressions that don't return.
- **Null**: Tony Hoare's "billion-dollar mistake." Modern languages address it: Kotlin/Swift nullable types (`T?`), Rust `Option<T>`, Go uses zero values + explicit `nil`. Java added `Optional<T>` (but references are still nullable).

---

## 2. Runtime / execution model

### Compilation pipelines
- **Python (CPython)**: source → bytecode (`.pyc`) → interpreted by a stack-based VM. No JIT (Just-In-Time compilation) in stock CPython (PyPy has one; CPython 3.13+ ships an experimental JIT).
- **Java**: source → bytecode (`.class`) → JVM (Java Virtual Machine). Starts interpreted, then the **JIT** (C1/C2 in HotSpot) compiles hot methods to native code, guided by runtime profiling. Tiered compilation, on-stack replacement, deoptimization.
- **Go**: AOT (Ahead-Of-Time) compiled to a single static native binary. Fast compiles, no VM, built-in runtime (scheduler, GC) linked in.
- **JS (V8)**: source → bytecode (Ignition) → optimizing JIT (TurboFan) with speculative optimization + deopt on type feedback violation ("hidden classes"/"shapes").

### The GIL (Python)
CPython's **GIL (Global Interpreter Lock)** allows only one thread to execute bytecode at a time. CPU-bound multithreading does **not** scale on cores — use `multiprocessing` or native extensions that release the GIL. I/O-bound threads *do* benefit because the GIL is released during blocking I/O. Python 3.13 ships an experimental free-threaded (no-GIL) build.

### Concurrency models
- **OS (Operating System) threads** (Java pre-21, Python): 1:1 with kernel threads, ~1MB stacks, expensive context switches.
- **Goroutines** (Go): M:N green threads multiplexed onto OS threads by the runtime scheduler; ~2KB initial stack, grows. Cheap to spawn millions.
- **Virtual threads** (Java 21, Project Loom): JVM (Java Virtual Machine)-managed lightweight threads, similar idea — unblocks the "thread-per-request" model without the cost.
- **Event loop** (Node, asyncio): single-threaded cooperative scheduling; `async/await` over a reactor. Great for I/O, blocks on CPU work.

### Memory management
- **Tracing GC (Garbage Collection)**: Java (G1, ZGC, Shenandoah — region/concurrent collectors), Go (concurrent tri-color mark-sweep, sub-ms STW (Stop-The-World)), JS (generational + incremental).
- **Reference counting**: CPython (immediate reclamation) + a cycle collector for reference cycles. Deterministic for acyclic data.
- **Manual / ownership**: C/C++ (`malloc`/`free`), Rust (ownership + borrow checker, no GC, no runtime cost).
- **Stack vs heap**: value types and locals on the stack; objects on the heap. Go's **escape analysis** decides at compile time whether an allocation can stay on the stack.

---

## 3. Evaluation & semantics

### Pass-by-value vs pass-by-reference
This is the most common interview trap. Almost no mainstream language is truly pass-by-reference.
- **Java/Python/JS/Go**: pass-by-value, but for objects the *value passed is a reference (pointer)*. So you can mutate the pointed-to object, but reassigning the parameter doesn't affect the caller. Often called "pass-by-sharing" / "call-by-object-sharing."
- **C++**: true pass-by-reference available via `&`.
- Mental model: "the variable holds a handle; you pass a copy of the handle."

### Mutability & aliasing
- Python's classic gotcha: **mutable default arguments** (`def f(x=[])`) — the default is evaluated *once* at def time and shared across calls.
- Strings are immutable in Java/Python/JS/Go (interning, safe sharing). `StringBuilder`/`strings.Builder` for efficient concatenation.

### Equality & identity
- Python: `==` (value) vs `is` (identity). Small-int and short-string interning means `is` *sometimes* works for `==` — never rely on it.
- Java: `==` compares references for objects; use `.equals()`. The `Integer` cache (-128..127) makes `==` deceptively work for small autoboxed ints.
- JS: `==` (coercing) vs `===` (strict). Always prefer `===`. `NaN !== NaN`.

### Closures & scoping
- Closures capture **variables**, not values. The loop-variable capture bug: in Python/old-JS, a closure created in a loop captures the loop variable, so all closures see its final value. Fix: bind per-iteration (default arg, `let` in JS, or a factory). Go 1.22 changed loop-variable semantics to per-iteration to kill this class of bug.

### Iterators, laziness, generators
- Python generators (`yield`) and lazy iterators; Java `Stream` (lazy until terminal op); Go has no lazy iterators historically (added range-over-func iterators in 1.23).

---

## 4. Language-specific gotchas (rapid fire)

### Python
- Integer division `//` vs `/`; `/` always returns float.
- `is` vs `==`; mutable defaults; late-binding closures.
- `__slots__` to cut per-instance memory; descriptors and the MRO (Method Resolution Order, C3 linearization) for multiple inheritance.
- `asyncio` is cooperative — a blocking call stalls the whole event loop.

### Java
- Type erasure; autoboxing surprises (`Integer` cache, `NullPointerException` on unboxing `null`).
- `equals()`/`hashCode()` contract — break it and `HashMap` misbehaves.
- Checked vs unchecked exceptions (see error-handling topic).
- `finalize()` is deprecated; use try-with-resources / `Cleaner`.

### Go
- Zero values everywhere (`nil` maps panic on write but read fine; `nil` slices are usable).
- The **typed-nil interface** gotcha: an interface holding a `(*T)(nil)` is `!= nil`. Classic source of bugs returning errors.
- Slices share backing arrays — `append` may or may not alias the original; subtle data races/aliasing.
- `defer` runs LIFO (Last-In-First-Out) at function return; captures arguments at `defer` time, not execution time.
- No exceptions: explicit `if err != nil`. `panic`/`recover` reserved for truly exceptional cases.

### JavaScript / TypeScript
- `this` binding (lexical with arrow functions, dynamic otherwise); hoisting; `var` vs `let`/`const`.
- Floating-point: `0.1 + 0.2 !== 0.3` (true for *all* IEEE-754 languages).
- TS types are erased at runtime — no runtime type checks; use Zod/io-ts for boundary validation.

---

## 5. Tradeoffs & "what interviewers probe"

- **"Why is Python slow?"** Interpreter overhead, dynamic dispatch, boxed objects, GIL for CPU parallelism. Mitigations: C extensions, NumPy, PyPy, offload hot loops.
- **"Explain the GIL and when it does/doesn't matter."** I/O-bound vs CPU-bound; processes vs threads.
- **"Pass-by-value or reference in <language>?"** Expect the pass-by-sharing nuance, not a one-word answer.
- **"How does the JVM optimize?"** JIT, tiered compilation, escape analysis, inlining, deopt.
- **"Stack vs heap, and how does GC affect tail latency?"** STW pauses, generational hypothesis, allocation rate, GC tuning.
- **"Goroutines vs threads."** M:N scheduling, cheap stacks, scheduler preemption.
- **A senior signal**: connecting a language feature to a *production consequence* (e.g., "type erasure means I can't dispatch on generic type at runtime, so I pass a `Class<T>` token").

### Common misconceptions
- "Java is pass-by-reference." False — pass-by-value of references.
- "The GIL makes threads useless." False for I/O.
- "Compiled is always faster than interpreted." JIT can beat naive AOT; AOT avoids warmup. It depends.
- "GC means no memory leaks." False — lingering references (caches, listeners, static maps) leak.
- "`final`/`const` makes the object immutable." It makes the *binding* immutable; the object can still mutate.

---

## Quick-reference summary

| Dimension | Python (CPython) | Java (HotSpot) | Go | JS (V8) |
|---|---|---|---|---|
| Typing | dynamic, strong | static, strong, nominal+erased generics | static, structural ifaces | dynamic, weak |
| Execution | bytecode interp (+ exp. JIT) | bytecode → JIT | AOT native | bytecode → JIT |
| Memory | refcount + cycle GC | tracing GC (G1/ZGC) | concurrent mark-sweep | generational GC |
| Concurrency | threads (GIL) + asyncio | threads + virtual threads | goroutines (M:N) | event loop |
| Errors | exceptions | checked + unchecked | explicit `error` values | exceptions |
| Param passing | pass-by-sharing | pass-by-sharing | pass-by-value (ptrs) | pass-by-sharing |

**Three things to always nail:** (1) pass-by-sharing semantics, (2) the GIL / concurrency model of your language, (3) how GC pauses affect latency. If you can reason about those from first principles, you can derive most language gotchas on the spot.
