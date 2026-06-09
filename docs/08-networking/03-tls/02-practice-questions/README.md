# TLS & HTTPS — Practice Questions

[← Topic overview](../README.md)

> Topic: TLS handshake, certificates, encryption in transit.

---

### Q1. Why does TLS use both asymmetric and symmetric cryptography?

**Answer:** They have complementary strengths. **Asymmetric** crypto (ECDHE/RSA/ECDSA) lets two parties who have never met authenticate each other and agree on a secret without a pre-shared key — but it's computationally expensive. **Symmetric** crypto (AES-GCM, ChaCha20) is fast and cheap but requires a shared key. So TLS uses asymmetric crypto only during the handshake — to authenticate the server and establish a shared **session key** — then switches to symmetric encryption for the actual data. You get trust bootstrapping plus bulk-data speed.

---

### Q2. Explain the chain of trust to a junior.

**Answer:** Your browser ships with a list of trusted **root CAs**. Your server doesn't have a cert signed directly by a root; instead a root signs an **intermediate** CA, and the intermediate signs your server's **leaf** certificate. When the server presents its leaf (plus intermediates), the browser verifies each signature up the chain until it reaches a root it already trusts. If every link checks out and the leaf's SAN matches the hostname and it isn't expired/revoked, the browser trusts it. It's "I trust the root, the root vouches for the intermediate, the intermediate vouches for you."

---

### Q3. What is forward secrecy and how does ECDHE provide it?

**Answer:** Forward secrecy means that compromising the server's long-term private key in the future does **not** let an attacker decrypt traffic they recorded in the past. ECDHE (Ephemeral Elliptic-Curve Diffie-Hellman) generates a **fresh ephemeral key pair for each session** and derives the session key from it; the ephemeral keys are discarded after the handshake. Since the session secret was never derived from (or encrypted with) the long-term key and no longer exists, recorded ciphertext stays unreadable even if the server key later leaks. TLS 1.3 mandates this by removing static-RSA key transport.

---

### Q4. A production site starts returning certificate errors at midnight with no deploy. What's the likely cause and fix?

**Answer:** The **certificate expired**. Certs have a fixed validity window (often 90 days with ACME). When it lapses, every client rejects the connection — a total, self-inflicted outage. Immediate fix: renew/reissue the cert and deploy it. Root-cause fix: **automate renewal** (certbot/ACME with auto-reload), monitor days-to-expiry with alerts firing weeks ahead, and ensure the renewal job actually reloads the serving process. Also check intermediate cert expiry, not just the leaf.

---

### Q5. Why is TLS 1.3's 0-RTT resumption dangerous for some requests?

**Answer:** 0-RTT lets the client send application data in its very first message on a resumed connection, before the handshake completes — saving a round trip. But this **early data is replayable**: a network attacker can capture and resend it, and the server can't distinguish the replay from the original within the 0-RTT window. For idempotent, safe requests (a GET) that's harmless. For state-changing requests (a POST that charges a card or posts a message), a replay could duplicate the action. So 0-RTT must be restricted to idempotent operations, with replay protection for anything else.

---

### Q6. What does SNI do, what does it leak, and how is that being fixed?

**Answer:** **SNI (Server Name Indication)** is the hostname the client includes in the ClientHello so a server hosting many sites on one IP knows which certificate to present — necessary because cert selection must happen before the encrypted HTTP request. The leak: historically SNI is sent in **cleartext**, so an on-path observer learns which site you're visiting even though the rest is encrypted (and the prior DNS lookup leaks it too). **ECH (Encrypted Client Hello)** encrypts the SNI using a public key published via DNS, closing this metadata leak.

---

### Q7. (MCQ) In TLS 1.3, how many round trips does a fresh (non-resumed) handshake take?

- A) 0
- B) 1
- C) 2
- D) 3

**Answer: B.** TLS 1.3 completes a full handshake in **1 RTT** (the client sends its key_share in the ClientHello, the server responds with its key_share + cert, and data can flow). Resumption can be **0-RTT**. TLS 1.2 needed 2 RTT.

---

### Q8. (MCQ) Which guarantee does TLS NOT provide?

- A) Confidentiality of the data
- B) Integrity / tamper detection
- C) Authentication of the server's identity
- D) Authorization of what the user may access

**Answer: D.** TLS secures the *channel* (confidentiality, integrity) and authenticates the server (and optionally the client via mTLS). **Authorization** — deciding what an authenticated party is allowed to do — is an application concern, not TLS's job.

---

### Q9. (MCQ) OCSP stapling improves things by:

- A) Encrypting the certificate
- B) Having the server attach a recent signed revocation status, so the client needn't contact the CA
- C) Making certs last longer
- D) Replacing the CA hierarchy

**Answer: B.** With OCSP stapling, the server periodically fetches a CA-signed "this cert is still valid" response and *staples* it to the handshake. The client gets revocation status without a separate OCSP query to the CA — better latency and privacy (the CA doesn't see who's visiting).

---

### Q10. (MCQ) A site has a valid HTTPS certificate. What does this guarantee?

- A) The site is trustworthy and not malicious
- B) The connection is encrypted and the domain name is authenticated by a CA
- C) The server stores your data encrypted at rest
- D) The site cannot be phished

**Answer: B.** A valid cert means the channel is encrypted and the domain was validated by a CA. It says **nothing** about the site's intentions (phishing sites can get free DV certs) or how data is stored server-side (at-rest encryption is separate).

---

### Q11. Does TLS termination at a load balancer mean backend traffic is secure?

**Answer:** Not automatically. "TLS termination at the LB" means the LB decrypts the TLS session, and what happens next depends on configuration. In a classic perimeter model, traffic from LB → backends may be **plaintext** inside the "trusted" network — which a zero-trust posture considers unsafe (lateral movement, sniffing). To secure it you either re-encrypt (LB → backend over its own TLS), use **mTLS** between services (common in a service mesh), or keep the backends on an isolated, encrypted network segment. The key senior point: always know *where* TLS terminates and whether the hops past that point are protected.
