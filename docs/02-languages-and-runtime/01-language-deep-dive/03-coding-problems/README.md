# Language Deep-Dive — Coding Problems

[← Topic overview](../README.md)

> Topic: Idioms, type system, runtime model, gotchas.

These problems target language *mechanics* — closures, mutability, iteration, memoization — rather than algorithmic difficulty. The point is to write idiomatic, correct code and explain the runtime behavior.

---

### Problem 1 — Fix the closure-capture bug

**Statement:** The following factory is supposed to return three functions that return 0, 1, 2. It returns 2, 2, 2. Fix it without changing the call site, and explain why.

**Constraints:** Pure Python; no global state.

**Approach:** Closures capture the *variable* `i`, not its value at creation time; after the loop, `i == 2`. Bind per-iteration via a default-argument capture (evaluated at def time) or a factory function.

**Complexity:** O(n) build, O(1) per call. Space O(n) for the closures.

```python
def make_fns(n):
    # Bug: return [lambda: i for i in range(n)]
    return [lambda i=i: i for i in range(n)]   # default-arg binds current i

fns = make_fns(3)
print([f() for f in fns])   # [0, 1, 2]
```

---

### Problem 2 — Deep copy vs shallow copy

**Statement:** Given a nested dict/list structure, write a function that returns a copy such that mutating the copy never affects the original. Demonstrate why a shallow copy fails.

**Constraints:** Handle nested lists and dicts; assume JSON-like data (no cycles).

**Approach:** A shallow copy (`dict(d)`, `d.copy()`, `list(l)`) copies the top level but shares nested object references. Recurse to copy every level, or use `copy.deepcopy`.

**Complexity:** O(n) time and space in the total number of nodes.

```python
def deep_copy(obj):
    if isinstance(obj, dict):
        return {k: deep_copy(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [deep_copy(v) for v in obj]
    return obj  # immutables (int, str, etc.) can be shared safely

original = {"a": [1, 2], "b": {"c": 3}}
copy_ = deep_copy(original)
copy_["a"].append(99)
assert original["a"] == [1, 2]   # unaffected
```

---

### Problem 3 — Memoization decorator (closures + dicts)

**Statement:** Implement a generic `memoize` decorator that caches results by arguments. Show it turns naive recursive Fibonacci from exponential to linear.

**Constraints:** Arguments are hashable; single-threaded.

**Approach:** A closure captures a cache dict keyed by the args tuple. On call, return cached value or compute and store. (`functools.lru_cache` does this in stdlib.)

**Complexity:** Naive fib is O(φⁿ); memoized is O(n) time, O(n) space.

```python
def memoize(fn):
    cache = {}
    def wrapper(*args):
        if args not in cache:
            cache[args] = fn(*args)
        return cache[args]
    return wrapper

@memoize
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(50))   # instant; without memoization this is intractable
```

---

### Problem 4 — Lazy generator pipeline

**Statement:** Read an arbitrarily large file (or infinite stream) and produce squares of even numbers, processing one item at a time without loading everything into memory.

**Constraints:** Constant memory regardless of input size.

**Approach:** Use generators (`yield`) so each stage is lazy. Nothing is computed until the consumer pulls; memory stays O(1).

**Complexity:** O(n) time over the stream, **O(1)** extra space.

```python
def numbers(stream):
    for line in stream:
        yield int(line)

def even_squares(nums):
    for n in nums:
        if n % 2 == 0:
            yield n * n

# Composition is lazy: no intermediate list is materialized.
import io
src = io.StringIO("1\n2\n3\n4\n")
for v in even_squares(numbers(src)):
    print(v)   # 4, 16
```

---

### Problem 5 — Equality and hashing contract (Java)

**Statement:** Write a `Point` value class usable as a `HashMap` key. Demonstrate what breaks if you override `equals` but not `hashCode`.

**Constraints:** Two points with the same x,y must be the same key.

**Approach:** The contract: equal objects **must** have equal hash codes. If you override only `equals`, two "equal" points may land in different buckets, so `map.get(equalKey)` returns `null`. Override both consistently (or use a `record`, which generates both).

**Complexity:** O(1) average hash ops.

```java
record Point(int x, int y) {}   // records auto-generate equals + hashCode

// Equivalent hand-written form:
final class PointManual {
    final int x, y;
    PointManual(int x, int y) { this.x = x; this.y = y; }
    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PointManual p)) return false;
        return x == p.x && y == p.y;
    }
    @Override public int hashCode() { return java.util.Objects.hash(x, y); }
}
```

---

### Problem 6 — Avoid the Go slice-aliasing trap

**Statement:** A function appends to a slice passed in. Sometimes the caller's data is silently corrupted, sometimes not. Make `safeAppend` never mutate the caller's backing array.

**Constraints:** Idiomatic Go.

**Approach:** `append` reuses the backing array if capacity allows, so writes can alias the caller's data. To guarantee isolation, copy first (or use the three-index slice `s[:len:len]` to force a new allocation on append).

**Complexity:** O(n) copy, O(n) space for the new backing array.

```go
func safeAppend(s []int, v int) []int {
    out := make([]int, len(s), len(s)+1) // fresh backing array
    copy(out, s)
    return append(out, v)
}

func main() {
    a := []int{1, 2, 3}
    b := safeAppend(a[:2], 99) // a is untouched
    fmt.Println(a, b)          // [1 2 3] [1 2 99]
}
```

---

### Problem 7 — Implement an LRU cache (language idioms + ordered map)

**Statement:** Implement an LRU cache with O(1) `get` and `put`.

**Constraints:** Fixed capacity; evict least-recently-used on overflow.

**Approach:** Hash map + doubly linked list, or in Python an `OrderedDict` (`move_to_end` + `popitem(last=False)`). Both give O(1) operations.

**Complexity:** O(1) time per operation, O(capacity) space.

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.d = OrderedDict()

    def get(self, key):
        if key not in self.d:
            return -1
        self.d.move_to_end(key)      # mark most-recently-used
        return self.d[key]

    def put(self, key, value):
        if key in self.d:
            self.d.move_to_end(key)
        self.d[key] = value
        if len(self.d) > self.cap:
            self.d.popitem(last=False)  # evict LRU
```
