# Cryptography Basics — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Hashing vs encryption, at-rest/in-transit, signing.

---

## 1. The three goals (and which primitive serves each)

| Goal | Meaning | Primitive |
|---|---|---|
| **Confidentiality** | Only authorized parties can read the data | Encryption (symmetric/asymmetric) |
| **Integrity** | Data hasn't been altered | Hash / MAC / signature |
| **Authenticity** | The data really came from the claimed sender | MAC / digital signature |
| **Non-repudiation** | Sender can't later deny they sent it | Digital signature (asymmetric only) |

A MAC gives integrity + authenticity but *not* non-repudiation (both parties share the key, so either could have produced it). A **digital signature** gives all three because only the holder of the private key could sign.

**Golden rule for interviews:** *Don't roll your own crypto.* Use vetted libraries (libsodium, the platform's `crypto`, AWS KMS) and standard constructions. The interesting questions are about *choosing* and *using* primitives correctly, not implementing AES.

---

## 2. Hashing vs encryption (the most-asked distinction)

- **Hashing is one-way.** A cryptographic hash (SHA-256, SHA-3, BLAKE2) maps arbitrary input to a fixed-size digest. You **cannot** reverse it to recover the input. Used for integrity checks, deduplication, and (with special "password hashes") storing passwords.
- **Encryption is two-way.** With the key you can **decrypt** back to plaintext. Used for confidentiality.

So: "encrypt the password" is **wrong** — passwords should be **hashed** (one-way), because you never need to recover them, only verify them.

### Properties of a cryptographic hash
- **Deterministic** — same input → same digest.
- **Preimage resistance** — given a digest, can't find an input.
- **Second-preimage / collision resistance** — can't find two inputs with the same digest. (MD5 and SHA-1 are **broken** for collision resistance — don't use them for security.)
- **Avalanche** — a 1-bit input change flips ~half the output bits.

---

## 3. Password storage (a special case of hashing)

General-purpose hashes (SHA-256) are **too fast** for passwords — attackers can try billions/sec. Use a **slow, salted, memory-hard password hash**:

- **Argon2id** — current best practice (memory-hard, resists GPU/ASIC attacks). Preferred.
- **scrypt** — also memory-hard, good.
- **bcrypt** — battle-tested, still acceptable (note its ~72-byte input limit).
- **PBKDF2** — acceptable where FIPS compliance is required, but only CPU-hard.

Key terms:
- **Salt** — a unique random value per password, stored alongside the hash. Defeats precomputed **rainbow tables** and ensures identical passwords hash differently. Salts are not secret.
- **Pepper** — an *additional secret* (e.g., from an HSM/KMS) mixed in, stored **separately** from the DB so a DB dump alone is insufficient.
- **Work factor / cost** — tunable iterations/memory; raise it as hardware improves.

Never: plaintext, reversible encryption, fast unsalted hashes, or a single global salt.

---

## 4. Symmetric vs asymmetric encryption

### Symmetric (one shared key)
- **AES** (128/256-bit) is the standard; ChaCha20 is a fast software alternative.
- Fast; used for bulk data. Problem: **key distribution** — both sides need the same secret.
- **Modes & AEAD:** never use raw ECB (it leaks patterns). Use an **AEAD** mode like **AES-GCM** or **ChaCha20-Poly1305**, which provides confidentiality **and** integrity in one step. Each encryption needs a unique **nonce/IV** — reusing a nonce with GCM is catastrophic.

### Asymmetric (public/private key pair)
- **RSA**, **ECC** (elliptic curve, e.g., Curve25519/P-256). Encrypt with the public key, decrypt with the private key — or sign with private, verify with public.
- Slow; used for small payloads, **key exchange**, and signatures — not bulk data.

### Hybrid encryption (how the real world works)
TLS and PGP use asymmetric crypto to **exchange a symmetric session key**, then encrypt the bulk traffic with fast symmetric crypto. Best of both worlds. **Diffie–Hellman (ECDHE)** does key agreement and provides **forward secrecy** — past sessions stay safe even if the long-term key later leaks.

---

## 5. MACs and digital signatures

- **MAC (e.g., HMAC-SHA256)** — keyed hash proving integrity + authenticity to someone who shares the key. Used for cookies, JWT (HS256), API request signing.
- **Digital signature (RSA/ECDSA/EdDSA)** — sign a hash of the message with a **private** key; anyone with the **public** key verifies. Adds **non-repudiation**. Used for code signing, TLS certs, JWT (RS256/ES256).
- **Sign-then-encrypt vs encrypt-then-MAC:** the safe order for authenticated encryption is generally **encrypt-then-MAC** (or just use an AEAD mode and avoid the question).

---

## 6. Data at rest vs in transit

- **In transit:** **TLS** (HTTPS) protects data on the wire — confidentiality + integrity + server authentication via certificates. Enforce TLS 1.2+/1.3, HSTS, and disable old protocols/ciphers. (See the Networking → TLS module.)
- **At rest:** encrypt stored data — disk/volume encryption (transparent, low-effort) and/or **application-level/field encryption** for sensitive fields (PII, secrets). Use a **KMS** to manage keys; data is encrypted with a **data encryption key (DEK)** which is itself encrypted by a **key encryption key (KEK)** in the KMS — **envelope encryption**. This lets you rotate the KEK without re-encrypting all data.

> "Encrypted at rest" via full-disk encryption protects against stolen drives, **not** against an attacker who has app/DB access. Field-level encryption and tight access control address that threat.

---

## 7. Randomness, key management, and rotation

- **CSPRNG only.** Use a cryptographically secure RNG (`secrets`, `crypto.randomBytes`, `/dev/urandom`) for keys, tokens, salts, nonces — **never** `Math.random()` / `rand()`.
- **Key management** is where most real systems fail: where keys live, who can read them, how they rotate, how they're revoked. Prefer a **KMS/HSM**; keep keys out of code and config files.
- **Rotation:** support multiple active keys (key IDs / `kid`) so you can roll forward without downtime. Rotate on schedule and immediately on suspected compromise.

---

## 8. Common pitfalls & misconceptions

- **"Encrypt passwords."** No — **hash** them with Argon2/bcrypt/scrypt. Encryption is reversible.
- **"SHA-256 is fine for passwords."** Too fast; use a slow password hash with salt.
- **Encoding ≠ encryption.** Base64/hex are *encodings* (reversible, no key, no secrecy). JWT payloads are base64 — readable, not protected.
- **ECB mode** leaks plaintext structure (the famous "ECB penguin"). Use AEAD.
- **Nonce/IV reuse** with GCM/CTR breaks confidentiality and integrity.
- **MD5/SHA-1** are broken for security; fine only as non-security checksums.
- **Rolling your own crypto** — almost always introduces subtle, fatal bugs (timing leaks, padding oracles).
- **Confusing salt and pepper** — salt is per-record and stored with the hash; pepper is a global secret stored separately.
- **Non-constant-time comparison** of secrets/MACs leaks via timing — use `hmac.compare_digest`.

---

## 9. What interviewers probe

- Hashing vs encryption, and why passwords are hashed (and *how* — salt, slow hash).
- Symmetric vs asymmetric, and why TLS uses **both** (hybrid).
- What a salt does, what a rainbow table is, and why salts defeat them.
- The difference between a MAC and a signature (who can verify, non-repudiation).
- What forward secrecy is and how ECDHE provides it.
- What AEAD is and why nonce uniqueness matters.
- Envelope encryption / KMS / key rotation for data at rest.

---

## 10. Quick-reference summary

- **Confidentiality → encryption; integrity/authenticity → hash/MAC/signature; non-repudiation → signature.**
- **Hash = one-way; encryption = two-way.** Passwords are **hashed** (Argon2id/bcrypt/scrypt) with a **per-record salt** (+ optional global **pepper**).
- **Symmetric (AES-GCM)** = fast bulk; **asymmetric (RSA/ECC)** = key exchange & signatures; real systems use **hybrid**.
- Use **AEAD** modes, **unique nonces**, and a **CSPRNG** for all randomness.
- **In transit → TLS 1.2+/1.3**; **at rest → KMS + envelope encryption (DEK/KEK)**, plus field encryption for sensitive data.
- **MAC** proves integrity to key-sharers; **signature** adds non-repudiation. **ECDHE → forward secrecy.**
- Avoid MD5/SHA-1, ECB, nonce reuse, `Math.random()`, and **don't roll your own crypto.**
