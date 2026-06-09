# Language Deep-Dive — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Idioms, type system, runtime model, gotchas.

A senior engineer is expected to know one language *to the metal* and reason about others by analogy. This note is organized around the cross-cutting mental models that show up at interview — type systems, runtime/memory models, evaluation semantics, and the concrete gotchas of the three most common backend languages (Python, Java, Go), with JavaScript/TypeScript called out where it differs. The goal is not trivia; it is being able to predict program behavior from first principles.

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
- **Python (CPython)**: source → bytecode (`.pyc`) → interpreted by a stack-based VM. No JIT in stock CPython (PyPy has one; CPython 3.13+ ships an experimental JIT).
- **Java**: source → bytecode (`.class`) → JVM. Starts interpreted, then the **JIT** (C1/C2 in HotSpot) compiles hot methods to native code, guided by runtime profiling. Tiered compilation, on-stack replacement, deoptimization.
- **Go**: AOT compiled to a single static native binary. Fast compiles, no VM, built-in runtime (scheduler, GC) linked in.
- **JS (V8)**: source → bytecode (Ignition) → optimizing JIT (TurboFan) with speculative optimization + deopt on type feedback violation ("hidden classes"/"shapes").

### The GIL (Python)
CPython's **Global Interpreter Lock** allows only one thread to execute bytecode at a time. CPU-bound multithreading does **not** scale on cores — use `multiprocessing` or native extensions that release the GIL. I/O-bound threads *do* benefit because the GIL is released during blocking I/O. Python 3.13 ships an experimental free-threaded (no-GIL) build.

### Concurrency models
- **OS threads** (Java pre-21, Python): 1:1 with kernel threads, ~1MB stacks, expensive context switches.
- **Goroutines** (Go): M:N green threads multiplexed onto OS threads by the runtime scheduler; ~2KB initial stack, grows. Cheap to spawn millions.
- **Virtual threads** (Java 21, Project Loom): JVM-managed lightweight threads, similar idea — unblocks the "thread-per-request" model without the cost.
- **Event loop** (Node, asyncio): single-threaded cooperative scheduling; `async/await` over a reactor. Great for I/O, blocks on CPU work.

### Memory management
- **Tracing GC**: Java (G1, ZGC, Shenandoah — region/concurrent collectors), Go (concurrent tri-color mark-sweep, sub-ms STW), JS (generational + incremental).
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
- `__slots__` to cut per-instance memory; descriptors and the MRO (C3 linearization) for multiple inheritance.
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
- `defer` runs LIFO at function return; captures arguments at `defer` time, not execution time.
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
