# Architecture: Mesh vs SFU

## Overview

Group calling can be implemented as:

| Mode | Topology | Uplink per client | Downlink per client | Media middlebox |
|------|----------|-------------------|---------------------|-----------------|
| **Mesh** | Full P2P clique | **(N−1)** encodings/sends | **(N−1)** receives | None |
| **SFU** | Star via server | **1** send | **(N−1)** receives (forwarded) | Selective Forwarding Unit |
| **MCU** *(advanced)* | Star via mixer | **1** send | **1** mixed receive | Mixer (decode/mix/encode) |

This project builds **Mesh** and **SFU** and measures scaling.

## Call Anatomy

### 1. Call establishment

**Mesh**

1. Client opens WebSocket to signaling server and joins `roomId`.
2. Server notifies existing members of the new peer.
3. For each other member, the joiner (or a designated polite/impolite peer) creates an `RTCPeerConnection`, creates an offer, and completes offer/answer.
4. Each client ends up with **N−1** peer connections.

**SFU (LiveKit)**

1. Client obtains a token and connects to LiveKit over its WebSocket signaling.
2. Client publishes local track(s) once.
3. Client subscribes to remote participants’ tracks as they appear.
4. Each client has **one** media connection to the SFU (conceptually one uplink path).

### 2. Signaling

| Mode | Transport | Responsibility |
|------|-----------|----------------|
| Mesh | Student WebSocket server (TCP) | Room membership, SDP offer/answer relay, ICE candidate relay |
| SFU | LiveKit built-in WebSocket signaling | Join, publish, subscribe, renegotiation, data messages |

Signaling never carries media; it only coordinates session setup.

### 3. Media path

```
MESH (N=4 example)

  A ←──UDP──→ B
  A ←──UDP──→ C
  A ←──UDP──→ D
  B ←──UDP──→ C
  B ←──UDP──→ D
  C ←──UDP──→ D

  Edges = N(N−1)/2 bidirectional RTP sessions
  Per client: upload (N−1), download (N−1)
```

```
SFU (N=4 example)

  A ──up──┐
  B ──up──┼──→ SFU ──→ forwards to each subscriber
  C ──up──┤
  D ──up──┘

  Per client: upload 1, download (N−1)
  SFU: ingress N, egress N(N−1) (no mixing)
```

### 4–7. Protocols, TCP/UDP, RTP role, NAT

Covered in [PROTOCOLS.md](PROTOCOLS.md).

## Bandwidth Scaling Model (Audio-centric)

Assume each unidirectional audio stream costs roughly **R** bits/s (e.g., Opus ~32–64 kbps plus RTP/UDP/IP overhead).

| Quantity | Mesh | SFU |
|----------|------|-----|
| Client uplink | (N−1)·R | R |
| Client downlink | (N−1)·R | (N−1)·R |
| Client total access | 2(N−1)·R | N·R |
| Aggregate network (approx.) | N(N−1)·R | N·R ingress + N(N−1)·R egress at SFU |

**Key insight:** Mesh and SFU have similar **downlink** growth for receivers, but mesh **uplink** grows linearly with N while SFU uplink stays ~constant. Access links are often **asymmetric** (upload << download), so mesh fails first on uplink.

With video (or simulcast layers), R is much larger and mesh collapses earlier.

## Component Architecture (Target Implementation)

### Mesh

```
┌─────────────┐     WebSocket (TCP)      ┌──────────────────┐
│ Browser A   │◄────────────────────────►│ Signaling Server │
│ N−1 PCs     │                          │ (Node.js)        │
└──────┬──────┘                          └────────▲─────────┘
       │ RTP/UDP P2P                               │
┌──────┴──────┐                                    │
│ Browser B   │◄───────────────────────────────────┘
│ N−1 PCs     │         (same for C, D, …)
└─────────────┘
```

**Signaling message types (suggested):**

- `join` / `joined` / `peer-joined` / `peer-left`
- `offer` / `answer` / `ice-candidate`
- Include `roomId`, `from`, `to`, SDP or candidate payload

### SFU (LiveKit)

```
┌─────────────┐  LiveKit WS + WebRTC   ┌─────────────────┐
│ Browser A   │◄──────────────────────►│ livekit-server  │
│ 1 publish   │                        │ --dev           │
│ N−1 subs    │                        │ (SFU)           │
└─────────────┘                        └─────────────────┘
```

Clients use `@livekit/client` (or LiveKit JS SDK) to connect, publish mic (or fake track), and render remote audio.

### Automation Harness

```
┌────────────────────┐
│ Node runner        │
│ - spawn N Chromium │
│ - fake A/V devices │
│ - join mesh or SFU │
│ - poll getStats()  │
│ - sample CPU       │
│ - write results/   │
└────────────────────┘
```

## Bottleneck Map

| Bottleneck | Favors | Why |
|------------|--------|-----|
| Client uplink (1–5 Mbps cap) | SFU | Mesh needs (N−1) concurrent uploads |
| Client CPU (encode N−1) | SFU | Mesh encodes/sends multiple times |
| SFU CPU / egress bandwidth | Mesh (no SFU) | SFU must forward many copies |
| Single-laptop Puppeteer | Both limited | Shared CPU/GPU; interpret carefully |
| Lab LAN symmetric GigE | Delays failure | Use `tc` to emulate access links |

## Failure Modes to Observe

1. **Mesh + capped uplink:** rising loss/jitter, audio dropouts as N grows
2. **Mesh + CPU:** encoder overload; rising RTT/jitter even with free bandwidth
3. **SFU + many subscribers:** SFU egress or laptop CPU saturates before client uplink
4. **Join time:** mesh O(N) offer/answer negotiations vs SFU single join

## Design Decisions (Recommended)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary media | Audio first | Isolates architecture effect; video optional |
| Mesh signaling | Node.js `ws` | Simple, matches course stack |
| SFU | LiveKit `--dev` | Free, Apache 2.0, easy local run |
| Automation | Puppeteer | Fake media flags, repeatable N |
| Stats | `RTCPeerConnection.getStats()` | Standard WebRTC quality signals |
| Bandwidth emulation | `tc` (Linux) or equivalent | Controlled uplink caps |

## Security / Lab Notes

- Dev keys and open rooms are fine for local lab only
- Do not expose `--dev` LiveKit or open mesh signaling to the public Internet without auth
- Fake media avoids camera/mic permission friction in automation
