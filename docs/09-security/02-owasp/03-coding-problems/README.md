# OWASP Top 10 — Coding Problems

[← Topic overview](../README.md)

> Topic: SQLi, XSS, CSRF, common web vulnerabilities.

Each problem: statement + constraints → approach → time/space complexity → worked solution. These focus on *finding and fixing* the vulnerability — the senior skill the interview tests.

---

## P1. Fix a SQL-injectable lookup

**Statement:** The function below authenticates a user by email and password hash. It's vulnerable to SQLi. Rewrite it safely. Constraint: keep the same DB API (Python DB-API `cursor`), no ORM.

**Approach:** Replace string concatenation with **parameterized placeholders** so input is bound as data. The DB driver sends query text and values separately.

**Complexity:** Query cost is unchanged — O(1) extra work; the fix is structural, not algorithmic. Space O(1).

```python
# VULNERABLE
def find_user(cur, email, pw_hash):
    q = "SELECT id FROM users WHERE email = '%s' AND pw_hash = '%s'" % (email, pw_hash)
    cur.execute(q)              # email="' OR '1'='1' --" bypasses auth
    return cur.fetchone()

# FIXED — parameterized query
def find_user(cur, email, pw_hash):
    cur.execute(
        "SELECT id FROM users WHERE email = %s AND pw_hash = %s",
        (email, pw_hash),       # values bound separately; never parsed as SQL
    )
    return cur.fetchone()
```

> Note: a `%s` placeholder here is the DB-API parameter marker, *not* Python string formatting. For `ORDER BY <col>` (can't be parameterized), validate against an allow-list of column names.

---

## P2. Safe dynamic `ORDER BY` (allow-listing)

**Statement:** An endpoint sorts results by a user-supplied column and direction. You can't parameterize identifiers. Make it injection-safe.

**Approach:** Map user input through an **allow-list**; reject anything not in it. Never interpolate raw identifiers.

**Complexity:** O(1) lookup. Space O(k) for the allow-list (k = allowed columns).

```python
ALLOWED_COLS = {"created_at", "name", "price"}   # exact, vetted set
ALLOWED_DIR  = {"ASC", "DESC"}

def list_products(cur, sort_col, direction):
    if sort_col not in ALLOWED_COLS:
        raise ValueError("invalid sort column")
    direction = direction.upper()
    if direction not in ALLOWED_DIR:
        raise ValueError("invalid direction")
    # identifiers come ONLY from our allow-list, never from raw input
    cur.execute(f"SELECT id, name, price FROM products ORDER BY {sort_col} {direction}")
    return cur.fetchall()
```

---

## P3. Fix a stored-XSS rendering path

**Statement:** A comment is rendered into a page via string interpolation in a template. Make it XSS-safe while still allowing plain text. Language: JavaScript (DOM).

**Approach:** Use a **non-script sink** (`textContent`), which the browser treats as literal text. If rich HTML must be allowed, sanitize with DOMPurify instead.

**Complexity:** O(n) in the length of the comment for assignment/sanitization. Space O(n).

```javascript
// VULNERABLE — attacker comment "<img src=x onerror=alert(document.cookie)>" runs
container.innerHTML = comment;

// FIXED (plain text) — textContent never parses HTML/script
container.textContent = comment;

// FIXED (rich HTML allowed) — sanitize, allow-list safe tags only
import DOMPurify from "dompurify";
container.innerHTML = DOMPurify.sanitize(comment, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
  ALLOWED_ATTR: ["href"],
});
```

---

## P4. Implement a synchronizer-token CSRF guard

**Statement:** Add CSRF protection to a cookie-authenticated POST endpoint using the synchronizer-token pattern. Pseudocode/Python (Flask-style).

**Approach:** Issue a random token bound to the session, embed it in the form, and validate it on mutating requests with a **constant-time compare**. Pair with `SameSite` cookies.

**Complexity:** Token gen O(1) (fixed bytes); compare O(t) in token length, constant-time. Space O(1) per session.

```python
import secrets, hmac

def issue_csrf_token(session):
    token = secrets.token_urlsafe(32)   # 256 bits of entropy
    session["csrf"] = token
    return token                        # render into a hidden form field

def require_csrf(session, submitted_token):
    expected = session.get("csrf")
    if not expected or submitted_token is None:
        abort(403)
    # constant-time comparison avoids timing side channels
    if not hmac.compare_digest(expected, submitted_token):
        abort(403)

# Also set the session cookie: Secure, HttpOnly, SameSite=Lax
```

---

## P5. Detect & block SSRF to internal/metadata ranges

**Statement:** A service fetches a user-supplied URL (webhook validation). Prevent SSRF to localhost, private, and link-local ranges (incl. cloud metadata `169.254.169.254`). Python.

**Approach:** Resolve the host, reject non-http(s) schemes, and **block private/loopback/link-local IPs**. Resolve once and connect to the resolved IP to avoid DNS-rebinding (shown conceptually).

**Complexity:** O(1) per check beyond DNS resolution. Space O(1).

```python
import ipaddress, socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}

def is_safe_url(url: str) -> bool:
    p = urlparse(url)
    if p.scheme not in ALLOWED_SCHEMES or not p.hostname:
        return False
    try:
        # resolve all addresses the host maps to
        infos = socket.getaddrinfo(p.hostname, p.port or 80, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return False
    for _, _, _, _, sockaddr in infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast):
            return False                # blocks 127.0.0.0/8, 10/8, 169.254/16, etc.
    return True
```

> Production hardening: pin the connection to the validated IP (prevent DNS rebinding), set timeouts, disable redirects (or re-validate each hop), and enforce IMDSv2 at the infra layer.

---

## P6. Spot the broken access control (IDOR) and fix it

**Statement:** This endpoint returns an invoice by ID but leaks across users. Fix the authorization. Python (ORM-ish).

**Approach:** Scope every query to the **authenticated principal**; return 404 (not 403) to avoid confirming existence.

**Complexity:** O(1) extra predicate; uses the existing index on `(id, account_id)`. Space O(1).

```python
# VULNERABLE — any authenticated user reads any invoice
def get_invoice(db, invoice_id, current_user):
    return db.query(Invoice).filter(Invoice.id == invoice_id).one_or_none()

# FIXED — scope to the owner; 404 hides existence
def get_invoice(db, invoice_id, current_user):
    inv = (db.query(Invoice)
             .filter(Invoice.id == invoice_id,
                     Invoice.account_id == current_user.account_id)   # ownership check
             .one_or_none())
    if inv is None:
        abort(404)
    return inv
```

---

## P7. Constant-time secret comparison (timing attack)

**Statement:** An API-key check uses `==`, leaking timing information that lets attackers recover the key byte-by-byte. Fix it. Python.

**Approach:** Use a **constant-time** comparison so runtime doesn't depend on how many leading bytes match. Better still, compare fixed-length HMACs of both sides.

**Complexity:** O(n) over the full key length regardless of match position. Space O(1) (or O(n) for the HMAC variant).

```python
import hmac, hashlib

# VULNERABLE — short-circuits on first mismatch -> timing oracle
def check_key(provided, expected):
    return provided == expected

# FIXED — constant-time compare
def check_key(provided: str, expected: str) -> bool:
    return hmac.compare_digest(provided, expected)

# STRONGER — compare HMACs so length/content of secret isn't directly compared
def check_key_hmac(provided: str, expected: str, pepper: bytes) -> bool:
    a = hmac.new(pepper, provided.encode(), hashlib.sha256).digest()
    b = hmac.new(pepper, expected.encode(), hashlib.sha256).digest()
    return hmac.compare_digest(a, b)
```
