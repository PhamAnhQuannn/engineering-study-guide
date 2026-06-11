# Web Mechanics — Coding Problems

[← Topic overview](../README.md)

> Topic: CORS, cookies, sessions, caching headers.

These problems exercise the *mechanics* — parsing/serializing cookies and cache headers, implementing CORS logic, signing/verifying stateless sessions. Each gives a statement + constraints, an approach, complexity, and a worked solution.

---

## P1. CORS preflight responder

**Statement:** Implement `handle_preflight(request_headers, config)` that, given an incoming `OPTIONS` preflight's headers and a server CORS config (allowed origins, methods, headers, whether credentials are allowed, max-age), returns the correct set of CORS response headers — or `None` if the request must be rejected. Honor the rule that `*` origin is illegal with credentials.

**Constraints:** Origin allowlist can be exact strings or `"*"`. Header/method matching is case-insensitive for methods, case-insensitive for header names.

**Approach:** Validate the `Origin` against the allowlist; if credentials are enabled, reflect the specific origin (never `*`). Check the requested method and requested headers are subsets of what's allowed. Emit the standard `Access-Control-*` response headers.

**Complexity:** O(H) where H = number of requested headers (set membership). Space O(1) beyond the config sets.

```python
def handle_preflight(req: dict, config: dict):
    origin = req.get("Origin")
    allowed_origins = config["origins"]          # set[str] or {"*"}
    creds = config.get("credentials", False)

    # Origin check
    if "*" in allowed_origins and not creds:
        allow_origin = "*"
    elif origin in allowed_origins:
        allow_origin = origin                    # reflect specific origin
    else:
        return None                              # reject: origin not allowed

    if creds and allow_origin == "*":
        return None                              # illegal combination

    # Method check
    req_method = (req.get("Access-Control-Request-Method") or "").upper()
    allowed_methods = {m.upper() for m in config["methods"]}
    if req_method and req_method not in allowed_methods:
        return None

    # Header check (case-insensitive)
    req_headers = [h.strip().lower()
                   for h in (req.get("Access-Control-Request-Headers") or "").split(",")
                   if h.strip()]
    allowed_headers = {h.lower() for h in config["headers"]}
    if any(h not in allowed_headers for h in req_headers):
        return None

    resp = {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Methods": ", ".join(sorted(allowed_methods)),
        "Access-Control-Allow-Headers": ", ".join(sorted(allowed_headers)),
        "Access-Control-Max-Age": str(config.get("max_age", 600)),
    }
    if creds:
        resp["Access-Control-Allow-Credentials"] = "true"
        resp["Vary"] = "Origin"                  # cache correctly per origin
    return resp
```

---

## P2. Parse a `Cookie` header into a dict

**Statement:** Parse an HTTP `Cookie` request header (`"a=1; b=2; sessionId=xyz"`) into a key→value map. Later duplicates should not silently overwrite without intent; keep the first occurrence (per RFC 6265 ordering semantics, first match wins for lookups).

**Constraints:** Values may contain `=` (split on the first only). Trim whitespace. Skip malformed pairs with no name.

**Approach:** Split on `;`, split each pair on the first `=`, trim, insert if not already present.

**Complexity:** O(n) over the header length. Space O(k) for k cookies.

```python
def parse_cookies(header: str) -> dict[str, str]:
    cookies: dict[str, str] = {}
    if not header:
        return cookies
    for pair in header.split(";"):
        pair = pair.strip()
        if not pair or "=" not in pair:
            continue
        name, _, value = pair.partition("=")     # split on first '='
        name = name.strip()
        if name and name not in cookies:          # first occurrence wins
            cookies[name] = value.strip()
    return cookies
```

---

## P3. Build a secure `Set-Cookie` header

**Statement:** Given a name, value, and options, serialize a `Set-Cookie` header string with correct attribute formatting. Enforce the invariant: `SameSite=None` requires `Secure`.

**Constraints:** Support `Max-Age`, `Path`, `Domain`, `HttpOnly`, `Secure`, `SameSite` (`Strict|Lax|None`). Raise on the `None`+insecure violation.

**Approach:** Append flag attributes conditionally; validate the SameSite/Secure rule before emitting.

**Complexity:** O(1). Space O(1).

```python
def set_cookie(name, value, *, max_age=None, path="/", domain=None,
               http_only=True, secure=True, same_site="Lax") -> str:
    if same_site == "None" and not secure:
        raise ValueError("SameSite=None requires Secure")

    parts = [f"{name}={value}"]
    if max_age is not None:
        parts.append(f"Max-Age={max_age}")
    parts.append(f"Path={path}")
    if domain:
        parts.append(f"Domain={domain}")
    if same_site:
        parts.append(f"SameSite={same_site}")
    if secure:
        parts.append("Secure")
    if http_only:
        parts.append("HttpOnly")
    return "; ".join(parts)

# set_cookie("sid", "abc", max_age=3600)
# -> "sid=abc; Max-Age=3600; Path=/; SameSite=Lax; Secure; HttpOnly"
```

---

## P4. Stateless signed-session token (sign & verify)

**Statement:** Implement `sign(payload, secret)` and `verify(token, secret)` for a compact stateless session token: base64url(payload) + "." + base64url(HMAC-SHA256). `verify` must reject tampering and expired tokens, using a constant-time comparison.

**Constraints:** Payload is JSON with an `exp` (unix seconds). Use `hmac.compare_digest` to avoid timing attacks.

**Approach:** HMAC the encoded payload; on verify, recompute and constant-time compare, then check `exp`.

**Complexity:** O(n) over payload size for HMAC. Space O(n).

```python
import hmac, hashlib, json, base64, time

def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def sign(payload: dict, secret: bytes) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(secret, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"

def verify(token: str, secret: bytes) -> dict | None:
    try:
        body, sig = token.split(".", 1)
    except ValueError:
        return None
    expected = _b64(hmac.new(secret, body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):     # constant-time
        return None
    payload = json.loads(_unb64(body))
    if payload.get("exp", 0) < int(time.time()):    # expiry check
        return None
    return payload
```

---

## P5. Cache freshness / revalidation decision

**Statement:** Given a cached response's stored headers (`Cache-Control`, `ETag`, `Date`, `Age`) and the current time, decide one of: `FRESH` (serve from cache), `REVALIDATE` (conditional request with `If-None-Match`), or `FETCH` (no usable cache entry). Implement the core of a mini HTTP cache.

**Constraints:** Respect `no-store` (→ FETCH, never cached in the first place), `no-cache` (→ always REVALIDATE), and `max-age` vs age.

**Approach:** Parse `Cache-Control` directives; apply precedence: `no-store` → `no-cache` → freshness lifetime (`max-age` minus current age).

**Complexity:** O(d) over the number of directives. Space O(d).

```python
def cache_decision(headers: dict, now: float, response_time: float) -> str:
    cc = {}
    for d in headers.get("Cache-Control", "").split(","):
        d = d.strip().lower()
        if not d:
            continue
        k, _, v = d.partition("=")
        cc[k] = v or True

    if "no-store" in cc:
        return "FETCH"
    if "no-cache" in cc:
        return "REVALIDATE" if "ETag" in headers else "FETCH"

    if "max-age" in cc:
        max_age = int(cc["max-age"])
        age = (now - response_time) + int(headers.get("Age", 0))
        if age < max_age:
            return "FRESH"
        return "REVALIDATE" if "ETag" in headers else "FETCH"

    return "FETCH"        # no freshness info -> must fetch
```

---

## P6. Generate an `ETag` and answer a conditional request

**Statement:** Implement `respond(body, req_headers)` that computes a strong `ETag` (hash of the body) and returns `304 Not Modified` (no body) when the client's `If-None-Match` matches, else `200` with the body and the ETag header.

**Constraints:** Strong ETag = quoted hex digest. Handle multiple comma-separated client ETags and `*`.

**Approach:** Hash the body; compare against the client's `If-None-Match` set; branch on match.

**Complexity:** O(n) to hash the body. Space O(1) beyond the digest.

```python
import hashlib

def respond(body: bytes, req_headers: dict) -> dict:
    etag = '"' + hashlib.sha256(body).hexdigest()[:16] + '"'
    inm = req_headers.get("If-None-Match", "")
    client_tags = {t.strip() for t in inm.split(",") if t.strip()}

    if "*" in client_tags or etag in client_tags:
        return {"status": 304, "headers": {"ETag": etag}, "body": b""}
    return {
        "status": 200,
        "headers": {"ETag": etag, "Content-Length": str(len(body))},
        "body": body,
    }
```

---

## P7. Origin allowlist matcher with wildcard subdomains

**Statement:** Implement `origin_allowed(origin, patterns)` supporting exact origins and a single wildcard subdomain pattern like `https://*.example.com`. The wildcard must match exactly one or more subdomain labels but must NOT match the apex or a different scheme/port.

**Constraints:** Patterns: `"https://app.example.com"` (exact) or `"https://*.example.com"` (wildcard). Reject scheme/port mismatches.

**Approach:** For wildcards, split scheme and host; require the origin's host to end with `.<base>` and share scheme/port.

**Complexity:** O(p) over the number of patterns. Space O(1).

```python
from urllib.parse import urlsplit

def origin_allowed(origin: str, patterns: list[str]) -> bool:
    o = urlsplit(origin)
    for pat in patterns:
        if pat == origin:
            return True
        if "*." in pat:
            p = urlsplit(pat.replace("*.", "", 1))   # base after wildcard
            if o.scheme == p.scheme and o.port == p.port:
                base = p.hostname or ""
                # must be a strict subdomain, not the apex itself
                if o.hostname and o.hostname.endswith("." + base):
                    return True
    return False

# origin_allowed("https://app.example.com", ["https://*.example.com"]) -> True
# origin_allowed("https://example.com",     ["https://*.example.com"]) -> False
# origin_allowed("http://app.example.com",  ["https://*.example.com"]) -> False
```
