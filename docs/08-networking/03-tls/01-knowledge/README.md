# TLS & HTTPS — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: TLS handshake, certificates, encryption in transit.

TLS (Transport Layer Security, the successor to SSL) provides three guarantees on top of TCP/QUIC: **confidentiality** (encryption), **integrity** (tamper detection), and **authentication** (you're really talking to who the certificate claims). HTTPS is just HTTP carried inside TLS. A senior is expected to explain the handshake, the certificate trust chain, the asymmetric→symmetric handoff, forward secrecy, and operational realities like cert rotation and TLS termination.

---

## 1. What TLS gives you

| Property | Mechanism |
|----------|-----------|
| Confidentiality | Symmetric encryption (AES-GCM, ChaCha20-Poly1305) of the session |
| Integrity | AEAD / MAC — detects tampering and truncation |
| Authentication | X.509 certificate + chain to a trusted CA; optional mutual TLS for the client |
| (Often) Forward secrecy | Ephemeral Diffie-Hellman (ECDHE) per session |

It does **not** give you authorization, application-level access control, or protection once data is decrypted at the endpoint.

---

## 2. The asymmetric → symmetric handoff (the key idea)

Public-key crypto (RSA, ECDSA, ECDHE) is slow but lets two strangers agree on a secret without a pre-shared key. Symmetric crypto (AES) is fast but needs a shared key. So TLS uses **asymmetric crypto only to authenticate and to establish a shared symmetric session key**, then encrypts the actual data with that fast symmetric key. Best of both: trust bootstrapping + bulk-data speed.

---

## 3. The TLS 1.3 handshake (1 RTT)

TLS 1.3 streamlined the older 2-RTT TLS 1.2 dance into **1 RTT** (and 0-RTT for resumption):

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

A certificate (X.509) binds a **domain name** to a **public key**, signed by a **Certificate Authority (CA)**.

```
Root CA (in OS/browser trust store, self-signed)
   └─ signs → Intermediate CA
        └─ signs → Leaf cert (your server: CN/SAN = api.example.com)
```

- The browser trusts a small set of **root CAs** preinstalled in its trust store. The server presents the **leaf + intermediates**; the client walks up to a trusted root.
- **SAN (Subject Alternative Name)** lists the hostnames the cert is valid for; the legacy CN is ignored by modern browsers.
- **Validation levels:** DV (domain-validated, automatic — Let's Encrypt), OV (organization), EV (extended, legal entity vetting).
- **Revocation:** CRL (lists) and OCSP (query) check whether a cert was revoked; **OCSP stapling** lets the server attach a fresh signed status so the client needn't query the CA (privacy + latency win).
- **Expiry & rotation:** certs expire (often 90 days with ACME/Let's Encrypt). Automate renewal — an expired cert is a self-inflicted outage that the whole internet sees.

---

## 5. Forward secrecy (PFS)

With **ephemeral** Diffie-Hellman (ECDHE), the session key is derived from per-session ephemeral keys that are discarded afterward. So even if an attacker records all your encrypted traffic today and **steals the server's private key tomorrow**, they still can't decrypt past sessions — each session's secret is gone. TLS 1.3 mandates forward-secret key exchange (no static-RSA key transport). This is why ECDHE matters.

---

## 6. SNI — Server Name Indication

Because one IP can host many TLS sites, the server needs to know *which* certificate to present **before** the encrypted HTTP request arrives. SNI sends the target hostname in the (historically cleartext) ClientHello. **ECH (Encrypted Client Hello)** is the evolving fix that encrypts SNI to close that privacy leak.

---

## 7. 0-RTT resumption (and its caveat)

TLS 1.3 supports session resumption via pre-shared keys (tickets). On reconnect, the client can send **early data in the very first flight (0-RTT)** — no handshake round trip. The caveat: **0-RTT data is replayable** (an attacker can resend it). So only use 0-RTT for **idempotent, safe requests** (GET), never for state-changing POSTs.

---

## 8. TLS termination & where encryption ends

- **Termination at the load balancer / CDN:** TLS is decrypted at the edge; traffic to backends may be plaintext (inside a trusted network) or **re-encrypted** (TLS passthrough / mTLS) for zero-trust. Know which your design assumes.
- **mTLS (mutual TLS):** the *client* also presents a cert — used for service-to-service auth inside a mesh, or strong API client authentication.
- **HSTS** (`Strict-Transport-Security`): tells browsers to *only* use HTTPS for this domain going forward, defeating SSL-strip downgrade attacks. Preload lists bake this into browsers.

---

## 9. Common pitfalls & misconceptions

- "HTTPS means the site is safe/trustworthy." No — it means the *channel* is encrypted and the domain is authenticated. A phishing site can have a valid DV cert.
- "TLS encrypts the URL path." The path is encrypted, but the **hostname leaks via SNI** (until ECH) and via the DNS lookup that preceded it.
- Forgetting cert **expiry** → outage. Automate ACME renewal and alert well ahead.
- Using **0-RTT for non-idempotent requests** → replay-induced duplicate actions.
- Assuming TLS termination at the LB means backend traffic is safe — inside many "trusted" networks it's plaintext; zero-trust requires re-encryption/mTLS.
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
