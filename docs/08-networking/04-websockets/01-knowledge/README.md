# WebSockets & Streaming — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: WebSockets, SSE, long polling, real-time tradeoffs.

Plain HTTP request/response can't push: the server only speaks when asked. Real-time features (chat, live dashboards, notifications, collaborative editing, market data) need server→client *push*. The four mainstream techniques are **short polling**, **long polling**, **Server-Sent Events (SSE)**, and **WebSockets**. A senior must pick the right one and reason about scaling thousands-to-millions of persistent connections.

---

## 1. The four techniques

### Short polling
Client requests on a timer (`GET /messages` every 5s). Dead simple, works everywhere, but high latency (up to the interval) and wasteful (most polls return nothing). Fine for low-frequency, non-urgent updates.

### Long polling
Client sends a request; the server **holds it open** until data is available (or a timeout), then responds. Client immediately reissues. Approximates push over plain HTTP, works through any proxy, but each message costs a full request/response cycle and ties up a connection/thread per waiting client. The classic fallback before WebSockets.

### Server-Sent Events (SSE)
A single long-lived HTTP response streaming `text/event-stream`; the server pushes events as they occur. **One-directional (server→client only)**, text-only, auto-reconnect with `Last-Event-ID` built in, runs over plain HTTP (great with HTTP/2 multiplexing). Ideal for feeds, notifications, dashboards, LLM token streaming.

```
GET /stream HTTP/1.1
Accept: text/event-stream

HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"price": 101.2}\n\n
id: 42\n
data: {"price": 101.5}\n\n
```

### WebSockets
Starts as an HTTP/1.1 request with `Upgrade: websocket`; after a `101 Switching Protocols`, the TCP connection is repurposed as a **full-duplex, bidirectional, persistent** channel carrying lightweight binary/text frames. The right tool for **two-way, low-latency** interaction: chat, multiplayer games, collaborative editing, trading.

```
GET /chat HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

---

## 2. Comparison

| | Short poll | Long poll | SSE | WebSocket |
|---|---|---|---|---|
| Direction | C→S (pull) | C→S (pull, delayed) | S→C only | Full duplex |
| Transport | HTTP | HTTP | HTTP | TCP after upgrade |
| Latency | Poll interval | ~Low | Low | Lowest |
| Overhead/msg | Full HTTP | Full HTTP | Tiny (one stream) | Tiny frame |
| Auto-reconnect | n/a | manual | built-in | manual (libs help) |
| Binary | yes | yes | no (text) | yes |
| Proxy/firewall friendliness | best | best | good | sometimes blocked |
| Server cost | low per conn | a conn per waiter | a conn per client | a conn per client |

---

## 3. How WebSocket framing & lifecycle work

- After the `101` upgrade, data is sent in **frames** with an opcode (text/binary/ping/pong/close), a length, and (client→server) a masking key.
- **Ping/pong** frames are the heartbeat: detect dead peers and keep intermediaries from idling out the connection.
- **Close** frames carry a status code for graceful shutdown.
- The connection is stateful — the server holds it for the session, unlike stateless HTTP.

---

## 4. Scaling persistent connections (the hard part)

The difficulty isn't the protocol; it's that you now hold **millions of open connections**, each consuming a file descriptor + socket buffers + app memory.

- **Connection limits:** tune OS `ulimit`/file descriptors, ephemeral ports, kernel socket memory. A single modern box can hold ~100k–1M idle connections with care.
- **Sticky routing:** a WebSocket is pinned to one server instance. Load balancers must support the upgrade and ideally route by sticky sessions or consistent hashing.
- **Horizontal fan-out:** to broadcast a message to users spread across many app servers, you need a **pub/sub backplane** (Redis pub/sub, Kafka, NATS) so the server holding user B's socket learns about a message published by user A on a different server.
- **Presence & state:** "who's online," last-seen, and routing tables typically live in Redis.
- **Backpressure:** slow clients can't drain fast producers — buffer with bounded queues, drop/coalesce, or disconnect; never let a slow consumer balloon server memory.
- **Reconnect storms:** when a server dies, thousands reconnect at once (thundering herd) — use jittered backoff and accept-rate limiting.

---

## 5. Choosing between them (decision heuristic)

- **Need bidirectional, low latency (chat, games, collab)?** → WebSocket.
- **Server-push only, text events, want simplicity + auto-reconnect (notifications, dashboards, LLM streaming)?** → SSE.
- **Occasional updates, must traverse hostile proxies, minimal infra?** → long polling.
- **Very infrequent, latency-tolerant?** → short polling.

Always have a **fallback** (SSE/long-poll) for environments that block WebSocket upgrades.

---

## 6. Common pitfalls & misconceptions

- "WebSocket is always best for real-time." Often SSE is simpler and sufficient when you only push *to* the client; WebSockets add bidirectional complexity and proxy issues.
- Forgetting **heartbeats** → silently dead connections that the app thinks are alive; idle proxies kill connections after ~60s.
- No **backpressure** plan → one slow client OOMs the server.
- Assuming WebSockets are stateless/load-balancer-transparent — they're sticky and need a pub/sub backplane to scale horizontally.
- SSE over HTTP/1.1 hits the 6-connection-per-origin cap; **use HTTP/2** so many SSE streams multiplex on one connection.
- Not securing the upgrade — use **`wss://`** (WebSocket over TLS) and authenticate the upgrade request (cookies/token); validate `Origin` to prevent cross-site WebSocket hijacking.

---

## 7. What interviewers probe

- "SSE vs WebSocket — when each?"
- "How does the WebSocket handshake work?" (`Upgrade` + `101`.)
- "How do you broadcast to a million users spread across 50 servers?" (pub/sub backplane + sticky routing.)
- "How do you detect and handle dead connections?" (ping/pong + idle timeouts.)
- "What happens when a client reads slower than the server writes?" (backpressure.)
- "What's your reconnect strategy and how do you avoid a thundering herd?" (jittered exponential backoff.)

---

## Quick-reference summary

- Four push techniques: short poll (simple, laggy), long poll (push over HTTP, costly), **SSE** (server→client, text, auto-reconnect, HTTP/2), **WebSocket** (full-duplex, lowest latency, sticky).
- WebSocket = HTTP `Upgrade` → `101` → framed bidirectional channel; needs ping/pong heartbeats and `wss://`.
- Hard part is scale: millions of stateful connections → tune FDs, sticky routing, **pub/sub backplane** for fan-out, backpressure, jittered reconnect.
- Default to **SSE** when push is one-way; reach for **WebSocket** when you truly need bidirectional. Always keep a fallback.
