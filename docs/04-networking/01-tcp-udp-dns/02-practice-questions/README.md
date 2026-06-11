# TCP/UDP & DNS — Practice Questions

[← Topic overview](../README.md)

> Topic: Transport protocols, handshakes, DNS resolution.

---

### Q1. Walk through the TCP 3-way handshake and explain why each step exists.

**Answer:** SYN (client → server) carries the client's initial sequence number `x`. SYN-ACK (server → client) acknowledges `x+1` and carries the server's own sequence number `y`. ACK (client → server) acknowledges `y+1`. Three messages are the minimum to let **both sides** agree on starting sequence numbers and confirm bidirectional reachability. After the final ACK, both ends have synchronized sequence numbers and can reliably order and retransmit data. This costs **1 RTT** of setup before any application bytes flow, which is why connection reuse and keep-alive matter for latency.

---

### Q2. Explain to a junior the difference between flow control and congestion control.

**Answer:** Both make TCP slow down, but for different reasons. **Flow control** protects the *receiver*: the receiver advertises a window saying "I can only buffer this much right now," so a fast sender doesn't overrun a slow consumer. **Congestion control** protects the *network*: the sender infers congestion from packet loss/delay and shrinks its sending rate to avoid melting down shared links (slow start, congestion avoidance). Flow control is about the endpoint; congestion control is about the path in between.

---

### Q3. When would you deliberately choose UDP over TCP?

**Answer:** When **timeliness beats reliability**, or you want to implement your own transport semantics. Examples: real-time voice/video (a retransmitted packet arrives too late to be useful — better to drop it), online gaming (latest position matters, not old ones), DNS queries (a single small request/response — cheaper without a handshake), multicast/broadcast (TCP can't do it), and QUIC (which rebuilds reliability, ordering, and congestion control in userspace to get HTTP/3's per-stream loss isolation). The cost is that *you* must handle loss, ordering, and congestion if your app needs them.

---

### Q4. Trace a DNS resolution from a cold cache.

**Answer:** The app asks the OS stub resolver → which asks the configured **recursive resolver** (ISP or e.g. 8.8.8.8). The recursive resolver, if uncached, asks a **root** server, which replies "ask the `.com` TLD servers." It asks the **TLD** server, which replies "ask `example.com`'s authoritative name servers (NS records)." It asks the **authoritative** server, which returns the **A/AAAA** record. The recursive resolver caches the answer for its **TTL** and returns it to the client. Subsequent lookups within the TTL are served straight from cache, skipping most of this.

---

### Q5. You need to migrate a service to a new IP address with zero downtime. What's your DNS strategy?

**Answer:** Plan around TTL. (1) **Days before**, lower the record's TTL (e.g. from 86400 to 60s) so resolvers stop caching the old IP for long. (2) Wait for the old high TTL to fully expire everywhere. (3) **Cutover**: update the A record to the new IP; with low TTL, resolvers pick it up within ~a minute. (4) **Dual-run** both old and new endpoints during the transition so requests still hitting the old IP succeed. (5) Monitor traffic on the old IP until it drains to zero, then decommission and (optionally) raise the TTL back up. Caveat: some resolvers ignore short TTLs, so never hard-cut the old endpoint immediately.

---

### Q6. What is `TIME_WAIT` and when is it a problem?

**Answer:** After the active closer of a TCP connection sends the final ACK, it holds the socket in `TIME_WAIT` for ~2×MSL (often 60s). This absorbs delayed/duplicate segments and prevents an old connection's packets from being mistaken for a new connection reusing the same 4-tuple (src IP/port, dst IP/port). It becomes a problem on **high-volume clients/proxies** that open and close many short connections to the same destination: ephemeral ports pile up in `TIME_WAIT` and can be exhausted, causing connection failures. Mitigations: connection pooling/keep-alive, increasing the ephemeral port range, or `tcp_tw_reuse` where appropriate.

---

### Q7. (MCQ) Which is TRUE about TCP?

- A) It preserves message boundaries
- B) It is a byte stream; you must frame messages yourself
- C) It guarantees low latency
- D) It supports multicast

**Answer: B.** TCP delivers an ordered byte stream with no inherent message boundaries — two `send()` calls may arrive as one `recv()` or be split. You frame messages with a length prefix or delimiter. (A is false for that reason, C is false — reliability can cost latency via retransmits/HOL, D is false — multicast is UDP-only.)

---

### Q8. (MCQ) DNS normally uses which transport, and when does it switch?

- A) TCP always
- B) UDP/53, falling back to TCP for responses over 512 bytes or zone transfers
- C) UDP only, never TCP
- D) QUIC only

**Answer: B.** DNS defaults to UDP port 53 for speed (single small packet). It falls back to TCP when the response exceeds 512 bytes (or the EDNS-negotiated limit) and for zone transfers (AXFR). DoH/DoT add encrypted variants.

---

### Q9. (MCQ) Why can't you put a CNAME record at the zone apex (`example.com`)?

- A) CNAMEs are deprecated
- B) A CNAME can't coexist with the SOA/NS records that must exist at the apex
- C) CNAMEs only work for subdomains by ICANN rule
- D) It would be too slow

**Answer: B.** A CNAME must be the *only* record for a name, but the zone apex is required to carry SOA and NS records — so a CNAME there is invalid. Providers offer ALIAS/ANAME or "CNAME flattening" to give apex-level aliasing.

---

### Q10. (MCQ) The first HTTPS request to a new origin is slow primarily because of:

- A) Server CPU
- B) Multiple sequential round trips (DNS + TCP handshake + TLS handshake) plus TCP slow start
- C) The size of the HTML
- D) Browser rendering

**Answer: B.** Cold connection setup stacks DNS resolution, the TCP 3-way handshake, and the TLS handshake — each a round trip — and then TCP slow start throttles the initial throughput. Reuse (keep-alive), TLS resumption, and HTTP/3 0-RTT amortize this.

---

### Q11. Why does TCP "head-of-line blocking" exist, and how does QUIC avoid it?

**Answer:** TCP must deliver bytes **in order**, so if one segment is lost, every later segment that already arrived is held in the kernel buffer until the lost one is retransmitted — even if those later bytes belong to an unrelated HTTP/2 stream sharing the connection. QUIC runs over UDP and implements **independent streams** with per-stream sequencing, so a loss in stream A doesn't block delivery of stream B. That per-stream isolation is the core reason HTTP/3 outperforms HTTP/2 on lossy networks.
