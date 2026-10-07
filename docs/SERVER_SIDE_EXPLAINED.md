# How the Server Side Works (Simple Explanation)

This page explains **only the servers** — not the browser UI or WebRTC media math.  
Written in plain language for anyone who wants to understand what runs behind the scenes.

---

## Big picture

There are **two different calling modes**. Each uses servers differently:

| Mode | What the server does with **voice/video** | What the server does with **control messages** |
|------|-------------------------------------------|------------------------------------------------|
| **Mesh** | Almost nothing — audio goes **peer to peer** | Our **mesh signaling server** helps browsers find each other |
| **SFU** | **LiveKit** receives each person’s stream and forwards copies | LiveKit’s own signaling + our small **token server** (Phase 3) |

**Important:** In mesh mode, the server is a **matchmaker / post office for setup messages**. It does **not** mix or forward your microphone audio.

---

## Part A — Mesh signaling server (`mesh/server`)

### What problem does it solve?

WebRTC needs a short “handshake” before two browsers can talk directly:

1. “I’m in room `project23` as `p1`.”
2. “Here is my offer (SDP).”
3. “Here is my answer.”
4. “Here are ICE candidates (how to reach me on the network).”

Browsers cannot invent that handshake alone across the internet without some shared place to pass notes.  
Our mesh server is that shared place.

Think of it as a **group chat that only carries setup notes**, not the call itself.

### How you start it

```bash
npm run mesh
```

- Default port: **3000** (`MESH_PORT`)
- Health check: `http://127.0.0.1:3000/health`
- WebSocket path for signaling: `ws://127.0.0.1:3000/ws`

### What’s inside (folders / ideas)

| Piece | File | Easy meaning |
|-------|------|----------------|
| Room list | `rooms.js` | Who is in which room right now |
| Message rules | `protocol.js` | Is this note valid? Reject junk |
| Session logic | `signaling.js` | Join, leave, forward offer/answer/ICE |
| HTTP + WebSocket | `index.js` | Opens the door (port 3000) and wires it all |

There is **no database**. When the process stops, all rooms are forgotten. That is fine for a lab.

---

### Rooms — like meeting rooms with name tags

The server keeps something like:

```text
Room "project23"
  ├── p1  → connected socket
  ├── p2  → connected socket
  └── p3  → connected socket
```

Rules in simple terms:

- A **room** has a name (`roomId`), e.g. `project23`.
- Each person in a room must have a **unique name** (`peerId`), e.g. `p1`, `p2`.
- If `p1` is already in the room and another client tries to join as `p1`, the server says **no** (duplicate).
- The same `peerId` in a **different** room is OK (rooms are separate).
- When the last person leaves a room, the room is deleted from memory.

---

### The message envelope (one shape for every note)

Almost every message looks like:

```json
{
  "type": "join",
  "roomId": "project23",
  "from": "p1",
  "to": "p2",
  "payload": { }
}
```

| Field | Meaning |
|-------|---------|
| `type` | What kind of note this is |
| `roomId` | Which meeting room |
| `from` | Who sent it |
| `to` | Who should receive it (only for some types) |
| `payload` | Extra data (SDP, ICE candidate, error text, …) |

---

### Step-by-step: what happens when someone joins

Imagine `p1` is alone, then `p2` joins.

**1. Browser opens a WebSocket** to `/ws`  
This is a lasting connection (like keeping a phone line open for text messages).

**2. Browser sends `join`**

```json
{ "type": "join", "roomId": "project23", "from": "p2" }
```

**3. Server checks the note**

- Is JSON valid?
- Are `roomId` and `from` non-empty?
- Is `p2` already taken in that room?

If something is wrong → server replies with `type: "error"` and a clear message.

**4. Server adds `p2` to the room**

**5. Server answers only `p2` with `joined`**

```json
{
  "type": "joined",
  "roomId": "project23",
  "from": "server",
  "payload": { "peers": ["p1"] }
}
```

Meaning: “You’re in. These people were already here: `p1`.”

**6. Server tells everyone else `peer-joined`**

```json
{
  "type": "peer-joined",
  "roomId": "project23",
  "from": "p2",
  "payload": { "peerId": "p2" }
}
```

So `p1` learns: “A new person `p2` arrived — start a WebRTC handshake with them.”

After that, **audio does not go through the server**. Browsers create peer connections and send media to each other.

---

### Relaying offers, answers, and ICE (the post office)

Once people are in a room, they send directed notes:

| Type | What it carries | Who receives it |
|------|-----------------|-----------------|
| `offer` | SDP offer string | Only the `to` peer |
| `answer` | SDP answer string | Only the `to` peer |
| `ice-candidate` | Network candidate (or `null` = “done”) | Only the `to` peer |

Example: `p2` sends an offer **to** `p1`:

```json
{
  "type": "offer",
  "roomId": "project23",
  "from": "p2",
  "to": "p1",
  "payload": { "sdp": "v=0..." }
}
```

Server behavior:

1. Confirm the sender already **joined** (no anonymous spam).
2. Confirm `from` / `roomId` match that socket’s session (no pretending to be someone else).
3. Look up `p1` in the room.
4. If found → forward the same note to `p1` only.
5. If not found → send `error` back to the sender (“peer not found”).

**Bystanders never get the offer.** That keeps traffic small and private.

The server does **not** understand SDP. It does not modify the call. It only **copies the note** to the right person.

---

### Leaving and disconnecting

Two ways to leave:

1. **Polite leave** — browser sends `{ "type": "leave", ... }`
2. **Abrupt disconnect** — tab closed, network drop, WebSocket dies

In both cases the server:

1. Removes that peer from the room map  
2. Tells remaining peers `peer-left`  
3. Deletes the room if nobody is left  

So other browsers can close their peer connection to the person who left.

---

### Heartbeat (is this socket still alive?)

Every ~30 seconds (`MESH_HEARTBEAT_MS`) the server pings each WebSocket.

- If a client answers → stay in the room  
- If it never answers → treat as dead, remove them, notify others  

This cleans up “ghost” participants when someone loses Wi‑Fi without a clean leave.

---

### Health endpoint

`GET /health` returns JSON like:

```json
{
  "ok": true,
  "service": "mesh-server",
  "phase": 1,
  "port": 3000,
  "rooms": 1,
  "signaling": true
}
```

Useful to check “is the server up?” without joining a call.

---

### What the mesh server does **not** do

- Does **not** carry microphone/camera RTP media  
- Does **not** mix audio  
- Does **not** store history or users in a database  
- Does **not** authenticate users (lab/dev only — do not expose to the public internet open)

---

### Tiny story for three people

```text
p1 joins  → server: "joined, peers=[]"
p2 joins  → p2 gets "joined, peers=[p1]"
          → p1 gets "peer-joined p2"
p1 ↔ p2   → offer/answer/ICE go through server as directed notes
          → then audio flows p1 ↔ p2 directly (UDP)

p3 joins  → same idea with both p1 and p2
          → each client ends up with 2 peer connections (N−1)

p2 leaves → p1 and p3 get "peer-left p2"
```

---

## Part B — SFU-related servers (simple overview)

Mesh is fully implemented on our Node signaling server.  
SFU mode uses **other** server software. Here is only what matters on the server side.

### 1) LiveKit server (the real SFU)

- You run something like `livekit-server --dev` or Docker.
- Each browser connects **to LiveKit**, not to every other browser for media.
- Each person **uploads one** stream; LiveKit **forwards** copies to the others.
- LiveKit also handles its own join/publish/subscribe signaling over WebSocket.

So for SFU, LiveKit is the “media post office + switchboard.”

### 2) Our SFU helper server (`sfu/server`)

Today (early phases) this is mainly:

- Health check on port **3001**
- Later (Phase 3): mint **join tokens** so a browser is allowed into a LiveKit room

It is **not** where the audio packets go. Tokens are like temporary tickets: “This identity may join this room.”

---

## Mesh vs SFU servers — one sentence each

- **Mesh server:** helps browsers exchange setup notes; media stays peer-to-peer.  
- **LiveKit SFU:** takes each person’s media and forwards it; browsers only upload once.

---

## Quick FAQ

**Does the mesh server hear my voice?**  
No. Only setup messages.

**Why do we need a server at all for mesh?**  
Browsers need a meeting point to exchange offers/answers/ICE before they can connect directly.

**Where is the data stored?**  
Only in RAM while the process runs. No database.

**Can two people use the same peer name?**  
Not in the same room. The server rejects duplicates.

**What port should I open in a firewall for mesh signaling?**  
TCP **3000** (HTTP + WebSocket). Media UDP ports are between browsers (and STUN/TURN if you leave the LAN).

---

## Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — mesh vs SFU diagrams  
- [PROTOCOLS.md](PROTOCOLS.md) — ICE, DTLS, RTP (deeper networking)  
- [SETUP.md](SETUP.md) — how to install and run  
- [GLOSSARY.md](GLOSSARY.md) — short definitions of terms  
