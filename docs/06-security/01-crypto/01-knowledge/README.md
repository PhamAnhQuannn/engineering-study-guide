# Cryptography Basics — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Hashing vs encryption, at-rest/in-transit, signing.

> **🛒 Where we are in building ShopFast** — Last topic we completed [DB Operations](../../../05-databases/05-db-operations/01-knowledge/README.md) — keeping the database running safely in production. Now we protect the data itself: this topic adds the cryptographic layer that keeps ShopFast's **payment card data and PII (Personally Identifiable Information) safe** — at rest in the database and in transit over the network. **Next:** [AuthN & AuthZ](../../02-auth/01-knowledge/README.md) — applying crypto primitives to protect ShopFast users with OAuth, JWT, and sessions.

---

## Teaching arc: cryptography in ShopFast's payment flow

### What it is

Cryptography is the science of protecting information — turning it into something that looks like noise to anyone who doesn't have the right key. There are three goals, and each maps to a different primitive (building block):

1. **Confidentiality** — only authorized parties can read it → **encryption**
2. **Integrity** — the data hasn't been altered → **hash / MAC (Message Authentication Code) / signature**
3. **Authenticity** — it really came from who it claims → **MAC / digital signature**

A useful analogy: think of a physical mail system. **Encryption** is putting the letter in a sealed envelope — only the recipient with the key can open it. A **hash** is like a wax seal — anyone can see it, but if the seal is broken you know the letter was tampered with. A **digital signature** is a wax seal that only you can make (your private key), but anyone can verify (your public key) — and you can't later deny you made it.

The golden rule for interviews and production systems: **don't roll your own crypto.** Use vetted libraries (libsodium, the platform `crypto` module, AWS KMS (Key Management Service)) and standard constructions. The interesting questions are about *choosing* and *using* primitives correctly, not reimplementing AES (Advanced Encryption Standard).

---

### What it looks like

ShopFast's payment data flow, annotated with which crypto primitive protects each leg:

```
Customer Browser
    │
    │  ① TLS (Transport Layer Security) 1.3 — in transit
    │     ECDHE (Elliptic Curve Diffie-Hellman Ephemeral) key exchange
    │     + AES-GCM (AES Galois/Counter Mode — AEAD) bulk encryption
    │     + server cert signed with ECDSA (Elliptic Curve Digital Signature Algorithm)
    ▼
ShopFast API Server
    │
    │  ② Application never stores raw card numbers.
    │     Tokenization via payment processor (Stripe/Adyen).
    │     Only the processor's opaque token + last-4 stored in orders table.
    │
    │  ③ User passwords stored as Argon2id hash (never plaintext, never reversible)
    │     salt: 16 bytes random (per-user), stored alongside hash
    │
    ▼
Postgres (Database at rest)
    │  ④ Full-disk / volume encryption: AES-256
    │     Protects against stolen drives; does NOT protect against
    │     an attacker with DB credentials (that's field encryption's job)
    │
    │  ⑤ Sensitive fields (e.g., stored payment tokens, PII address fields)
    │     Field-level encryption with AES-GCM (AEAD)
    │     DEK (Data Encryption Key) in app memory, encrypted by
    │     KEK (Key Encryption Key) stored in KMS — envelope encryption
    ▼
KMS (Key Management Service — AWS KMS / HashiCorp Vault)
    │  Holds the KEK (Key Encryption Key)
    │  DEK (Data Encryption Key) never stored plaintext anywhere;
    │  only decrypted transiently in memory during field reads
```

---

### The code that builds it

Password hashing (Argon2id) and field-level encryption (AES-GCM via envelope pattern):

```typescript
import argon2 from "argon2";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ── Password storage ─────────────────────────────────────────────────────────

// Register: hash the password before storing — never store plaintext
async function hashPassword(plaintext: string): Promise<string> {
  // argon2id is memory-hard (resists GPU cracking) and time-hard.
  // The salt is generated and embedded automatically — stored alongside the hash.
  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: 65536,   // 64 MiB — raise as hardware improves
    timeCost: 3,
    parallelism: 1,
  });
}

// Login: verify by hashing the candidate and comparing — never decrypt
async function verifyPassword(plaintext: string, storedHash: string): Promise<boolean> {
  return argon2.verify(storedHash, plaintext);
  // Uses constant-time comparison internally — no timing leak
}

// ── Field-level encryption (envelope pattern) ────────────────────────────────
// Real systems use KMS SDK; this illustrates the pattern with Node.js crypto.

const KEY_LENGTH = 32; // AES-256

// Encrypt a sensitive field using a per-record DEK (Data Encryption Key)
// wrapped by the KEK (Key Encryption Key) from KMS
function encryptField(plaintext: string, dek: Buffer): { ciphertext: string; iv: string } {
  const iv = randomBytes(12); // 96-bit nonce — MUST be unique per (key, message) pair
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag(); // GCM auth tag — integrity + authenticity (AEAD)
  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

// Decrypt — only works with the same DEK and IV; authTag prevents tampering
function decryptField(ciphertext: string, iv: string, dek: Buffer): string {
  const buf = Buffer.from(ciphertext, "base64");
  const authTag = buf.subarray(buf.length - 16); // last 16 bytes = GCM auth tag
  const encrypted = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", dek, Buffer.from(iv, "base64"));
  decipher.setAuthTag(authTag); // if tag fails → throws → tampering detected
  return decipher.update(encrypted) + decipher.final("utf8");
}
```

---

### The code that calls it

Using envelope encryption in the order service — DEK (Data Encryption Key) fetched from KMS (Key Management Service), used transiently, never persisted in plaintext:

```typescript
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";

const kms = new KMSClient({ region: "us-east-1" });

// When saving a payment token to the orders table
async function storeOrderPaymentRef(orderId: string, paymentToken: string) {
  // 1. Ask KMS to generate a DEK (Data Encryption Key).
  //    KMS returns: plaintext DEK (for this request only) + encrypted DEK (to store)
  const { Plaintext: dek, CiphertextBlob: encryptedDek } = await kms.send(
    new GenerateDataKeyCommand({ KeyId: "alias/shopfast-orders", KeySpec: "AES_256" })
  );

  // 2. Encrypt the sensitive field with the plaintext DEK
  const { ciphertext, iv } = encryptField(paymentToken, Buffer.from(dek!));

  // 3. Store ciphertext + iv + encryptedDek in the DB — the plaintext DEK is DISCARDED
  await db.query(
    "UPDATE orders SET payment_token_enc=$1, payment_token_iv=$2, dek_enc=$3 WHERE id=$4",
    [ciphertext, iv, Buffer.from(encryptedDek!).toString("base64"), orderId]
  );
  // plaintext DEK is garbage-collected — never touches disk
}

// When reading back
async function readOrderPaymentRef(orderId: string) {
  const row = await db.query("SELECT * FROM orders WHERE id=$1", [orderId]);
  // 1. Ask KMS to decrypt the stored encrypted DEK
  const { Plaintext: dek } = await kms.send(
    new DecryptCommand({ CiphertextBlob: Buffer.from(row.dek_enc, "base64") })
  );
  // 2. Decrypt the field — throws if tampered (AEAD integrity check)
  return decryptField(row.payment_token_enc, row.payment_token_iv, Buffer.from(dek!));
}
```

---

### Types & differences

| Primitive | One-way? | Key needed? | What it proves | ShopFast use |
|---|---|---|---|---|
| **Hash (SHA-256, BLAKE2)** | Yes | No | Integrity (no key) | Checksums, deduplication |
| **Password hash (Argon2id, bcrypt)** | Yes | No (but salted) | Nothing — just irreversible | Storing user passwords |
| **HMAC (Hash-based Message Authentication Code — HMAC-SHA256)** | Yes | Yes (shared) | Integrity + authenticity | JWT (JSON Web Token) HS256, webhook signatures |
| **Symmetric encryption (AES-GCM)** | No (reversible) | Yes (shared) | Confidentiality + integrity (AEAD) | Field encryption, at-rest data |
| **Asymmetric encryption (RSA, ECC)** | No (reversible) | Public/private pair | Confidentiality | TLS (Transport Layer Security) key exchange |
| **Digital signature (ECDSA, EdDSA)** | Yes | Private to sign, public to verify | Integrity + authenticity + non-repudiation | JWT RS256/ES256, code signing, TLS certs |

**Reach for:**
- Passwords → **Argon2id** (memory-hard, not reversible)
- Data you need back → **AES-GCM** with a KMS-managed key
- Verifying a JWT with one secret → **HMAC-SHA256** (HS256)
- Verifying a JWT across many services → **RS256 or ES256** (each service holds only public key)
- TLS bulk data → **AES-GCM or ChaCha20-Poly1305** (negotiated by the handshake)

---

### Build it for real — ShopFast

ShopFast is PCI (Payment Card Industry) DSS (Data Security Standard) scoped because it handles payment card data. The cryptographic decisions are driven by PCI requirements and the threat of a DB breach:

**Payment data:**
- **Decision:** we do **not** store raw Primary Account Numbers (PANs / card numbers). Stripe/Adyen tokenization means the processor holds the card; we store only their opaque token and last-4. This keeps ShopFast in the smallest PCI scope tier (SAQ A / redirected).
- Where we must store payment references (the processor token, billing address), we use **field-level AES-256-GCM (AES Galois/Counter Mode)** with **envelope encryption**: per-record DEK (Data Encryption Key), KEK (Key Encryption Key) in AWS KMS (Key Management Service). A DB breach without KMS access is meaningless ciphertext.

**Passwords:**
- **Decision:** **Argon2id** with 64 MiB memory cost. If our user table leaks, offline cracking is GPU-impractical.
- **Rejected:** bcrypt — still acceptable but has a 72-byte input limit and is less resistant to ASIC attacks; Argon2id is the modern standard. MD5/SHA-1/SHA-256 as password hashes — catastrophically fast; an attacker with a GPU can try billions of candidates per second.

**In transit:**
- **Decision:** TLS (Transport Layer Security) 1.2+ enforced everywhere; TLS 1.3 preferred (0-RTT disabled on checkout to avoid replay risk). HSTS (HTTP Strict Transport Security) header with a long `max-age` preloads the domain. All internal service-to-service calls also use mTLS (mutual TLS) once services split.

> **If you get this wrong…** Storing passwords as SHA-256 hashes (fast, unsalted) means a leaked DB allows offline cracking of every user's password in hours on commodity hardware. Storing card numbers in plaintext violates PCI DSS and, upon breach, triggers mandatory customer notification, card reissuance, and potentially millions in fines. These are not theoretical — the Target breach (2013) and multiple others originated from exactly this: plaintext card data in a DB that an attacker reached.

---

### Scaling story

- **Now (launch):** Argon2id for passwords, Stripe tokenization (no PAN storage), AES-GCM field encryption for billing addresses via AWS KMS, TLS 1.3 at edge. Cost: KMS API calls ~$0.03 per 10K requests — negligible at launch.
- **Growth signal:** key rotation becomes risky as the number of encrypted rows grows (re-encrypting a million rows with a new DEK is a long, risky migration). KMS costs grow linearly with decryption calls at scale.
- **At scale (millions+):** implement **envelope encryption** properly — per-record DEK (already above) means rotating the KEK (Key Encryption Key) in KMS re-wraps only the small DEK ciphertext, not all the data. Cache decrypted DEKs in memory with a short TTL to reduce KMS call volume. Adopt **FIPS (Federal Information Processing Standard) 140-2 validated** modules if enterprise/government clients require it. See [Secrets](../../04-secrets/01-knowledge/README.md) for how the KMS key ID and payment processor API keys are stored.

---

## 1. The three goals (and which primitive serves each)

| Goal | Meaning | Primitive |
|---|---|---|
| **Confidentiality** | Only authorized parties can read the data | Encryption (symmetric/asymmetric) |
| **Integrity** | Data hasn't been altered | Hash / MAC (Message Authentication Code) / signature |
| **Authenticity** | The data really came from the claimed sender | MAC / digital signature |
| **Non-repudiation** | Sender can't later deny they sent it | Digital signature (asymmetric only) |

A MAC (Message Authentication Code) gives integrity + authenticity but *not* non-repudiation (both parties share the key, so either could have produced it). A **digital signature** gives all three because only the holder of the private key could sign.

**Golden rule for interviews:** *Don't roll your own crypto.* Use vetted libraries (libsodium, the platform's `crypto`, AWS KMS (Key Management Service)) and standard constructions. The interesting questions are about *choosing* and *using* primitives correctly, not implementing AES.

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
- **PBKDF2 (Password-Based Key Derivation Function 2)** — acceptable where FIPS (Federal Information Processing Standard) compliance is required, but only CPU-hard.

Key terms:
- **Salt** — a unique random value per password, stored alongside the hash. Defeats precomputed **rainbow tables** and ensures identical passwords hash differently. Salts are not secret.
- **Pepper** — an *additional secret* (e.g., from an HSM / Hardware Security Module / KMS) mixed in, stored **separately** from the DB so a DB dump alone is insufficient.
- **Work factor / cost** — tunable iterations/memory; raise it as hardware improves.

Never: plaintext, reversible encryption, fast unsalted hashes, or a single global salt.

---

## 4. Symmetric vs asymmetric encryption

### Symmetric (one shared key)
- **AES (Advanced Encryption Standard)** (128/256-bit) is the standard; ChaCha20 is a fast software alternative.
- Fast; used for bulk data. Problem: **key distribution** — both sides need the same secret.
- **Modes & AEAD (Authenticated Encryption with Associated Data):** never use raw ECB (Electronic Codebook — it leaks patterns). Use an **AEAD** mode like **AES-GCM (AES Galois/Counter Mode)** or **ChaCha20-Poly1305**, which provides confidentiality **and** integrity in one step. Each encryption needs a unique **nonce/IV (Initialization Vector)** — reusing a nonce with GCM is catastrophic.

### Asymmetric (public/private key pair)
- **RSA**, **ECC (Elliptic Curve Cryptography)** (e.g., Curve25519/P-256). Encrypt with the public key, decrypt with the private key — or sign with private, verify with public.
- Slow; used for small payloads, **key exchange**, and signatures — not bulk data.

### Hybrid encryption (how the real world works)
TLS (Transport Layer Security) and PGP use asymmetric crypto to **exchange a symmetric session key**, then encrypt the bulk traffic with fast symmetric crypto. Best of both worlds. **DH (Diffie–Hellman) / ECDHE (Elliptic Curve Diffie-Hellman Ephemeral)** does key agreement and provides **forward secrecy** — past sessions stay safe even if the long-term key later leaks.

---

## 5. MACs and digital signatures

- **MAC (Message Authentication Code — e.g., HMAC-SHA256)** — keyed hash proving integrity + authenticity to someone who shares the key. Used for cookies, JWT (JSON Web Token — HS256), API request signing.
- **Digital signature (RSA/ECDSA/EdDSA)** — sign a hash of the message with a **private** key; anyone with the **public** key verifies. Adds **non-repudiation**. Used for code signing, TLS (Transport Layer Security) certs, JWT (RS256/ES256).
- **Sign-then-encrypt vs encrypt-then-MAC:** the safe order for authenticated encryption is generally **encrypt-then-MAC** (or just use an AEAD mode and avoid the question).

---

## 6. Data at rest vs in transit

- **In transit:** **TLS (Transport Layer Security)** (HTTPS) protects data on the wire — confidentiality + integrity + server authentication via certificates. Enforce TLS 1.2+/1.3, HSTS (HTTP Strict Transport Security), and disable old protocols/ciphers. (See the Networking → TLS module.)
- **At rest:** encrypt stored data — disk/volume encryption (transparent, low-effort) and/or **application-level/field encryption** for sensitive fields (PII / Personally Identifiable Information, secrets). Use a **KMS (Key Management Service)** to manage keys; data is encrypted with a **DEK (Data Encryption Key)** which is itself encrypted by a **KEK (Key Encryption Key)** in the KMS — **envelope encryption**. This lets you rotate the KEK without re-encrypting all data.

> "Encrypted at rest" via full-disk encryption protects against stolen drives, **not** against an attacker who has app/DB access. Field-level encryption and tight access control address that threat.

---

## 7. Randomness, key management, and rotation

- **CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) only.** Use a cryptographically secure RNG (`secrets`, `crypto.randomBytes`, `/dev/urandom`) for keys, tokens, salts, nonces — **never** `Math.random()` / `rand()`.
- **Key management** is where most real systems fail: where keys live, who can read them, how they rotate, how they're revoked. Prefer a **KMS (Key Management Service) / HSM (Hardware Security Module)**; keep keys out of code and config files.
- **Rotation:** support multiple active keys (key IDs / `kid`) so you can roll forward without downtime. Rotate on schedule and immediately on suspected compromise.

---

## 8. Common pitfalls & misconceptions

- **"Encrypt passwords."** No — **hash** them with Argon2/bcrypt/scrypt. Encryption is reversible.
- **"SHA-256 is fine for passwords."** Too fast; use a slow password hash with salt.
- **Encoding ≠ encryption.** Base64/hex are *encodings* (reversible, no key, no secrecy). JWT (JSON Web Token) payloads are base64 — readable, not protected.
- **ECB (Electronic Codebook) mode** leaks plaintext structure (the famous "ECB penguin"). Use AEAD (Authenticated Encryption with Associated Data).
- **Nonce/IV (Initialization Vector) reuse** with GCM/CTR breaks confidentiality and integrity.
- **MD5/SHA-1** are broken for security; fine only as non-security checksums.
- **Rolling your own crypto** — almost always introduces subtle, fatal bugs (timing leaks, padding oracles).
- **Confusing salt and pepper** — salt is per-record and stored with the hash; pepper is a global secret stored separately.
- **Non-constant-time comparison** of secrets/MACs leaks via timing — use `hmac.compare_digest`.

---

## 9. What interviewers probe

- Hashing vs encryption, and why passwords are hashed (and *how* — salt, slow hash).
- Symmetric vs asymmetric, and why TLS (Transport Layer Security) uses **both** (hybrid).
- What a salt does, what a rainbow table is, and why salts defeat them.
- The difference between a MAC (Message Authentication Code) and a signature (who can verify, non-repudiation).
- What forward secrecy is and how ECDHE (Elliptic Curve Diffie-Hellman Ephemeral) provides it.
- What AEAD (Authenticated Encryption with Associated Data) is and why nonce uniqueness matters.
- Envelope encryption / KMS (Key Management Service) / key rotation for data at rest.

---

## 10. Quick-reference summary

- **Confidentiality → encryption; integrity/authenticity → hash/MAC/signature; non-repudiation → signature.**
- **Hash = one-way; encryption = two-way.** Passwords are **hashed** (Argon2id/bcrypt/scrypt) with a **per-record salt** (+ optional global **pepper**).
- **Symmetric (AES-GCM / AES Galois/Counter Mode)** = fast bulk; **asymmetric (RSA/ECC)** = key exchange & signatures; real systems use **hybrid**.
- Use **AEAD (Authenticated Encryption with Associated Data)** modes, **unique nonces**, and a **CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)** for all randomness.
- **In transit → TLS (Transport Layer Security) 1.2+/1.3**; **at rest → KMS (Key Management Service) + envelope encryption (DEK / Data Encryption Key / KEK / Key Encryption Key)**, plus field encryption for sensitive data.
- **MAC (Message Authentication Code)** proves integrity to key-sharers; **signature** adds non-repudiation. **ECDHE (Elliptic Curve Diffie-Hellman Ephemeral) → forward secrecy.**
- Avoid MD5/SHA-1, ECB (Electronic Codebook), nonce reuse, `Math.random()`, and **don't roll your own crypto.**
