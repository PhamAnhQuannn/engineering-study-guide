# Design Patterns — Coding Problems

[← Topic overview](../README.md)

> Topic: Creational/structural/behavioral, when NOT to use.

Each problem: statement + constraints, approach, complexity, worked solution. These are "implement/refactor the pattern" exercises typical of senior screens — graders watch for clean seams, not cleverness.

---

## Problem 1 — Replace a growing `switch` with Strategy

**Statement:** A shipping-cost function `cost(method, weightKg)` uses a `switch` over `method` ("standard", "express", "overnight"). Every new carrier adds a branch. Refactor so adding a method requires no edit to existing dispatch (Open/Closed).

**Constraints:** Selection at runtime; each strategy is independently testable.

**Approach:** Define a `ShippingStrategy` interface; one class per method; register strategies in a dict; look up by key. Dispatch becomes a map lookup.

**Complexity:** Lookup `O(1)`; space `O(k)` for `k` strategies.

```python
from abc import ABC, abstractmethod

class ShippingStrategy(ABC):
    @abstractmethod
    def cost(self, weight_kg: float) -> float: ...

class Standard(ShippingStrategy):
    def cost(self, w): return 5.0 + 0.5 * w

class Express(ShippingStrategy):
    def cost(self, w): return 12.0 + 1.0 * w

class Overnight(ShippingStrategy):
    def cost(self, w): return 25.0 + 2.0 * w

# Registry — adding a carrier = add a class + one line here, no dispatch edits.
STRATEGIES = {"standard": Standard(), "express": Express(), "overnight": Overnight()}

def cost(method: str, weight_kg: float) -> float:
    try:
        return STRATEGIES[method].cost(weight_kg)
    except KeyError:
        raise ValueError(f"unknown shipping method: {method}")
```

---

## Problem 2 — Decorator: composable stream transforms

**Statement:** Implement a text-source interface `read() -> str` and decorators that (a) uppercase and (b) trim whitespace, stackable in any order over a base in-memory source.

**Constraints:** Same interface at every layer; order configurable at runtime.

**Approach:** Base class implements the interface; each decorator wraps another instance of the interface and transforms its output. Stacking = nesting.

**Complexity:** `read()` is `O(L · d)` for length `L` and decorator depth `d`; space `O(L)`.

```python
from abc import ABC, abstractmethod

class TextSource(ABC):
    @abstractmethod
    def read(self) -> str: ...

class StringSource(TextSource):
    def __init__(self, s): self._s = s
    def read(self): return self._s

class Decorator(TextSource):
    def __init__(self, inner: TextSource): self._inner = inner

class Upper(Decorator):
    def read(self): return self._inner.read().upper()

class Trim(Decorator):
    def read(self): return self._inner.read().strip()

src = Upper(Trim(StringSource("  hello  ")))
assert src.read() == "HELLO"        # trim then upper
assert Trim(Upper(StringSource(" hi "))).read() == "HI"
```

---

## Problem 3 — Observer with safe unsubscribe

**Statement:** Build a `Subject` that notifies observers of an integer value change. Support subscribe/unsubscribe and avoid the "lapsed listener" leak (an unsubscribed observer must stop receiving and be eligible for GC).

**Constraints:** Notifying must tolerate an observer unsubscribing during iteration.

**Approach:** Keep a list of callbacks; iterate over a **copy** so a callback can mutate the list safely; provide an `unsubscribe` handle. Use weak references if observers shouldn't be kept alive by the subject.

**Complexity:** `notify` is `O(n)`; subscribe/unsubscribe `O(1)`/`O(n)`.

```python
class Subject:
    def __init__(self):
        self._observers = []          # list of callables
        self._value = 0

    def subscribe(self, fn):
        self._observers.append(fn)
        return lambda: self._observers.remove(fn)  # unsubscribe handle

    def set(self, v):
        self._value = v
        for fn in list(self._observers):  # copy: safe if fn unsubscribes
            fn(v)

s = Subject()
seen = []
off = s.subscribe(seen.append)
s.set(1); s.set(2)
off()                 # unsubscribe — prevents lapsed-listener leak
s.set(3)
assert seen == [1, 2]
```

---

## Problem 4 — Builder for an immutable object with validation

**Statement:** Construct an immutable `HttpRequest` with required `method`, `url` and optional `headers`, `body`, `timeout`. Avoid a telescoping constructor; validate on `build()`.

**Constraints:** Result is immutable; missing required fields fail fast.

**Approach:** A mutable Builder accumulates fields with chainable setters; `build()` validates and freezes into an immutable object.

**Complexity:** `O(h)` to copy `h` headers; space `O(h)`.

```python
from dataclasses import dataclass
from types import MappingProxyType

@dataclass(frozen=True)
class HttpRequest:
    method: str
    url: str
    headers: MappingProxyType
    body: str | None
    timeout: float

class HttpRequestBuilder:
    def __init__(self):
        self._method = self._url = None
        self._headers, self._body, self._timeout = {}, None, 30.0
    def method(self, m): self._method = m; return self
    def url(self, u): self._url = u; return self
    def header(self, k, v): self._headers[k] = v; return self
    def body(self, b): self._body = b; return self
    def timeout(self, t): self._timeout = t; return self
    def build(self) -> HttpRequest:
        if not self._method or not self._url:
            raise ValueError("method and url are required")
        return HttpRequest(self._method, self._url,
                           MappingProxyType(dict(self._headers)),
                           self._body, self._timeout)

req = (HttpRequestBuilder().method("POST").url("/api")
       .header("Content-Type", "application/json").body("{}").build())
```

---

## Problem 5 — Adapter for an incompatible third-party interface

**Statement:** Your code expects `Logger.log(level, message)`. A vendor library exposes `VendorLog.write(text, severity_int)` where severity is 0=info,1=warn,2=error. Adapt it without changing either side.

**Constraints:** Client depends only on your `Logger` interface.

**Approach:** Implement `Logger` with an Adapter that translates your call shape to the vendor's and maps the level vocabulary.

**Complexity:** `O(1)` per call.

```python
from abc import ABC, abstractmethod

class Logger(ABC):
    @abstractmethod
    def log(self, level: str, message: str) -> None: ...

class VendorLog:                       # third-party, cannot change
    def write(self, text, severity_int): print(f"[{severity_int}] {text}")

class VendorLogAdapter(Logger):
    _SEV = {"info": 0, "warn": 1, "error": 2}
    def __init__(self, vendor: VendorLog): self._v = vendor
    def log(self, level, message):
        self._v.write(message, self._SEV.get(level, 0))

log: Logger = VendorLogAdapter(VendorLog())
log.log("error", "disk full")          # -> [2] disk full
```

---

## Problem 6 — State pattern: a simple order lifecycle

**Statement:** Model an order with states `Draft → Submitted → Shipped`. Allowed transitions: draft can submit; submitted can ship or cancel; shipped is terminal. Replace flag/conditional sprawl with the State pattern.

**Constraints:** Illegal transitions raise; each state owns its allowed actions.

**Approach:** Each state is a class implementing transition methods; default methods reject. The context delegates to its current state and swaps it.

**Complexity:** `O(1)` per transition.

```python
class State:
    def submit(self, o): raise ValueError("cannot submit")
    def ship(self, o):   raise ValueError("cannot ship")
    def cancel(self, o): raise ValueError("cannot cancel")

class Draft(State):
    def submit(self, o): o.state = Submitted()

class Submitted(State):
    def ship(self, o):   o.state = Shipped()
    def cancel(self, o): o.state = Draft()

class Shipped(State):   # terminal — inherits all-rejecting defaults
    pass

class Order:
    def __init__(self): self.state = Draft()
    def submit(self): self.state.submit(self)
    def ship(self):   self.state.ship(self)
    def cancel(self): self.state.cancel(self)

o = Order(); o.submit(); o.ship()
assert isinstance(o.state, Shipped)
```

---

## Problem 7 — Factory Method selecting a parser by file type

**Statement:** Given a filename, return a parser implementing `parse(text) -> dict`. Support `.json` and `.csv`; adding a format shouldn't touch caller code.

**Constraints:** Unknown extension raises; callers depend on the abstract `Parser`.

**Approach:** A factory inspects the extension and returns the right concrete parser from a registry.

**Complexity:** `O(1)` lookup.

```python
import json, csv, io
from abc import ABC, abstractmethod

class Parser(ABC):
    @abstractmethod
    def parse(self, text: str): ...

class JsonParser(Parser):
    def parse(self, text): return json.loads(text)

class CsvParser(Parser):
    def parse(self, text): return list(csv.DictReader(io.StringIO(text)))

_REGISTRY = {".json": JsonParser, ".csv": CsvParser}

def parser_for(filename: str) -> Parser:
    for ext, cls in _REGISTRY.items():
        if filename.endswith(ext):
            return cls()
    raise ValueError(f"no parser for {filename}")

assert parser_for("a.json").parse('{"x":1}') == {"x": 1}
```
