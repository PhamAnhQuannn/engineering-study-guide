# Cryptography Basics — Practice Questions

[← Topic overview](../README.md)

> Topic: Hashing vs encryption, at-rest/in-transit, signing.

---

### Q1. What is the difference between hashing and encryption?

**Answer:** **Hashing is one-way**: a cryptographic hash maps input to a fixed-size digest that you cannot reverse to recover the input. It's used for integrity checks and password storage. **Encryption is two-way**: with the correct key you can decrypt ciphertext back to plaintext, providing confidentiality. So you encrypt data you need to read back later, and you hash data you only need to *verify* (like passwords).

---

### Q2. Explain to a junior why we hash passwords instead of encrypting them.

**Answer:** You never need to *recover* a user's password — you only need to check whether the password they typed matches what they registered. Hashing supports exactly that: hash the input and compare digests. Encryption would be reversible, meaning whoever holds the key (or steals it) can recover every password. With hashing there's no key to steal and no way back to the plaintext. We use a **slow, salted** password hash (Argon2id/bcrypt) so attackers can't brute-force the stolen hashes quickly.

---

### Q3. What is a salt, and what attack does it defeat?

**Answer:** A salt is a unique, random value generated per password and stored alongside the hash. It ensures two users with the same password get different hashes, and — crucially — it defeats **rainbow tables** (precomputed hash→password lookup tables): because each password is salted differently, an attacker would need a separate table per salt, making precomputation useless. Salts are not secret; their value is in being unique per record.

---

### Q4. Salt vs pepper — what's the difference?

**Answer:** A **salt** is per-record, random, and stored *with* the hash (in the DB). A **pepper** is a single global secret mixed into every hash and stored *separately* from the database (e.g., in a KMS/HSM or app secret). The point of a pepper: if an attacker dumps only the database, they still lack the pepper, so the stolen hashes are much harder to crack. Salt protects against precomputation; pepper adds a secret the DB dump doesn't contain.

---

### Q5. Why does TLS use both asymmetric and symmetric cryptography?

**Answer:** Asymmetric crypto solves key distribution and authentication (via certificates) but is slow; symmetric crypto is fast but needs both sides to share a secret. TLS combines them (**hybrid encryption**): it uses asymmetric operations / Diffie–Hellman to authenticate the server and **agree on a symmetric session key**, then encrypts the actual traffic with fast symmetric crypto (AES-GCM/ChaCha20-Poly1305). With ECDHE this also provides **forward secrecy**.

---

### Q6. What is forward secrecy and how is it achieved?

**Answer:** Forward secrecy means that compromising a server's long-term private key in the future does **not** let an attacker decrypt previously recorded sessions. It's achieved by using **ephemeral Diffie–Hellman (ECDHE)**: each session negotiates a fresh, short-lived key that is discarded afterward and never derivable from the long-term key alone. So recorded ciphertext stays safe even after a later key compromise.

---

### Q7. Explain the difference between a MAC and a digital signature.

**Answer:** Both verify integrity and authenticity, but:
- A **MAC** (e.g., HMAC) uses a **shared symmetric key** — anyone holding the key can both create and verify it. It does **not** provide non-repudiation, because either party could have produced it.
- A **digital signature** uses an **asymmetric key pair**: the signer uses their **private** key, and anyone can verify with the **public** key. Only the private-key holder could have signed, so it adds **non-repudiation**.
Use a MAC when both sides share a secret (cookies, HS256 JWTs); use a signature when verifiers shouldn't be able to forge and you need provable origin (code signing, TLS certs, RS256 JWTs).

---

### Q8. What is AEAD and why does nonce uniqueness matter?

**Answer:** AEAD (Authenticated Encryption with Associated Data) modes — like **AES-GCM** and **ChaCha20-Poly1305** — provide confidentiality *and* integrity in a single operation, so you don't have to bolt on a separate MAC. They require a **nonce/IV** that must be **unique** per key. Reusing a nonce in GCM is catastrophic: it can leak the plaintext relationship between messages and even allow forgery of the authentication tag. Hence: never reuse a nonce; generate it from a counter or a CSPRNG.

---

### Q9. What's the difference between "encrypted at rest" via full-disk encryption and application-level encryption?

**Answer:** **Full-disk/volume encryption** protects data if someone steals the physical drive, but it's transparent to the running system — an attacker with app or database access reads plaintext. **Application/field-level encryption** encrypts specific sensitive fields before storage, so even with DB access the attacker sees ciphertext without the key (managed in a KMS). The first guards against lost hardware; the second guards against logical/credential compromise. Sensitive PII often warrants both.

---

### Q10 (MCQ). Which is the most appropriate way to store user passwords?

A. AES-256 encryption with a server-side key
B. SHA-256 of the password
C. Argon2id with a per-user salt
D. Base64 encoding

**Answer: C.** Argon2id is a slow, memory-hard password hash; with a per-user salt it resists brute force and rainbow tables. A is reversible (wrong tool). B is too fast and (here) unsalted. D is encoding, not protection at all.

---

### Q11 (MCQ). You need confidentiality *and* integrity for stored messages with a single primitive. Pick one.

A. AES in ECB mode
B. AES-GCM (an AEAD mode)
C. SHA-256
D. RSA encryption of the whole message

**Answer: B.** AES-GCM is an AEAD mode giving both confidentiality and integrity. ECB leaks plaintext patterns and gives no integrity. SHA-256 is a hash (no confidentiality, not reversible). RSA isn't used for bulk data and gives no integrity by itself.

---

### Q12 (MCQ). Which random source is safe for generating cryptographic keys and tokens?

A. `Math.random()` / `rand()`
B. The current timestamp
C. A CSPRNG (`secrets`, `crypto.randomBytes`, `/dev/urandom`)
D. A counter starting at 1

**Answer: C.** Cryptographic material must come from a cryptographically secure RNG. `Math.random()` is predictable, timestamps are low-entropy and guessable, and a plain counter is fully predictable.

---

### Q13. Why is comparing secrets/MACs with `==` dangerous, and what's the fix?

**Answer:** A normal equality check often **short-circuits on the first differing byte**, so the time it takes reveals how many leading bytes matched — a **timing side channel** an attacker can use to recover the secret byte-by-byte. The fix is a **constant-time comparison** (e.g., `hmac.compare_digest`) that always examines the full length regardless of where the mismatch is, leaking no timing information.
