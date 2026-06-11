# Refactoring & Tech Debt — Coding Problems

[← Topic overview](../README.md)

> Topic: Safe refactor, legacy code, tech debt management.

Each problem gives **before** code (with a smell), the refactoring move, and **after** code. The behavior must be preserved — these are pure refactors. Treat them as "here's smelly code, clean it up" interview exercises.

---

## Problem 1 — Replace conditional with polymorphism

**Statement:** A type-switch grows with every new shape. Refactor to satisfy Open/Closed.
**Constraints:** Behavior identical; adding a shape must not edit existing dispatch.
**Move:** Replace Conditional with Polymorphism.
**Complexity:** Dispatch goes from `O(k)` switch scan to `O(1)` virtual call; space unchanged.

```python
# BEFORE — switch sprawl, OCP violation
def area(shape):
    if shape["type"] == "circle":
        return 3.14159 * shape["r"] ** 2
    elif shape["type"] == "rect":
        return shape["w"] * shape["h"]
    elif shape["type"] == "triangle":
        return 0.5 * shape["b"] * shape["h"]
    raise ValueError("unknown shape")
```

```python
# AFTER — polymorphism; new shape = new class, no edits to callers
from abc import ABC, abstractmethod
import math

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Circle(Shape):
    def __init__(self, r): self.r = r
    def area(self): return math.pi * self.r ** 2

class Rect(Shape):
    def __init__(self, w, h): self.w, self.h = w, h
    def area(self): return self.w * self.h

class Triangle(Shape):
    def __init__(self, b, h): self.b, self.h = b, h
    def area(self): return 0.5 * self.b * self.h
```

---

## Problem 2 — Extract function + guard clauses (decompose a long method)

**Statement:** A long method mixes validation, calculation, and formatting with deep nesting. Decompose it.
**Constraints:** Same output; reduce nesting and name the pieces.
**Move:** Extract Function + Replace Nested Conditional with Guard Clauses.
**Complexity:** Unchanged (`O(1)`); readability improved.

```python
# BEFORE — long, nested, hard to test
def invoice_total(order):
    if order is not None:
        if order["items"]:
            subtotal = 0
            for it in order["items"]:
                subtotal += it["price"] * it["qty"]
            if order["country"] == "US":
                tax = subtotal * 0.07
            else:
                tax = subtotal * 0.20
            return round(subtotal + tax, 2)
        else:
            return 0.0
    else:
        return 0.0
```

```python
# AFTER — guard clauses + extracted, testable helpers
def invoice_total(order) -> float:
    if not order or not order["items"]:
        return 0.0
    subtotal = _subtotal(order["items"])
    return round(subtotal + _tax(subtotal, order["country"]), 2)

def _subtotal(items) -> float:
    return sum(it["price"] * it["qty"] for it in items)

def _tax(subtotal: float, country: str) -> float:
    rate = 0.07 if country == "US" else 0.20
    return subtotal * rate
```

---

## Problem 3 — Introduce parameter object (long parameter list)

**Statement:** A function takes 6 positional geo/address params that always travel together.
**Constraints:** Same behavior; remove the parameter clump.
**Move:** Introduce Parameter Object.
**Complexity:** Unchanged.

```python
# BEFORE — long parameter list / data clump
def ship(street, city, state, zip_code, country, recipient):
    return f"Shipping to {recipient}: {street}, {city}, {state} {zip_code}, {country}"
```

```python
# AFTER — cohesive Address value object
from dataclasses import dataclass

@dataclass(frozen=True)
class Address:
    street: str; city: str; state: str
    zip_code: str; country: str

def ship(address: Address, recipient: str) -> str:
    a = address
    return (f"Shipping to {recipient}: {a.street}, {a.city}, "
            f"{a.state} {a.zip_code}, {a.country}")
```

---

## Problem 4 — Move method (fix feature envy)

**Statement:** `Order.shipping_cost` reaches into `Customer` fields more than its own. Move the logic to where the data lives.
**Constraints:** Behavior preserved.
**Move:** Move Method.
**Complexity:** Unchanged.

```python
# BEFORE — feature envy: Order computes using Customer's internals
class Customer:
    def __init__(self, tier, region): self.tier, self.region = tier, region

class Order:
    def __init__(self, customer, weight): self.customer, self.weight = customer, weight
    def shipping_cost(self):
        c = self.customer
        base = self.weight * 2
        if c.tier == "gold": base *= 0.5
        if c.region == "remote": base += 10
        return base
```

```python
# AFTER — discount logic lives on Customer; Order just asks
class Customer:
    def __init__(self, tier, region): self.tier, self.region = tier, region
    def adjust_shipping(self, base: float) -> float:
        if self.tier == "gold": base *= 0.5
        if self.region == "remote": base += 10
        return base

class Order:
    def __init__(self, customer, weight): self.customer, self.weight = customer, weight
    def shipping_cost(self) -> float:
        return self.customer.adjust_shipping(self.weight * 2)
```

---

## Problem 5 — Characterization test before refactoring legacy code

**Statement:** You must refactor a gnarly legacy `legacy_discount` but have no tests and don't fully trust the rules. Pin current behavior first.
**Constraints:** Tests must capture *actual* current output (even if surprising), so the upcoming refactor can't change behavior.
**Approach:** Probe representative inputs, record the real outputs as a golden table, then assert against them.
**Complexity:** Test runtime `O(n)` over `n` rows.

```python
def legacy_discount(total, code):           # the untested code we must keep behaving identically
    d = 0
    if total > 100: d = 10
    if code == "VIP": d += 15
    if total > 100 and code == "VIP": d -= 5   # quirky interaction — but it's current behavior
    return total - d

import pytest

# Golden table = OBSERVED current outputs (not idealized). This pins behavior.
CASES = [
    (50,  "",    50),
    (150, "",    140),
    (50,  "VIP", 35),
    (150, "VIP", 130),   # 150 - (10 + 15 - 5) = 130  -> captures the quirk
]

@pytest.mark.parametrize("total,code,expected", CASES)
def test_characterize_legacy_discount(total, code, expected):
    assert legacy_discount(total, code) == expected
# With this net green, we can now refactor legacy_discount safely.
```

---

## Problem 6 — Branch by Abstraction (swap an implementation safely)

**Statement:** Replace a slow `JsonStore` with a faster `BinStore` without a risky big-bang switch and without breaking callers mid-migration.
**Constraints:** Callers must not change; old and new can coexist; switch is reversible (a flag).
**Move:** Branch by Abstraction.
**Complexity:** Lookup unchanged; enables incremental, reversible migration.

```python
from abc import ABC, abstractmethod

class Store(ABC):                       # 1. introduce abstraction over the thing being replaced
    @abstractmethod
    def get(self, k): ...
    @abstractmethod
    def put(self, k, v): ...

class JsonStore(Store):                 # 2. existing impl behind the abstraction
    def __init__(self): self._d = {}
    def get(self, k): return self._d.get(k)
    def put(self, k, v): self._d[k] = v

class BinStore(Store):                  # 3. new impl built behind the same abstraction
    def __init__(self): self._d = {}
    def get(self, k): return self._d.get(k)
    def put(self, k, v): self._d[k] = v

def make_store(use_new: bool) -> Store: # 4. flag the switch; reversible, incremental
    return BinStore() if use_new else JsonStore()

# Callers depend only on `Store`; flip the flag to migrate, flip back to roll back.
store: Store = make_store(use_new=False)
store.put("a", 1); assert store.get("a") == 1
# 5. once BinStore is proven in prod for all traffic, delete JsonStore + the flag.
```
