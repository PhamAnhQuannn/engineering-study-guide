# WebSockets & Streaming — Practice Questions

[← Topic overview](../README.md)

> Topic: WebSockets, SSE, long polling, real-time tradeoffs.

---

### Q1. Explain the difference between long polling and WebSockets to a junior.

**Answer:** **Long polling** is a trick on top of normal HTTP: the client makes a request, the server *holds it open* until it has something to say (or times out), responds, and the client immediately asks again. Each message is a full HTTP request/response, and it's still fundamentally the client pulling. **WebSockets** upgrade a single HTTP connection into a persistent, full-duplex channel — after the handshake, either side can send small frames at any time with almost no per-message overhead. Long polling simulates push; WebSockets *are* push, in both directions.

---

### Q2. How does the WebSocket handshake work?

**Answer:** It begins as a normal HTTP/1.1 GET with upgrade headers: `Upgrade: websocket`, `Connection: Upgrade`, a random `Sec-WebSocket-Key`, and `Sec-WebSocket-Version: 13`. If the server agrees, it replies `101 Switching Protocols` with `Sec-WebSocket-Accept` (a hash of the client's key + a fixed GUID, proving it understood the protocol). From that point the same TCP connection stops speaking HTTP and carries WebSocket **frames** (text/binary/ping/pong/close), full-duplex. Use `wss://` to run it over TLS.

---

### Q3. When would you choose SSE over WebSockets?

**Answer:** When the data flow is **server → client only** and you want simplicity. SSE is plain HTTP streaming `text/event-stream`, so it works with existing HTTP infrastructure, multiplexes beautifully over HTTP/2, and has **automatic reconnection with `Last-Event-ID`** built into the browser `EventSource` API. Good fits: notifications, live dashboards, activity feeds, stock tickers, and streaming LLM tokens. You'd switch to WebSockets only when the client also needs to send frequent low-latency messages back (chat, games, collaborative editing).

---

### Q4. You need to broadcast a chat message to a million users connected across 50 app servers. How?

**Answer:** Each WebSocket is pinned to one server, so the server that receives the inbound message usually does **not** hold the sockets of all recipients. You need a **pub/sub backplane**: the receiving server publishes the message to a channel (Redis pub/sub, Kafka, or NATS); every app server subscribes and pushes to the local sockets it owns. A presence/routing store (often Redis) maps users → which server/room they're on. This decouples "where the message arrives" from "where the recipients are connected," letting you scale horizontally.

---

### Q5. How do you detect that a WebSocket connection has silently died?

**Answer:** TCP can keep a connection "open" long after the peer is unreachable (e.g. a laptop sleeps, a NAT drops state). Use **application-level heartbeats**: the server periodically sends a `ping` frame and expects a `pong` within a timeout; if it doesn't arrive, close and clean up the connection. Heartbeats also keep idle-timeout proxies/load balancers from killing a quiet-but-alive connection. Pair this with a client reconnect strategy using **jittered exponential backoff** so a mass disconnect doesn't cause a reconnect storm.

---

### Q6. What is backpressure in a streaming/WebSocket context and how do you handle it?

**Answer:** Backpressure is what you need when a producer generates data faster than a consumer can accept it — e.g. a fast market-data feed and a client on slow Wi-Fi. If unmanaged, unsent data buffers in server memory until the process OOMs. Handle it by: using **bounded** send buffers per connection; when a client's buffer is full, **coalesce** (send only the latest state), **drop** lower-priority updates, or **disconnect** the slow client; and by monitoring per-connection queue depth. The principle: protect the server's memory; never let one slow consumer take it down.

---

### Q7. (MCQ) Which technique is one-directional (server → client only)?

- A) WebSocket
- B) Long polling
- C) Server-Sent Events (SSE)
- D) Short polling

**Answer: C.** SSE streams events from server to client over a single HTTP response; the client cannot send data back over the same stream (it uses separate HTTP requests for that). WebSockets are full-duplex; polling techniques are client-initiated pulls.

---

### Q8. (MCQ) The WebSocket handshake completes with which HTTP status code?

- A) 200 OK
- B) 101 Switching Protocols
- C) 204 No Content
- D) 426 Upgrade Required

**Answer: B.** The server signals a successful protocol upgrade with `101 Switching Protocols`. (`426 Upgrade Required` is what a server returns to *demand* an upgrade, not to confirm one.)

---

### Q9. (MCQ) Why should SSE be served over HTTP/2 rather than HTTP/1.1?

- A) HTTP/1.1 doesn't support streaming
- B) Under HTTP/1.1 each SSE stream consumes one of the ~6 connections-per-origin, quickly exhausting them
- C) SSE requires binary frames
- D) HTTP/2 makes SSE bidirectional

**Answer: B.** Browsers cap concurrent connections per origin at ~6 under HTTP/1.1; each SSE stream holds one open, so a handful of streams (across tabs) starve other requests. HTTP/2 multiplexes many streams over a single connection, removing the limit. (SSE remains one-directional and text-based regardless.)

---

### Q10. (MCQ) What is the main scaling challenge unique to WebSockets vs stateless HTTP?

- A) JSON parsing cost
- B) Holding millions of stateful, long-lived connections and routing/broadcasting across servers
- C) TLS handshakes
- D) DNS resolution

**Answer: B.** Stateless HTTP servers handle a request and forget it; WebSocket servers must **keep** each connection open (file descriptors, socket buffers, memory) for the session, route messages to the right server (sticky), and broadcast across instances via a pub/sub backplane. That persistent, stateful, fan-out nature is the core scaling problem.

---

### Q11. How do you secure a WebSocket connection against cross-site hijacking?

**Answer:** WebSockets are not covered by the same-origin policy or CORS the way XHR is, so a malicious page could try to open a `ws://` to your server using the victim's ambient cookies (cross-site WebSocket hijacking). Defenses: (1) **validate the `Origin` header** on the upgrade request server-side and reject unexpected origins; (2) authenticate the connection with a **token** (not just cookies) passed during the handshake; (3) always use **`wss://`** (TLS) so the channel is encrypted and tamper-proof. Treat the upgrade request with the same auth scrutiny as any other authenticated endpoint.
