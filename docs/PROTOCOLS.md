# Protocols and Networking Concepts

## Protocol Stack (WebRTC Group Call)

```
Application:  Room join, publish/subscribe, mesh pairing
Signaling:    WebSocket over TCP (custom or LiveKit)
Negotiation:  SDP offer/answer (mesh) / LiveKit signaling msgs (SFU)
Connectivity: ICE (+ STUN; TURN if needed)
Security:     DTLS-SRTP
Media:        RTP / RTCP over UDP (SRTP)
```

## 1. Call Establishment

### Mesh

- Participant joins a room via **signaling**
- Each pair runs its own **offer/answer**
- Result: **N−1** `RTCPeerConnection`s per client

### SFU

- Participant joins via LiveKit signaling
- One WebRTC connection toward the SFU
- Publishes local track(s); subscribes to others

## 2. Signaling

| Mode | Mechanism |
|------|-----------|
| Mesh | Students’ WebSocket server |
| SFU | LiveKit’s built-in WebSocket signaling |

Signaling carries:

- Room membership events
- SDP (mesh) or equivalent session directives (SFU)
- Trickle ICE candidates (mesh; SFU handles internally via SDK)

Signaling is typically **TCP** (WebSocket), reliable and ordered — suitable for control, not for low-latency media.

## 3. Media Path

| Mode | Path |
|------|------|
| Mesh | Direct **P2P UDP** between all pairs |
| SFU | One **uplink** stream to SFU; SFU **forwards** N−1 streams down **without mixing** |

SFU ≠ MCU: an SFU does not decode/mix/re-encode by default; it selectively forwards RTP.

## 4. Protocols Involved

### ICE / STUN

- **ICE** gathers candidates (host, srflx, relay) and connectivity checks
- **STUN** discovers public reflexive address behind NAT
- On a **lab LAN**, host candidates often suffice (no NAT traversal drama)

### DTLS-SRTP

- **DTLS** handshake derives keys
- **SRTP** encrypts RTP media
- Protects confidentiality/integrity of audio/video packets

### RTP / RTCP

- **RTP**: media payload + sequence number + timestamp + SSRC
- **RTCP**: sender/receiver reports — loss, jitter, RTT estimates
- Browser `getStats()` exposes many of these counters

### Simulcast (advanced)

- Sender publishes multiple encodings (e.g., low/mid/high)
- SFU picks a **layer per receiver** based on bandwidth/subscribe prefs
- Useful when one receiver is bandwidth-limited (`tc`)

### WebSocket

- Persistent TCP channel for signaling
- Mesh: your messages; SFU: LiveKit protocol framed over WS

## 5. TCP vs UDP Usage

| Plane | Typical transport |
|-------|-------------------|
| Signaling | **TCP** (WebSocket) |
| Media | **UDP** (RTP/SRTP) |
| Fallback | LiveKit can fall back toward TCP/TURN paths when UDP is blocked |

UDP preferred for media: no head-of-line blocking, lower latency under loss.

## 6. RTP / WebRTC Role of the SFU

The SFU:

1. Receives RTP from each publisher
2. **Forwards** packets to subscribers (no mix)
3. May **rewrite** SSRCs / sequence numbers / timestamps as needed for each outbound stream
4. With **simulcast**, selects which layer to forward per subscriber
5. Still terminates WebRTC security associations with each client (DTLS-SRTP per leg)

## 7. NAT Considerations

| Environment | Expectation |
|-------------|-------------|
| Lab LAN (same subnet) | Host ICE candidates; STUN optional |
| Cross-network / home NAT | STUN for srflx; **TURN** if symmetric NAT / firewall |
| LiveKit | Embedded TURN in some setups, or external **coturn** |

For core coursework, LAN + optional `tc` shaping is enough. Document any TURN use in advanced cross-network tests.

## 8. Quality Metrics (from getStats + host)

Collect at least:

| Metric | Source | Notes |
|--------|--------|-------|
| Uplink bitrate | `outbound-rtp` bytesSent delta | Per PC (mesh) or publish (SFU) |
| Downlink bitrate | `inbound-rtp` bytesReceived delta | Sum across remotes |
| RTT | `candidate-pair` currentRoundTripTime | Or RTCP-derived |
| Jitter | `inbound-rtp` jitter | Seconds in stats |
| Loss | packetsLost / packetsReceived | Per inbound stream |
| CPU | OS sampler (client processes, SFU process) | Puppeteer + server PID |
| Join time | Timestamp join start → first remote audio/track | Application timer |

## 9. Local Testing Model

- **2–6** headless Chromium participants
- **Puppeteer** + fake media (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`)
- One laptop: **CPU is the limit** — call out CPU-bound vs network-bound results
- Or several lab laptops for cleaner network isolation

## 10. Free Tools Mapping

| Tool | Use |
|------|-----|
| `livekit-server --dev` | Local SFU |
| LiveKit JS SDK | SFU page |
| Node.js | Mesh signaling + automation |
| Puppeteer / Chromium | Fake participants |
| Wireshark | Confirm UDP RTP vs TCP signaling |
| `tc` | Cap uplink (1 / 5 Mbps) |

## Concept Checklist (Exam / Viva Ready)

- [ ] Why mesh uplink is O(N) per client
- [ ] Why SFU fixes uplink but not downlink growth
- [ ] Difference between SFU forwarding and MCU mixing
- [ ] Why signaling uses TCP and media uses UDP
- [ ] What ICE/STUN/TURN each contribute
- [ ] What DTLS-SRTP protects
- [ ] How getStats relates to RTCP receiver reports
- [ ] How `tc` reveals access-link bottlenecks
