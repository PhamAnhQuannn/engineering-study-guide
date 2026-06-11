# TCP/UDP & DNS — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Transport protocols, handshakes, DNS resolution.

> **🛒 Where we are in building ShopFast** — Last topic we learned [Refactoring & Tech Debt](../../../03-code-quality-and-architecture/05-refactoring/01-knowledge/README.md) — safe refactoring with a test net in place. Now we go beneath the code: how does data actually travel from browser to server? This topic covers **TCP (Transmission Control Protocol)**, **UDP (User Datagram Protocol)**, and **DNS (Domain Name System)**: TCP is the reliable pipe that HTTP rides over, UDP is the fast-but-unreliable alternative (and the foundation of HTTP/3's QUIC), and DNS is the directory service that turns `api.shopfast.com` into an IP address before any connection can begin. **Next:** [HTTP & Web Protocols](../../02-http/01-knowledge/README.md) — the application-layer protocol that rides on top of TCP.

---

## Teaching arc: the wire under ShopFast's API

### What it is

**TCP (Transmission Control Protocol)** is the reliable, ordered, connection-oriented transport protocol that HTTP/1.1 and HTTP/2 ride over. "Reliable" means if a packet is lost, TCP retransmits it — you don't lose data. "Ordered" means even if packets arrive out of order, TCP reassembles them in sequence before handing data to the application.

Think of TCP like certified mail: every letter gets a tracking number (sequence number), the post office waits for a "received" signature (acknowledgment), and if the letter goes missing it sends another copy. It takes more time and paperwork per letter than throwing it in the bin (UDP), but you know every letter arrives in order.

**UDP (User Datagram Protocol)** is the opposite: no handshake, no acknowledgment, no ordering. Like a radio broadcast — you transmit and hope the receiver heard it. Lower latency, less overhead, and the right choice when speed beats completeness (DNS queries, video calls, online games) or when you want to implement your own reliability on top (QUIC/HTTP/3).

**DNS (Domain Name System)** is the distributed phone book of the internet. Before the browser can open a TCP connection to `api.shopfast.com`, it needs to know the IP address behind that name. DNS is the lookup system that provides it.

### What it looks like

**TCP 3-way handshake** — the "hello, hello back, ok" ritual that costs 1 RTT (Round-Trip Time) before data flows:

```
Client                          Server
  │                               │
  │── SYN (seq=1000) ────────────▶│   "I want to connect; my starting sequence is 1000"
  │                               │
  │◀─ SYN-ACK (seq=2000, ack=1001)│   "OK; mine is 2000; I confirm your 1000"
  │                               │
  │── ACK (ack=2001) ────────────▶│   "Confirmed; connection open"
  │                               │
  │══ data flows both ways ═══════│
```

**DNS resolution chain** — cold lookup from `api.shopfast.com` to IP:

```
Browser stub resolver
  │
  ├──▶ OS cache / /etc/hosts      (hit? done instantly)
  │
  ├──▶ Recursive resolver (8.8.8.8 / ISP)
  │        │
  │        ├──▶ Root server (.)         → "ask .com TLD servers"
  │        ├──▶ TLD server (.com)       → "ask shopfast.com's authoritative NS"
  │        └──▶ Authoritative NS        → "A record = 203.0.113.42"  (TTL=60)
  │
  └──▶ IP address returned to browser
```
Each arrow is ~1 RTT. A cold lookup traverses all of them; a warm cache short-circuits at any level.

**Full cold HTTPS request cost** (what every "what happens when you type a URL?" answer must cover):

```
DNS resolve              ~1 RTT  (or 0 if cached)
TCP 3-way handshake       1 RTT
TLS 1.3 handshake         1 RTT
HTTP request/response     1 RTT
─────────────────────────────────
~3–4 RTTs before first byte
```
On a 100 ms RTT (Round-Trip Time) mobile connection that is 300–400 ms of pure setup before a pixel renders.

### The code that builds it

TCP/UDP are OS-level; application code reaches them via sockets. Node.js example to illustrate what the framework hides:

```typescript
import net from "net";   // TCP; use "dgram" for UDP

// TCP server — this is what Express/Fastify does internally
const server = net.createServer((socket) => {
  // "socket" is the established TCP connection after the 3-way handshake
  socket.on("data", (chunk) => {
    // TCP is a byte stream — "chunk" may be part of a message, not a full one
    // You must buffer + frame messages yourself (length prefix or delimiter)
    console.log("received:", chunk.toString());
    socket.write("HTTP/1.1 200 OK\r\n\r\nHello");   // write bytes back
  });
  socket.on("end", () => socket.destroy());          // graceful close
});

server.listen(8080);
```

DNS lookup in Node.js (what happens before every outbound connection):

```typescript
import dns from "dns/promises";

// What the OS/HTTP client does automatically — shown explicitly for teaching
const { address } = await dns.lookup("api.shopfast.com");
// address = "203.0.113.42"  (TTL cached by the OS resolver)
```

### The code that calls it

The fetch/HTTP client abstracts TCP + DNS, but knowing the layers explains the latency:

```typescript
// This single line hides: DNS lookup → TCP connect → TLS handshake → HTTP request
const res = await fetch("https://api.shopfast.com/v1/products/42");

// To reuse the TCP connection (avoid 1 RTT per request), pass a keep-alive agent
import { Agent } from "undici";
const agent = new Agent({ connections: 10 });   // pool of 10 keep-alive TCP connections

const res2 = await fetch("https://api.shopfast.com/v1/products/99", {
  dispatcher: agent,   // reuses an existing TCP+TLS connection → saves ~2 RTTs
});
```

### Types & differences

| | TCP | UDP |
|---|---|---|
| Connection | Yes — 3-way handshake | None |
| Reliable delivery | Yes — retransmit on loss | No |
| Ordered | Yes | No |
| Flow control | Yes — receiver window | No (app's job) |
| Congestion control | Yes — slow start, CUBIC, BBR | No (app's job) |
| HOL (Head-of-Line) blocking | Yes — lost segment stalls stream | No |
| Overhead | Higher | Lower |
| Use | HTTP/1.1 & /2, databases, anything needing integrity | DNS, VoIP, gaming, **QUIC**/HTTP/3 |

**Reach for UDP when:** timeliness beats completeness (a late video frame is useless), or when you want to build your own transport with better semantics than TCP (QUIC builds reliability + multiplexed streams on top of UDP, eliminating TCP's HOL blocking — which is why HTTP/3 uses it).

### Build it for real — ShopFast

ShopFast's web client opens HTTPS connections to `api.shopfast.com`. Three concrete decisions follow from this topic:

**Decision 1 — DNS TTL (Time To Live):** Set `TTL=60` on `api.shopfast.com` A records at launch. This gives us fast failover if an IP changes (e.g. blue-green deploy or incident), at the cost of slightly more resolver queries. **Rejected:** `TTL=86400` (one day) — a misconfigured deploy or IP change would mean 24 hours of stale DNS caching across the internet, turning a 2-minute rollback into an overnight incident.

**Decision 2 — TCP keep-alive on the L7 load balancer:** Enable HTTP persistent connections (keep-alive) so the browser's multiple catalog requests (`/products/1`, `/products/2`, etc.) reuse one TCP+TLS connection instead of paying 2–3 RTTs per request. Free performance at launch. **Rejected:** disabling keep-alive — the 3-RTT cold connection cost on mobile would dominate p99 (99th-percentile latency) for catalog browsing.

**Decision 3 — No UDP directly:** ShopFast's REST API rides HTTP/2 over TCP at launch. We don't implement UDP services ourselves. UDP is relevant as the transport under QUIC/HTTP/3 (a future CDN upgrade path noted in the [HTTP topic](../../01-http/01-knowledge/README.md)).

> **If you get this wrong:** Leaving DNS TTL at the registrar default (often 3600s or 86400s) before a planned migration means clients will still resolve to the old IP for hours after the cutover. The pattern is: lower TTL to 60s *at least 2× the old TTL* before the change, execute the migration, then raise it again.

### Scaling story

- **Now (cheap):** `TTL=60` on DNS A record, keep-alive TCP connections to the L7 load balancer, connection pool in the app tier for Postgres (via PgBouncer (PostgreSQL connection pooler)). The app is stateless — sessions in Redis — so any server handles any TCP connection.
- **Growth signal:** connection setup latency shows up in p99; `TIME_WAIT` socket accumulation on a heavily loaded proxy; DNS lookup time appears in distributed traces.
- **At scale:** add CDN edge nodes close to users (terminates TCP+TLS locally, cuts RTTs dramatically); switch edge to HTTP/3/QUIC to eliminate TCP HOL blocking on mobile; use `dns.resolve` with pinning in server-to-server calls to avoid per-request DNS overhead. Cross-links: [HTTP](../../01-http/01-knowledge/README.md) for the application layer; [TLS](../../03-tls/01-knowledge/README.md) for the encryption wrapping the TCP stream.

---

## 1. Where this sits: the layering

```
Application   | HTTP, gRPC, DNS (as a protocol)
Transport     | TCP, UDP, QUIC
Network       | IP (routing, addressing), ICMP
Link          | Ethernet, Wi-Fi
```

IP (Internet Protocol) gives you **best-effort, connectionless, unordered, possibly-duplicated** packet delivery. TCP and UDP are what you build reliability (or deliberately not) on top of.

---

## 2. TCP — reliable, ordered, connection-oriented

### Guarantees
- **Reliable delivery** via sequence numbers + acknowledgments + retransmission.
- **In-order delivery** — receiver reassembles by sequence number (source of HOL blocking).
- **Flow control** — receiver advertises a *window* so a fast sender can't overwhelm a slow receiver.
- **Congestion control** — sender backs off when the *network* is congested (slow start, congestion avoidance, fast retransmit/recovery; algorithms like Reno, CUBIC, BBR).

### The 3-way handshake (connection setup, 1 RTT)
```
Client → SYN (seq=x)
Server → SYN-ACK (seq=y, ack=x+1)
Client → ACK (ack=y+1)
```
After this, data flows. This 1 RTT of setup is why connection reuse (keep-alive) matters.

### Connection teardown (4-way / FIN)
```
A → FIN ; B → ACK ; B → FIN ; A → ACK
```
The initiator then sits in **`TIME_WAIT`** (~2×MSL (Maximum Segment Lifetime), often 60s) to absorb stray packets and prevent old segments contaminating a new connection on the same 4-tuple. Mass `TIME_WAIT` accumulation on busy proxies can exhaust ephemeral ports.

### Key terms
- **MSS (Maximum Segment Size) / MTU (Maximum Transmission Unit)**: Exceeding path MTU forces fragmentation; PMTUD (Path MTU Discovery) discovers it.
- **Nagle's algorithm**: coalesces small writes to reduce tiny packets; `TCP_NODELAY` disables it for latency-sensitive workloads (it can interact badly with delayed ACKs).
- **Slow start**: congestion window grows exponentially from a small initial value — why the *first* bytes of a new connection are slow.
- **Head-of-line blocking**: a lost segment stalls everything behind it because TCP must deliver in order.

---

## 3. UDP — unreliable, unordered, connectionless

- No handshake, no ACKs (Acknowledgments), no ordering, no congestion control built in — just a thin wrapper over IP (ports + checksum).
- **Lower latency, lower overhead**, no connection state.
- You get a datagram or you don't; out of order is possible; no retransmission.
- Used where **timeliness beats completeness** or where the app builds its own reliability: DNS queries, VoIP (Voice over IP)/video (a late packet is useless), gaming, and **QUIC** (which rebuilds reliability + congestion control + streams in userspace on top of UDP, enabling HTTP/3).

| | TCP | UDP |
|---|---|---|
| Connection | Yes (handshake) | No |
| Reliable | Yes | No |
| Ordered | Yes | No |
| Flow/congestion control | Yes | No (app's job) |
| Overhead | Higher | Lower |
| HOL blocking | Yes | No |
| Use | HTTP, DBs, anything needing integrity | DNS, VoIP, gaming, QUIC |

---

## 4. DNS — the distributed name system

DNS resolves a hostname to an IP (and other records) via a hierarchical, cached, mostly-UDP protocol.

### Resolution walk (recursive resolver does the work)
```
stub resolver (OS) → recursive resolver (ISP / 8.8.8.8)
   → root server (.)            → "ask the .com TLD servers"
   → TLD server (.com)          → "ask example.com's authoritative NS"
   → authoritative server       → "A record = 93.184.216.34"
```
The recursive resolver caches each answer for its **TTL (Time To Live)**. Most lookups never reach the root — they hit a cache at the browser, OS, or resolver level.

### Record types worth knowing
- **A** / **AAAA** — hostname → IPv4 / IPv6.
- **CNAME (Canonical Name)** — alias to another name (cannot coexist with other records at the same name; can't be at the zone apex — use ALIAS/ANAME or apex flattening).
- **MX (Mail Exchanger)** — mail servers (with priority).
- **TXT (Text)** — arbitrary text (SPF (Sender Policy Framework), DKIM (DomainKeys Identified Mail), domain verification).
- **NS (Name Server)** — delegates a zone to authoritative name servers.
- **SOA (Start of Authority)** — zone metadata (serial, refresh, TTL defaults).
- **PTR (Pointer)** — reverse DNS (IP → name).
- **SRV (Service)** — service location (host+port), used by some service discovery.

### TTL — the lever everyone forgets until a cutover
- High TTL (e.g. 86400) = fewer lookups, better cache hit, but **slow to change**.
- Low TTL (e.g. 60) = fast failover/migration, but more query load and resolver pressure.
- **Pattern:** lower the TTL *well before* a planned IP cutover, switch, then raise it again. Beware resolvers that ignore very short TTLs.

### Transport
- DNS uses **UDP port 53** by default (one packet, fast). Falls back to **TCP** when the response exceeds 512 bytes (or the EDNS (Extension mechanisms for DNS)-negotiated size), and for zone transfers (AXFR (Authoritative Zone Transfer)).
- **DoH (DNS over HTTPS) / DoT (DNS over TLS)** encrypt queries for privacy.

---

## 5. Latency model (why DNS + TCP + TLS adds up)

First request to a brand-new origin, cold caches, HTTPS over TCP:
```
DNS resolve            ~1 RTT (or 0 if cached)
TCP handshake          1 RTT
TLS 1.3 handshake      1 RTT
HTTP request/response  1 RTT
--------------------------------
~3-4 RTTs before first byte
```
On a 100 ms RTT mobile link that's ~300–400 ms of pure setup. Mitigations: DNS prefetch, connection keep-alive, TLS session resumption, HTTP/3 0-RTT, and CDNs (Content Delivery Networks) that terminate close to the user.

---

## 6. Common pitfalls & misconceptions

- "DNS is instant." It's cached at many layers; a cold lookup is multiple round trips, and a misconfigured TTL turns a 5-minute cutover into a 24-hour one.
- "UDP is just a worse TCP." No — UDP is the right choice when retransmission is pointless (real-time) or when you want to build your own transport (QUIC).
- Putting a **CNAME at the zone apex** (`example.com`) — invalid; use ALIAS/flattening.
- Ignoring **`TIME_WAIT`** until a load test shows ephemeral port exhaustion on a proxy.
- Assuming TCP guarantees *message* boundaries — it's a **byte stream**; you must frame messages yourself (length prefix / delimiter).
- Forgetting that **a single packet loss stalls an entire TCP connection** (HOL) — the reason HTTP/3 moved to QUIC.

---

## 7. What interviewers probe

- "Walk the 3-way handshake and explain each field's purpose."
- "When would you choose UDP over TCP?" (real-time, your own reliability, multicast.)
- "Trace a DNS lookup from cold cache to answer." (stub → recursive → root → TLD → authoritative.)
- "You're migrating to a new IP with zero downtime — what's your DNS plan?" (lower TTL ahead of time, dual-run, monitor.)
- "Why is the first HTTPS request to a new host slow?" (DNS + TCP + TLS round trips + slow start.)
- "What is `TIME_WAIT` and when does it bite you?"

---

## Quick-reference summary

- **TCP**: connection-oriented, reliable, ordered, flow + congestion control; 3-way handshake (1 RTT); `TIME_WAIT` on close; byte stream (you frame messages); HOL blocking.
- **UDP**: connectionless, unreliable, unordered, no congestion control; low latency; DNS, real-time, QUIC.
- **DNS**: hierarchical (root → TLD → authoritative), heavily cached, UDP/53 (TCP fallback >512B). Records: A/AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV.
- **TTL** trades cache efficiency vs change speed; lower it before cutovers.
- Cold HTTPS request ≈ DNS + TCP + TLS + slow start ≈ 3–4 RTTs — reuse connections to amortize.
