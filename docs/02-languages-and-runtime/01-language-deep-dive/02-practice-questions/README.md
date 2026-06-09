# Language Deep-Dive — Practice Questions

[← Topic overview](../README.md)

> Topic: Idioms, type system, runtime model, gotchas.

A mix of factual recall, "explain to a junior" prompts, and multiple-choice. Try to answer before reading the solution.

---

### Q1. Is Java pass-by-value or pass-by-reference? Explain precisely.

**Answer:** Java is **always pass-by-value**. For primitives the value (a copy of the number) is passed. For objects, the value passed is a *copy of the reference* (the pointer), not the object itself. So a method can mutate the object the reference points to (visible to the caller), but reassigning the parameter to a new object does **not** affect the caller's variable. This nuance — "pass-by-value of a reference," sometimes called *pass-by-sharing* — is the correct senior answer. The same model applies to Python, JavaScript, and Go.

---

### Q2. Explain the GIL to a junior, and say when it does and doesn't hurt.

**Answer:** CPython has a **Global Interpreter Lock**: a mutex that lets only one thread run Python bytecode at a time. So even with 8 cores and 8 threads, CPU-bound Python code runs effectively on one core — threads don't give you parallel speedup. *But* the GIL is released during blocking I/O (network, disk) and inside many C extensions (NumPy). So **I/O-bound** workloads scale fine with threads, while **CPU-bound** work needs `multiprocessing` (separate processes, separate GILs) or native code. Analogy: one microphone (the GIL) passed around a room — people can think (I/O wait) in parallel, but only one can talk (run bytecode) at a time.

---

### Q3. What is type erasure in Java and what can't you do because of it?

**Answer:** Java generics are a compile-time-only feature; at runtime `List<String>` and `List<Integer>` are both just `List`. The compiler inserts casts and enforces type safety statically, then erases the parameter. Consequences you can't do: `new T[]`, `T.class`, `obj instanceof List<String>`, overload methods that differ only by type parameter, or catch a generic exception type. Workarounds: pass a `Class<T>` token, use `@SuppressWarnings`, or reified-style helpers. Contrast with C++/Rust monomorphization (separate code per type) and Go's hybrid stenciling.

---

### Q4. Why does this Python code print `[1, 2]` on the second call? How do you fix it?

```python
def add(item, target=[]):
    target.append(item)
    return target

add(1)   # [1]
add(2)   # [1, 2]  <-- surprising
```

**Answer:** The default argument `[]` is evaluated **once**, when the function is *defined*, not on each call. So every call that omits `target` shares the same list object. Fix with the sentinel idiom:

```python
def add(item, target=None):
    if target is None:
        target = []
    target.append(item)
    return target
```

---

### Q5. Explain the difference between stack and heap allocation, and what escape analysis does.

**Answer:** The **stack** holds a call frame's locals and is reclaimed automatically on return (cheap, LIFO, no GC). The **heap** holds objects whose lifetime outlives a single frame; it's managed by the GC (or manually). Heap allocation is more expensive and adds GC pressure. **Escape analysis** is a compiler optimization (Go, JVM) that proves a value does *not* escape the current function — no reference leaks out — and therefore can be stack-allocated, avoiding a heap allocation and GC work entirely. In Go you can inspect this with `go build -gcflags='-m'`.

---

### Q6. What's the difference between `==` and `is` in Python? Why might `a is b` be `True` for two separate `==` integers?

**Answer:** `==` compares **value/equality** (`__eq__`); `is` compares **object identity** (same memory). They differ for most objects. CPython **interns** small integers (-5..256) and some short strings, so `256 is 256` is `True` but `257 is 257` may be `False` in some contexts. **Never** use `is` for value comparison — use it only for `None`, sentinels, and identity checks.

---

### Q7. Describe how the JVM goes from "cold" to "fast."

**Answer:** Java starts by **interpreting** bytecode for fast startup. The JVM **profiles** execution (which methods are hot, which branches taken). When a method crosses a threshold, the **JIT** compiles it to native code — first quickly (C1 / tier 1-3), then with aggressive optimizations (C2 / tier 4): inlining, escape analysis, loop unrolling, speculative optimizations based on observed types. If a speculative assumption is later violated, the JVM **deoptimizes** back to the interpreter. This warmup is why short-lived JVM processes (e.g., CLI tools) feel slow and why benchmarks must warm up first.

---

### Q8. (Go) Why can a function returning an `error` interface be non-nil even when "no error occurred"?

**Answer:** The **typed-nil interface** trap. An interface value is a (type, value) pair. If you return a `*MyError` that is nil through an `error` interface, the interface has type `*MyError` and value `nil` — which is **not equal to** the untyped `nil` interface. So `if err != nil` is true. Fix: return the literal `nil` (the untyped one), or check/normalize before returning. Idiomatic Go declares `var err error` and returns it, never a typed nil pointer wrapped in the interface.

---

### Q9. Closures capture variables, not values — explain the loop-capture bug.

**Answer:** A closure created inside a loop captures the loop **variable** by reference, so all closures share it and see its final value after the loop ends.

```python
fns = [lambda: i for i in range(3)]
[f() for f in fns]   # [2, 2, 2], not [0, 1, 2]
```

Fix by binding per iteration: `lambda i=i: i` (Python default-arg capture), or in JS use `let` (per-iteration binding) instead of `var`. Go 1.22+ changed loop semantics so each iteration gets a fresh variable, eliminating this bug.

---

### Q10 (MCQ). Which statement about Go's concurrency model is correct?

- A. Goroutines map 1:1 to OS threads.
- B. Goroutines are M:N green threads scheduled by the Go runtime onto a pool of OS threads.
- C. Goroutines run only on a single core.
- D. Goroutines are OS processes.

**Answer: B.** Goroutines are lightweight (≈2KB initial stack) and multiplexed M:N over OS threads (`GOMAXPROCS` controls parallelism). A is wrong (that's classic Java threads); C is wrong (they use multiple cores); D is wrong.

---

### Q11 (MCQ). `0.1 + 0.2 === 0.3` evaluates to `false` in JavaScript because:

- A. JavaScript is dynamically typed.
- B. `===` is too strict.
- C. IEEE-754 binary floating point cannot represent 0.1 or 0.2 exactly.
- D. It's a V8 bug.

**Answer: C.** This is true in *every* IEEE-754 language (Java, Python, C). 0.1 and 0.2 have no finite binary representation, so the sum is `0.30000000000000004`. Use a tolerance (`Math.abs(a-b) < eps`) or fixed-point/decimal types for money.

---

### Q12 (MCQ). In Java, which is the safest way to handle a closeable resource?

- A. Manual `try/finally` with `close()`.
- B. `try-with-resources`.
- C. Rely on `finalize()`.
- D. Let the GC close it.

**Answer: B.** `try-with-resources` (any `AutoCloseable`) guarantees `close()` in reverse order even on exception, and handles suppressed exceptions correctly. A works but is verbose and error-prone. C is deprecated and non-deterministic; D never closes resources deterministically.

---

### Q13. "Explain to a junior" — why is a `String` immutable in Java/Python, and why does it matter?

**Answer:** Once created, a string's contents never change; "modifying" it produces a new object. Benefits: safe to share across threads without locks, safe as `HashMap` keys (hashcode is stable), enables **interning** (deduplicating identical literals to save memory) and security (a path string can't be mutated after a check). The cost: building a string in a loop with `+` creates many throwaway objects (O(n²)); use `StringBuilder` (Java) or `"".join()` / `strings.Builder` (Python/Go) instead.

---

### Q14. What does "structural typing" mean and where do you see it?

**Answer:** Type compatibility is determined by **shape** (members/methods present), not by declared name or inheritance. TypeScript uses it throughout: an object satisfies an interface if it has the right fields, even if it never names the interface. **Go interfaces** are structural and *implicitly* satisfied — a type implements `io.Reader` simply by having a `Read([]byte) (int, error)` method, with no `implements` keyword. Contrast with **nominal** typing (Java/C# classes) where you must explicitly declare the relationship.
