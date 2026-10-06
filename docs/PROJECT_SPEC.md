# Project Specification

## Project Identity

| Field | Value |
|-------|-------|
| Project ID | 23 |
| Title | WebRTC Group Calling: Mesh vs SFU Architecture and Bandwidth Scaling |
| Domain | Computer Networking / Real-time Media |
| Type | Hands-on POC + measurement study |

## Problem Statement

A 1:1 WebRTC call does not scale to groups. In a **full mesh**, every participant uploads a separate stream to every other participant. That makes uplink demand grow as **O(N−1)** per client and total network load as **O(N(N−1))**.

**Selective Forwarding Units (SFUs)** fix the uplink problem: each client uploads **one** stream to the SFU, which forwards copies (without mixing) to other subscribers. Downlink still grows with N, but the access-link uplink bottleneck is greatly reduced.

Students build **both** architectures and measure **where each breaks**.

## Learning Objective

Relate architecture choice to:

1. Per-host throughput demands (uplink vs downlink)
2. Access-link bottlenecks (especially constrained uplinks)
3. Trade-offs: mesh simplicity vs SFU infrastructure and forwarding cost

## Scope

### In Scope (Core POC)

- Audio conference (primary); optional low-resolution video
- Mesh mode with custom WebSocket signaling
- SFU mode with LiveKit (preferred) or Janus
- Automated headless Chromium participants (Puppeteer + fake media)
- Experiments for N = 2, 3, 4, 5, 6 in both modes
- Uplink caps of 1 Mbps and 5 Mbps on one participant (`tc`)
- Collection of `getStats()`, CPU, and join-time metrics

### Out of Scope (unless Advanced)

- Production auth / multi-tenant rooms
- Recording / SIP gateways
- Full MCU audio mixing comparison (optional advanced)
- Cross-continent latency studies (lab LAN is sufficient for core)

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Mesh: participant joins room via WebSocket signaling | Must |
| FR-2 | Mesh: each pair runs independent offer/answer (N−1 PCs per client) | Must |
| FR-3 | Mesh: media path is direct P2P UDP between pairs | Must |
| FR-4 | SFU: LiveKit (or Janus) in dev mode hosts media | Must |
| FR-5 | SFU: each client has one connection to SFU; publish + subscribe | Must |
| FR-6 | Audio conference works for N ≥ 3 in both modes | Must |
| FR-7 | Puppeteer launches N headless participants with fake media | Must |
| FR-8 | Script collects per-client getStats for each (mode, N) run | Must |
| FR-9 | Optional low-res video toggle | Should |
| FR-10 | `tc` uplink cap on one client for failure-point discovery | Must |

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Prefer FREE/open-source stack only |
| NFR-2 | Local lab LAN testing is sufficient for core results |
| NFR-3 | Single-laptop runs allowed (CPU is the limit for N≈6) |
| NFR-4 | Results reproducible via documented scripts and parameters |
| NFR-5 | Metrics exported as machine-readable JSON/CSV |

## Networking Concepts Covered

- Throughput and bottleneck links
- Application architectures (mesh vs SFU middlebox)
- Content distribution by a middlebox (forwarding, not mixing)
- UDP real-time media; TCP signaling

## Protocols Involved

See [PROTOCOLS.md](PROTOCOLS.md) for detail.

1. Call establishment (signaling + offer/answer or SFU publish/subscribe)
2. Signaling: custom WebSocket (mesh); LiveKit WebSocket (SFU)
3. Media path: P2P UDP (mesh) vs uplink-to-SFU + N−1 downs (SFU)
4. ICE/STUN, DTLS-SRTP, RTP/RTCP, simulcast (advanced), WebSocket
5. TCP for signaling; UDP for media (TCP fallback in LiveKit)
6. SFU RTP forwarding with SSRC/sequence rewrite; layer selection with simulcast
7. NAT: none on lab LAN; TURN/coturn for optional cross-network tests

## Success Criteria

The project is complete when:

1. A 3-party mesh audio call works end-to-end
2. An SFU audio call via LiveKit works for at least N = 3
3. Automated runs produce stats for N = 2–6 in **both** modes
4. At least one uplink-capped experiment identifies an N where mesh quality collapses while SFU remains usable (or documents why not, with evidence)
5. A short report plots bitrate/CPU vs N and discusses bottlenecks

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Source code | Mesh server/client, SFU client, automation, scripts |
| Documentation | This docs set + README |
| Results data | JSON/CSV under `results/` |
| Report | Filled [REPORT_TEMPLATE.md](REPORT_TEMPLATE.md) |

## Suggested Technologies

- LiveKit or Janus
- Node.js
- React + Vite (mesh and SFU frontends)
- Puppeteer
- Browser WebRTC API
- Chromium / Chrome
- Wireshark, `tc`
