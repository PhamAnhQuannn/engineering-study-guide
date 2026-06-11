# Clean Code — Coding Problems

[← Topic overview](../README.md)

> Topic: Readability, abstractions, naming, code smells.

Each problem presents **smelly before** code and a **clean after**, plus the principle applied. These are behavior-preserving cleanups — the exact "read this messy snippet and improve it" task common in senior screens. Complexity is noted where relevant (most are unchanged; the win is readability).

---

## Problem 1 — Replace magic numbers/strings and clarify naming

**Statement:** Clean up a status check riddled with magic numbers and a cryptic name.
**Smell:** Magic numbers, non-intention-revealing names.
**Move:** Named constants + rename. **Complexity:** unchanged.

```python
# BEFORE
def p(o):
    if o["s"] == 2 and o["t"] > 100:
        return o["t"] * 0.9
    return o["t"]
```

```python
# AFTER
class OrderStatus:
    SHIPPED = 2

VIP_THRESHOLD = 100
VIP_DISCOUNT_RATE = 0.9

def apply_loyalty_discount(order) -> float:
    total = order["total"]
    if order["status"] == OrderStatus.SHIPPED and total > VIP_THRESHOLD:
        return total * VIP_DISCOUNT_RATE
    return total
```

---

## Problem 2 — Flatten nesting with guard clauses

**Statement:** Deeply nested validation forms an "arrow" shape. Flatten it.
**Smell:** Arrow code / deep nesting.
**Move:** Guard clauses (early returns). **Complexity:** unchanged.

```python
# BEFORE — arrow code
def withdraw(account, amount):
    if account is not None:
        if account["active"]:
            if amount > 0:
                if account["balance"] >= amount:
                    account["balance"] -= amount
                    return True
                else:
                    return False
            else:
                return False
        else:
            return False
    else:
        return False
```

```python
# AFTER — guard clauses; the happy path is unindented and obvious
def withdraw(account, amount) -> bool:
    if account is None or not account["active"]:
        return False
    if amount <= 0 or account["balance"] < amount:
        return False
    account["balance"] -= amount
    return True
```

---

## Problem 3 — Split a function with a flag argument

**Statement:** A function's behavior is controlled by a boolean flag.
**Smell:** Flag argument → function does two things; cryptic call sites.
**Move:** Split into two intention-revealing functions sharing a helper. **Complexity:** unchanged.

```python
# BEFORE
def export_report(data, as_pdf):
    rows = _render_rows(data)
    if as_pdf:
        return _to_pdf(rows)
    else:
        return _to_csv(rows)
# call site: export_report(data, True)   # True what?
```

```python
# AFTER
def export_report_as_pdf(data):
    return _to_pdf(_render_rows(data))

def export_report_as_csv(data):
    return _to_csv(_render_rows(data))
# call site: export_report_as_pdf(data)  # self-documenting
```

---

## Problem 4 — Extract explaining variables / decompose a boolean

**Statement:** A condition is an unreadable boolean soup.
**Smell:** Complex inline condition; reader can't tell intent.
**Move:** Extract explaining variables. **Complexity:** unchanged.

```python
# BEFORE
def can_checkout(user, cart):
    return (user is not None and user.get("verified") and not user.get("banned")
            and len(cart["items"]) > 0 and cart["total"] <= user.get("credit_limit", 0))
```

```python
# AFTER — each clause is named; the final return reads like English
def can_checkout(user, cart) -> bool:
    if user is None:
        return False
    is_eligible_user = user.get("verified") and not user.get("banned")
    has_items = len(cart["items"]) > 0
    within_credit = cart["total"] <= user.get("credit_limit", 0)
    return is_eligible_user and has_items and within_credit
```

---

## Problem 5 — Replace primitive obsession with a value object

**Statement:** Money is passed around as bare floats, inviting currency-mixing and rounding bugs.
**Smell:** Primitive obsession; domain meaning lost.
**Move:** Introduce a `Money` value object. **Complexity:** unchanged; correctness/clarity improved.

```python
# BEFORE — floats everywhere; nothing stops adding USD to EUR
def total(prices):            # prices: list[float]
    return sum(prices)
```

```python
# AFTER — Money carries currency; mixing currencies is an explicit error
from dataclasses import dataclass

@dataclass(frozen=True)
class Money:
    amount_cents: int          # integer cents avoids float rounding
    currency: str

    def __add__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(f"cannot add {self.currency} to {other.currency}")
        return Money(self.amount_cents + other.amount_cents, self.currency)

def total(prices: list[Money]) -> Money:
    result = prices[0]
    for p in prices[1:]:
        result = result + p
    return result
```

---

## Problem 6 — Enforce Command-Query Separation (remove a hidden side effect)

**Statement:** A "getter" secretly mutates state (creates the user if absent), surprising callers.
**Smell:** Query with hidden side effect; misleading name.
**Move:** Separate the command from the query. **Complexity:** unchanged.

```python
# BEFORE — get_user() also creates; callers can't safely "just check"
class UserService:
    def __init__(self, db): self.db = db
    def get_user(self, uid):
        u = self.db.get(uid)
        if u is None:
            u = {"id": uid, "created": True}
            self.db[uid] = u          # surprise mutation inside a "get"
        return u
```

```python
# AFTER — query is pure; creation is an explicit command
class UserService:
    def __init__(self, db): self.db = db

    def find_user(self, uid):                 # query: no side effects
        return self.db.get(uid)

    def create_user(self, uid):               # command: explicit mutation
        user = {"id": uid, "created": True}
        self.db[uid] = user
        return user

    def get_or_create_user(self, uid):        # honest name when both are wanted
        return self.find_user(uid) or self.create_user(uid)
```

---

## Problem 7 — Single Level of Abstraction (SLAP) + extract functions

**Statement:** One function mixes high-level policy with low-level detail. Make it read like a summary.
**Smell:** Mixed abstraction levels; long function.
**Move:** Extract functions so the top reads as named steps. **Complexity:** unchanged.

```python
# BEFORE — high-level intent buried in low-level detail
def send_welcome(user):
    # validate
    if "@" not in user["email"]:
        raise ValueError("bad email")
    # build body
    body = "Hello " + user["name"] + ",\n" + "Welcome!\n" + "Team"
    # send
    import smtplib
    s = smtplib.SMTP("localhost")
    s.sendmail("noreply@x.com", user["email"], body)
    s.quit()
```

```python
# AFTER — the top function reads as three named steps; details live below
def send_welcome(user):
    _validate_email(user["email"])
    body = _build_welcome_body(user)
    _send_email(to=user["email"], body=body)

def _validate_email(email: str) -> None:
    if "@" not in email:
        raise ValueError("bad email")

def _build_welcome_body(user) -> str:
    return f"Hello {user['name']},\nWelcome!\nTeam"

def _send_email(to: str, body: str) -> None:
    import smtplib
    s = smtplib.SMTP("localhost")
    s.sendmail("noreply@x.com", to, body)
    s.quit()
```
