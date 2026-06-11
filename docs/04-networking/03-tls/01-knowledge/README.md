# TLS & HTTPS — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: TLS handshake, certificates, encryption in transit.

> **🛒 Where we are in building ShopFast** — Last topic we learned [HTTP & Web Protocols](../../02-http/01-knowledge/README.md) — the application-layer language browser and server speak. That raw HTTP stream is completely transparent — anyone on the network path can read or modify it. This topic adds **TLS (Transport Layer Security)**: the encryption, integrity, and authentication layer that turns a raw TCP connection into an HTTPS connection. ShopFast's checkout (`POST /v1/orders`) carries payment data — TLS is what makes that legal and safe. **Next:** [Web Mechanics](../../04-web-mechanics/01-knowledge/README.md) — CORS, cookies, sessions, and caching headers.

---

## Teaching arc: putting a lock on ShopFast's checkout

### What it is

**TLS (Transport Layer Security)** — the successor to the now-deprecated SSL (Secure Sockets Layer) — adds three guarantees on top of a TCP connection:

1. **Confidentiality** — data is encrypted; a network eavesdropper sees ciphertext, not your credit card number.
2. **Integrity** — each record is authenticated; tampering is detected and the connection is aborted.
3. **Authentication** — you know you're talking to the real `api.shopfast.com`, not an impostor.

**HTTPS (HTTP Secure)** is simply HTTP transported inside a TLS session. The HTTP layer is unchanged — TLS is a transparent wrapper below it.

Think of TLS like a sealed, tamper-evident diplomatic pouch with a wax seal from a certified embassy (the CA). You confirm the seal is genuine (certificate chain), open the pouch, and exchange a secret code (session key). From then on all messages go inside new sealed pouches using that secret code — fast to seal, impossible to read without the code, instantly detectable if tampered. The embassy seal (certificate) only needed checking once.

### What it looks like

**TLS 1.3 handshake** — 1 RTT (Round-Trip Time) from TCP connection established to encrypted data flowing:

```
Client                               Server
  │                                    │
  │── ClientHello ───────────────────▶│
  │     supported cipher suites        │
  │     supported TLS versions         │
  │     key_share: client ECDHE pubkey │  ← ECDHE = Elliptic Curve Diffie-Hellman Ephemeral
  │     SNI: "api.shopfast.com"        │  ← SNI = Server Name Indication (picks cert)
  │                                    │
  │◀─ ServerHello ─────────────────── │
  │     chosen cipher suite            │
  │     key_share: server ECDHE pubkey │  ← both sides now compute same session key
  │     {Certificate}           [enc]  │  ← certificate (domain→public-key binding)
  │     {CertificateVerify}     [enc]  │  ← proves server holds the private key
  │     {Finished}              [enc]  │
  │                                    │
  │── {Finished} ───────────────────▶│
  │   + application data starts        │  ← 1 RTT total; data flows immediately
  │                                    │
  │══ AES-GCM encrypted HTTP ═════════│  ← symmetric encryption from here on
```

**Certificate chain of trust** — how the browser decides to trust a server certificate:

```
Root CA (pre-installed in OS/browser trust store — self-signed)
  └─ signed by Root CA → Intermediate CA  (e.g. "Let's Encrypt R11")
       └─ signed by Intermediate → Leaf cert
            CN/SAN: api.shopfast.com
            Public key: (embedded)
            Expiry: 2026-09-01
            Issuer: Let's Encrypt R11
```

The browser trusts the root CA (it was installed by the OS vendor). It walks the chain from the leaf up to a trusted root, verifying each signature along the way.

### The code that builds it

TLS in Node.js — configuring the server certificate. In production ShopFast would use a managed CDN/load balancer (TLS termination at the edge), but understanding the raw API matters:

```typescript
import https from "https";
import fs from "fs";

const server = https.createServer({
  key:  fs.readFileSync("/etc/letsencrypt/live/api.shopfast.com/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/api.shopfast.com/fullchain.pem"), // leaf + intermediates
  // TLS 1.2 still needed for some clients; 1.3 preferred
  minVersion: "TLSv1.2",
  // Modern cipher suites only — drop RC4, CBC-mode ciphers
  ciphers: "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256",
}, app);  // "app" is the Express handler

server.listen(443);

// HSTS header — tell browsers to ONLY use HTTPS for this domain going forward
app.use((req, res, next) => {
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  next();
});
```

Certificate renewal automation (via ACME (Automated Certificate Management Environment) / Let's Encrypt — do not let certs expire):

```bash
# Certbot renews automatically via a cron job; the real risk is forgetting to reload the server
certbot renew --post-hook "systemctl reload nginx"
```

### The code that calls it

The browser/fetch client verifies TLS automatically — if verification fails the request is blocked:

```typescript
// fetch() verifies the TLS cert chain before sending any data
// If the cert is expired, self-signed, or hostname mismatches → TypeError: fetch failed
const res = await fetch("https://api.shopfast.com/v1/products/42");

// For server-to-server calls, you can (but should not in production) disable verification:
import https from "https";
const insecureAgent = new https.Agent({ rejectUnauthorized: false }); // NEVER in production
// → disables chain verification; an attacker can MITM the connection silently
```

### Types & differences

| | TLS 1.2 | TLS 1.3 |
|---|---|---|
| Handshake RTTs | 2 RTT | **1 RTT** (0-RTT on resume) |
| Key exchange | RSA (no PFS) or ECDHE | **ECDHE only** (mandatory PFS (Perfect Forward Secrecy)) |
| Cipher suites | Many (including weak ones) | 5 modern AEAD-only suites |
| Handshake encrypted | Partially | **Fully** (Certificate is encrypted) |
| 0-RTT resumption | No | Yes (with replay caveat) |

**PFS (Perfect Forward Secrecy)** = even if the server's long-term private key is stolen in the future, past sessions cannot be decrypted. TLS 1.3 makes this mandatory via ECDHE (ephemeral keys discarded after each session).

**AEAD (Authenticated Encryption with Associated Data)** = encryption + integrity check in one operation (AES-GCM (Advanced Encryption Standard - Galois/Counter Mode), ChaCha20-Poly1305). TLS 1.3 only allows AEAD cipher suites, removing older CBC (Cipher Block Chaining)-mode suites that had known attack vectors.

**Reach for mTLS (mutual TLS)** when: service-to-service authentication inside a microservices mesh (both sides present certs — not just the server), or strong API client authentication.

### Build it for real — ShopFast

ShopFast handles payment data in `POST /v1/orders`. PCI DSS (Payment Card Industry Data Security Standard) requires encryption in transit; TLS is the mechanism.

**Decision:** **TLS 1.3 terminated at the CDN/load balancer edge**, with re-encryption to backends on sensitive paths (checkout). Use **Let's Encrypt** (free, automated 90-day rotation via ACME) for the leaf certificate. Set `Strict-Transport-Security` (HSTS) to force HTTPS on all future requests. SNI (Server Name Indication) allows `api.shopfast.com` and `www.shopfast.com` to share the same IP at the edge.

**Rejected:** Self-signed certificates — fine for internal dev, but clients will hard-fail and users will see browser warnings, which destroys conversion on a checkout flow. TLS 1.0/1.1 — deprecated, known vulnerabilities (POODLE, BEAST), PCI DSS prohibits them.

> **If you get this wrong:** A TLS certificate expiring silently at midnight is a self-inflicted outage that the entire internet sees simultaneously. The symptom is a browser hard-block ("Your connection is not private") with no graceful degradation — every user, every page, instant 0% conversion. Automate renewal with ACME and alert when a cert has < 30 days remaining.

### Scaling story

- **Now (cheap):** TLS 1.3 at the load balancer, automated ACME renewal, HSTS header, OCSP (Online Certificate Status Protocol) stapling so clients don't have to query the CA for revocation status. One wildcard cert for `*.shopfast.com`.
- **Growth signal:** TLS handshake overhead visible in p99 (99th-percentile latency) when cold connections spike (burst traffic); cert rotation causes a brief service interruption if the reload is not scripted.
- **At scale:** TLS session resumption (TLS tickets) so returning clients skip the full handshake (0-RTT); switch to HTTP/3 at the edge (TLS 1.3 is baked into QUIC, merging transport + crypto into 1 RTT); adopt mTLS (mutual TLS) between internal services as the architecture splits into microservices. Cross-links: [TCP/UDP & DNS](../../02-tcp-udp-dns/01-knowledge/README.md) for the transport underneath; [Web Mechanics](../../05-web-mechanics/01-knowledge/README.md) for HSTS and CORS (Cross-Origin Resource Sharing) at the browser layer.

---

## 1. What TLS gives you

| Property | Mechanism |
|----------|-----------|
| Confidentiality | Symmetric encryption (AES-GCM (Advanced Encryption Standard - Galois/Counter Mode), ChaCha20-Poly1305) of the session |
| Integrity | AEAD (Authenticated Encryption with Associated Data) / MAC (Message Authentication Code) — detects tampering and truncation |
| Authentication | X.509 certificate + chain to a trusted CA (Certificate Authority); optional mutual TLS for the client |
| (Often) Forward secrecy | Ephemeral Diffie-Hellman (ECDHE) per session |

It does **not** give you authorization, application-level access control, or protection once data is decrypted at the endpoint.

---

## 2. The asymmetric → symmetric handoff (the key idea)

Public-key crypto (RSA (Rivest–Shamir–Adleman), ECDSA (Elliptic Curve Digital Signature Algorithm), ECDHE) is slow but lets two strangers agree on a secret without a pre-shared key. Symmetric crypto (AES) is fast but needs a shared key. So TLS uses **asymmetric crypto only to authenticate and to establish a shared symmetric session key**, then encrypts the actual data with that fast symmetric key. Best of both: trust bootstrapping + bulk-data speed.

---

## 3. The TLS 1.3 handshake (1 RTT)

TLS 1.3 streamlined the older 2-RTT (Round-Trip Time) TLS 1.2 dance into **1 RTT** (and 0-RTT for resumption):

```
Client → ClientHello
          - supported cipher suites, TLS versions
          - key_share (client's ephemeral ECDHE public key)
          - SNI (which hostname it wants → server picks the cert)

Server → ServerHello
          - chosen cipher suite
          - key_share (server's ephemeral ECDHE public key)
          - {Certificate, CertificateVerify, Finished}  (now encrypted)

Client → {Finished}  + can start sending application data
```

- After both `key_share`s are exchanged, each side independently computes the same shared secret via ECDHE — **the session key is never transmitted**.
- `CertificateVerify` proves the server owns the private key matching its certificate (signs the handshake transcript).
- TLS 1.2 by contrast took 2 RTT and (in RSA key-exchange mode) sent the premaster secret encrypted with the server's public key — which lacked forward secrecy.

---

## 4. Certificates & the chain of trust

A certificate (X.509) binds a **domain name** to a **public key**, signed by a **CA (Certificate Authority)**.

```
Root CA (in OS/browser trust store, self-signed)
   └─ signs → Intermediate CA
        └─ signs → Leaf cert (your server: CN/SAN = api.example.com)
```

- The browser trusts a small set of **root CAs** preinstalled in its trust store. The server presents the **leaf + intermediates**; the client walks up to a trusted root.
- **SAN (Subject Alternative Name)** lists the hostnames the cert is valid for; the legacy CN (Common Name) is ignored by modern browsers.
- **Validation levels:** DV (Domain Validation — automatic, Let's Encrypt), OV (Organization Validation), EV (Extended Validation, legal entity vetting).
- **Revocation:** CRL (Certificate Revocation List) and OCSP (Online Certificate Status Protocol) check whether a cert was revoked; **OCSP stapling** lets the server attach a fresh signed status so the client needn't query the CA (privacy + latency win).
- **Expiry & rotation:** certs expire (often 90 days with ACME/Let's Encrypt). Automate renewal — an expired cert is a self-inflicted outage that the whole internet sees.

---

## 5. Forward secrecy (PFS)

With **ephemeral** Diffie-Hellman (ECDHE), the session key is derived from per-session ephemeral keys that are discarded afterward. So even if an attacker records all your encrypted traffic today and **steals the server's private key tomorrow**, they still can't decrypt past sessions — each session's secret is gone. TLS 1.3 mandates forward-secret key exchange (no static-RSA key transport). This is why ECDHE matters.

---

## 6. SNI — Server Name Indication

Because one IP can host many TLS sites, the server needs to know *which* certificate to present **before** the encrypted HTTP request arrives. SNI (Server Name Indication) sends the target hostname in the (historically cleartext) ClientHello. **ECH (Encrypted Client Hello)** is the evolving fix that encrypts SNI to close that privacy leak.

---

## 7. 0-RTT resumption (and its caveat)

TLS 1.3 supports session resumption via pre-shared keys (tickets). On reconnect, the client can send **early data in the very first flight (0-RTT)** — no handshake round trip. The caveat: **0-RTT data is replayable** (an attacker can resend it). So only use 0-RTT for **idempotent, safe requests** (GET), never for state-changing POSTs.

---

## 8. TLS termination & where encryption ends

- **Termination at the load balancer / CDN:** TLS is decrypted at the edge; traffic to backends may be plaintext (inside a trusted network) or **re-encrypted** (TLS passthrough / mTLS) for zero-trust. Know which your design assumes.
- **mTLS (mutual TLS):** the *client* also presents a cert — used for service-to-service auth inside a mesh, or strong API client authentication.
- **HSTS (HTTP Strict Transport Security)** (`Strict-Transport-Security`): tells browsers to *only* use HTTPS for this domain going forward, defeating SSL-strip downgrade attacks. Preload lists bake this into browsers.

---

## 9. Common pitfalls & misconceptions

- "HTTPS means the site is safe/trustworthy." No — it means the *channel* is encrypted and the domain is authenticated. A phishing site can have a valid DV cert.
- "TLS encrypts the URL path." The path is encrypted, but the **hostname leaks via SNI (Server Name Indication)** (until ECH (Encrypted Client Hello)) and via the DNS (Domain Name System) lookup that preceded it.
- Forgetting cert **expiry** → outage. Automate ACME (Automated Certificate Management Environment) renewal and alert well ahead.
- Using **0-RTT for non-idempotent requests** → replay-induced duplicate actions.
- Assuming TLS termination at the LB (Load Balancer) means backend traffic is safe — inside many "trusted" networks it's plaintext; zero-trust requires re-encryption/mTLS.
- Confusing **encryption-in-transit (TLS)** with **encryption-at-rest** — they protect different threats; you usually need both.

---

## 10. What interviewers probe

- "Walk me through a TLS 1.3 handshake. Where does asymmetric stop and symmetric begin?"
- "What is forward secrecy and why does ECDHE provide it?"
- "Explain the certificate chain of trust and how the browser decides to trust a cert."
- "Your site went down at midnight with cert errors — what happened?" (expiry.)
- "Why is 0-RTT dangerous for POST?" (replay.)
- "What does SNI leak and how is ECH addressing it?"
- "TLS 1.2 vs 1.3 — what changed?" (1 RTT, mandatory PFS, AEAD-only, encrypted handshake, removed legacy ciphers.)

---

## Quick-reference summary

- TLS = confidentiality + integrity + authentication over TCP/QUIC; HTTPS = HTTP-in-TLS.
- Handshake uses **asymmetric** crypto to authenticate + agree on a key, then **symmetric** (AES-GCM) for bulk data.
- TLS 1.3: **1-RTT** handshake (0-RTT on resume), mandatory **forward secrecy** via ECDHE, AEAD-only, encrypted handshake messages.
- **Certificate** = CA-signed binding of domain → public key; client walks leaf → intermediate → trusted root.
- **SNI** selects the cert (leaks hostname → ECH encrypts it); **OCSP stapling** for revocation; **HSTS** to force HTTPS.
- 0-RTT is replayable → idempotent requests only. Automate cert rotation. Know where TLS terminates.
