# WebSockets & Streaming — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: WebSockets, SSE, long polling, real-time tradeoffs.

> **🛒 Where we are in building ShopFast** — Last topic we covered [Web Mechanics](../../04-web-mechanics/01-knowledge/README.md) — CORS, cookies, sessions, and caching headers. But HTTP is still purely request/response: the client asks, the server answers, connection goes quiet. ShopFast needs to **push** live order status and inventory counts to the browser — the server must speak without being asked. This topic covers WebSockets and the alternatives that make that possible. **Next:** [SQL vs NoSQL](../../../05-databases/01-sql-vs-nosql/01-knowledge/README.md) — choosing the right database type for ShopFast's data layer.

---

## Teaching arc: pushing live order and inventory status in ShopFast

### What it is

HTTP is inherently **pull**: the client initiates every exchange. The server can only respond to a request it has received — it cannot tap the client on the shoulder and say "hey, your order just shipped." For real-time features you need **push**: the server must send data whenever something interesting happens, not just when asked.

Think of the difference between checking your mailbox (pull — you walk to the box, open it, find nothing) versus getting a doorbell notification (push — the system alerts you when something arrives). HTTP polling is checking the mailbox every 5 seconds. WebSockets are the doorbell.

Four techniques exist, ranging from "fake push with polling" to "true full-duplex channel":

1. **Short polling** — client asks every N seconds. Simple but wastes bandwidth; most polls return nothing.
2. **Long polling** — client asks; server *holds the connection open* until data is ready, then responds. Client immediately re-asks. Simulates push over plain HTTP.
3. **SSE (Server-Sent Events)** — server keeps one HTTP response open and streams events down it forever. One-way (server → client only), built-in auto-reconnect.
4. **WebSockets** — upgrades HTTP to a persistent, full-duplex, bidirectional channel. Both sides send and receive freely.

### What it looks like

**WebSocket upgrade handshake** — starts as HTTP, then switches protocols:

```http
GET /ws/orders HTTP/1.1               ← starts as a normal HTTP request
Host: api.shopfast.com
Upgrade: websocket                    ← client requests protocol switch
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==   ← random base64 nonce
Sec-WebSocket-Version: 13

HTTP/1.1 101 Switching Protocols      ← server agrees; TCP connection repurposed
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=  ← SHA-1 of key + magic string
```
After the `101`, the TCP connection is no longer HTTP. Both sides exchange lightweight **frames** (not full HTTP headers per message). The browser shows the order status in real time:

```
Server → Client (WebSocket frame, JSON text):
{"event":"order_status","orderId":"ORD-123","status":"shipped","ts":1718000000}

Server → Client:
{"event":"inventory","productId":"42","inStock":false}

Client → Server (WebSocket frame):
{"action":"subscribe","channel":"order:ORD-123"}
```

**SSE (Server-Sent Events)** — simpler, one-way push for catalog inventory counts:

```http
GET /events/inventory HTTP/1.1
Accept: text/event-stream

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

data: {"productId":"42","inStock":true,"count":200}\n\n   ← server pushes whenever stock changes

id: 1001\n
data: {"productId":"42","inStock":false,"count":0}\n\n    ← client can resume from id:1001 on reconnect
```

### The code that builds it

Server-side WebSocket handler (Node.js with the `ws` library):

```typescript
import { WebSocketServer } from "ws";
import { createServer } from "https";

const httpsServer = createServer({ /* TLS options */ }, app);  // wss:// requires TLS
const wss = new WebSocketServer({ server: httpsServer });

wss.on("connection", (socket, req) => {
  // Authenticate the upgrade request — check cookie/token BEFORE accepting
  const userId = verifyToken(req.headers["authorization"]);
  if (!userId) return socket.close(4001, "Unauthorized");

  // Subscribe this socket to the user's order channel in Redis pub/sub
  const sub = redis.subscribe(`orders:${userId}`, (message) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);   // push order status update to this specific client
    }
  });

  // Heartbeat — detect dead connections (proxies kill idle sockets after ~60s)
  const ping = setInterval(() => socket.ping(), 30_000);

  socket.on("pong", () => { /* client is alive */ });

  socket.on("close", () => {
    clearInterval(ping);
    sub.unsubscribe();   // clean up Redis subscription to avoid memory leak
  });
});
```

SSE endpoint for inventory — server → client only, simpler:

```typescript
app.get("/events/inventory", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.flushHeaders();   // send headers immediately to open the stream

  const sub = redis.subscribe("inventory:updates", (msg) => {
    res.write(`data: ${msg}\n\n`);  // SSE format: "data: <payload>\n\n"
  });

  req.on("close", () => sub.unsubscribe());   // client disconnected; clean up
});
```

### The code that calls it

Browser client subscribing to live order updates:

```typescript
// wss:// = WebSocket over TLS (analogous to https://)
const ws = new WebSocket("wss://api.shopfast.com/ws/orders", {
  headers: { Authorization: `Bearer ${token}` },  // authenticate on upgrade
});

ws.addEventListener("message", (event) => {
  const update = JSON.parse(event.data);
  if (update.event === "order_status") {
    renderOrderStatus(update.orderId, update.status);
  }
});

// Reconnect with jittered exponential backoff — avoid thundering herd after a server restart
ws.addEventListener("close", () => {
  const delay = Math.random() * 1000 + Math.pow(2, attempt) * 500;  // jitter prevents storm
  setTimeout(connect, Math.min(delay, 30_000));
});

// SSE for inventory (one-way, auto-reconnect built into the browser)
const evtSource = new EventSource("/events/inventory");
evtSource.addEventListener("message", (e) => {
  const inv = JSON.parse(e.data);
  updateStockBadge(inv.productId, inv.inStock);
});
// EventSource reconnects automatically using Last-Event-ID — no manual retry needed
```

### Types & differences

| | Short poll | Long poll | SSE (Server-Sent Events) | WebSocket |
|---|---|---|---|---|
| Direction | Client → Server (pull) | Client → Server (pull, delayed) | Server → Client only | **Full duplex** |
| Transport | HTTP | HTTP | HTTP (multiplexes on HTTP/2) | TCP (after upgrade) |
| Latency | Poll interval | ~Low | Low | Lowest |
| Overhead/message | Full HTTP headers | Full HTTP headers | Tiny (open stream) | Tiny frame (~2–14 bytes) |
| Auto-reconnect | No | Manual | **Built in** (`Last-Event-ID`) | Manual (libs help) |
| Binary support | Yes | Yes | No (text only) | Yes |
| Proxy/firewall | Best | Best | Good | Sometimes blocked |
| Server connection cost | Low (stateless) | 1 conn per waiter | 1 conn per client | 1 conn per client |

**Reach for WebSocket when:** bidirectional, low-latency interaction (chat, collaborative editing, multiplayer, trading dashboards).
**Reach for SSE when:** server-push only, text events, want simplicity + auto-reconnect (notifications, live counts, LLM (Large Language Model) token streaming).

### Build it for real — ShopFast

ShopFast needs two real-time features: (1) live **order status** (the user placed an order; we push status changes as the warehouse processes it), (2) live **inventory counts** on the product page (shows "Only 3 left!" without the user refreshing).

**Decision for order status: WebSocket (`wss://`)** — the client may also need to send actions (subscribe to a specific order, cancel tracking), making full-duplex the right fit. Use Redis pub/sub as the **fan-out backplane**: when the order service publishes a status change to `orders:{userId}`, all WebSocket servers subscribe and push to the connected client. This means the WebSocket server that holds the client's socket doesn't need to know about the order service directly.

**Decision for inventory counts: SSE** — purely server → client, text events, auto-reconnect handles transient disconnects. Simpler to operate than WebSockets; the browser `EventSource` API handles reconnection with `Last-Event-ID` so no inventory update is missed after a brief network hiccup.

**Rejected:** Long polling for both — simulates push but burns a connection per waiting client and a full HTTP cycle per event. At 1M users with 10% active, that is 100k simultaneous long-poll requests; WebSockets + SSE hold the same 100k connections with far less overhead. Short polling for order status — 5-second latency is too slow; a customer watching "Order Processing" wants near-instant updates when their order ships.

> **If you get this wrong:** Omitting WebSocket heartbeats (ping/pong frames) means idle connections are silently killed by NAT gateways and reverse proxies after ~60 seconds of inactivity. The client shows "connected" but the server's socket is dead. Messages are dropped silently. The fix is a server-side `ping` every 25–30 seconds and a client-side `pong` response; if no pong arrives, close and reconnect.

### Scaling story

- **Now (cheap):** One Node.js process handles WebSocket connections via `ws`. Redis pub/sub used as the fan-out backplane from day one — this is the placeholder that makes horizontal scaling possible later with zero client changes. SSE for inventory updates. Tune `ulimit` (open file descriptors) on the server to ≥ 100k.
- **Growth signal:** WebSocket server CPU or memory saturation; Redis pub/sub message rate climbing; "connected users" metric per pod growing past ~50k active sockets comfortably.
- **At scale:** Multiple WebSocket pods behind a sticky load balancer (consistent hashing by `userId`). Redis pub/sub backplane scales with cluster mode. For truly massive fan-out (live inventory to millions of product page viewers) consider a dedicated push service (Kafka consumer → SSE push tier) to decouple the inventory update rate from the HTTP server thread pool. Cross-links: [TCP/UDP & DNS](../../02-tcp-udp-dns/01-knowledge/README.md) for the connection underpinning; [TLS](../../03-tls/01-knowledge/README.md) for `wss://`; [Web Mechanics](../../05-web-mechanics/01-knowledge/README.md) for CORS on the upgrade request.

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

- **Connection limits:** tune OS `ulimit` (user limits)/file descriptors, ephemeral ports, kernel socket memory. A single modern box can hold ~100k–1M idle connections with care.
- **Sticky routing:** a WebSocket is pinned to one server instance. Load balancers must support the upgrade and ideally route by sticky sessions or consistent hashing.
- **Horizontal fan-out:** to broadcast a message to users spread across many app servers, you need a **pub/sub (publish/subscribe) backplane** (Redis pub/sub, Kafka, NATS) so the server holding user B's socket learns about a message published by user A on a different server.
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
- No **backpressure** plan → one slow client OOMs (Out-Of-Memory) the server.
- Assuming WebSockets are stateless/load-balancer-transparent — they're sticky and need a pub/sub backplane to scale horizontally.
- SSE over HTTP/1.1 hits the 6-connection-per-origin cap; **use HTTP/2** so many SSE streams multiplex on one connection.
- Not securing the upgrade — use **`wss://`** (WebSocket Secure — WebSocket over TLS) and authenticate the upgrade request (cookies/token); validate `Origin` to prevent cross-site WebSocket hijacking.

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
- Hard part is scale: millions of stateful connections → tune FDs (file descriptors), sticky routing, **pub/sub backplane** for fan-out, backpressure, jittered reconnect.
- Default to **SSE** when push is one-way; reach for **WebSocket** when you truly need bidirectional. Always keep a fallback.
