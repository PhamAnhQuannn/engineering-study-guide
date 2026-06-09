# TCP/UDP & DNS — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Transport protocols, handshakes, DNS resolution.

The transport layer (TCP, UDP) sits between IP (best-effort packet delivery) and your application. DNS is the naming system that turns `api.example.com` into an IP before any transport connection can begin. A senior engineer reasons about handshakes, congestion/flow control, port exhaustion, and DNS caching/TTL because they explain real latency and outage behavior.

---

## 1. Where this sits: the layering

```
Application   | HTTP, gRPC, DNS (as a protocol)
Transport     | TCP, UDP, QUIC
Network       | IP (routing, addressing), ICMP
Link          | Ethernet, Wi-Fi
```

IP gives you **best-effort, connectionless, unordered, possibly-duplicated** packet delivery. TCP and UDP are what you build reliability (or deliberately not) on top of.

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
The initiator then sits in **`TIME_WAIT`** (~2×MSL, often 60s) to absorb stray packets and prevent old segments contaminating a new connection on the same 4-tuple. Mass `TIME_WAIT` accumulation on busy proxies can exhaust ephemeral ports.

### Key terms
- **MSS / MTU**: Max Segment Size / Max Transmission Unit. Exceeding path MTU forces fragmentation; PMTUD discovers it.
- **Nagle's algorithm**: coalesces small writes to reduce tiny packets; `TCP_NODELAY` disables it for latency-sensitive workloads (it can interact badly with delayed ACKs).
- **Slow start**: congestion window grows exponentially from a small initial value — why the *first* bytes of a new connection are slow.
- **Head-of-line blocking**: a lost segment stalls everything behind it because TCP must deliver in order.

---

## 3. UDP — unreliable, unordered, connectionless

- No handshake, no ACKs, no ordering, no congestion control built in — just a thin wrapper over IP (ports + checksum).
- **Lower latency, lower overhead**, no connection state.
- You get a datagram or you don't; out of order is possible; no retransmission.
- Used where **timeliness beats completeness** or where the app builds its own reliability: DNS queries, VoIP/video (a late packet is useless), gaming, and **QUIC** (which rebuilds reliability + congestion control + streams in userspace on top of UDP, enabling HTTP/3).

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
The recursive resolver caches each answer for its **TTL**. Most lookups never reach the root — they hit a cache at the browser, OS, or resolver level.

### Record types worth knowing
- **A** / **AAAA** — hostname → IPv4 / IPv6.
- **CNAME** — alias to another name (cannot coexist with other records at the same name; can't be at the zone apex — use ALIAS/ANAME or apex flattening).
- **MX** — mail servers (with priority).
- **TXT** — arbitrary text (SPF, DKIM, domain verification).
- **NS** — delegates a zone to authoritative name servers.
- **SOA** — zone metadata (serial, refresh, TTL defaults).
- **PTR** — reverse DNS (IP → name).
- **SRV** — service location (host+port), used by some service discovery.

### TTL — the lever everyone forgets until a cutover
- High TTL (e.g. 86400) = fewer lookups, better cache hit, but **slow to change**.
- Low TTL (e.g. 60) = fast failover/migration, but more query load and resolver pressure.
- **Pattern:** lower the TTL *well before* a planned IP cutover, switch, then raise it again. Beware resolvers that ignore very short TTLs.

### Transport
- DNS uses **UDP port 53** by default (one packet, fast). Falls back to **TCP** when the response exceeds 512 bytes (or the EDNS-negotiated size), and for zone transfers (AXFR).
- **DoH/DoT** (DNS over HTTPS/TLS) encrypt queries for privacy.

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
On a 100 ms RTT mobile link that's ~300–400 ms of pure setup. Mitigations: DNS prefetch, connection keep-alive, TLS session resumption, HTTP/3 0-RTT, and CDNs that terminate close to the user.

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
