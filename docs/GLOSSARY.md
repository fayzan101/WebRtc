# Glossary

| Term | Definition |
|------|------------|
| **Mesh** | Full P2P group call: every pair has a direct WebRTC connection |
| **SFU** | Selective Forwarding Unit — relays RTP to subscribers without mixing |
| **MCU** | Multipoint Control Unit — decodes, mixes, re-encodes media |
| **Signaling** | Control channel (usually WebSocket/TCP) for join and session setup |
| **SDP** | Session Description Protocol — offer/answer media/transport description |
| **ICE** | Interactive Connectivity Establishment — candidate gathering + checks |
| **STUN** | Session Traversal Utilities for NAT — reflexive address discovery |
| **TURN** | Traversal Using Relays around NAT — relayed candidates when P2P fails |
| **DTLS-SRTP** | DTLS-derived keys protecting SRTP media |
| **RTP/RTCP** | Real-time media packets / control & quality reports |
| **SSRC** | Synchronization source id in RTP |
| **Simulcast** | Multiple concurrent encodings; SFU picks a layer per receiver |
| **getStats()** | Browser API exposing WebRTC send/receive quality counters |
| **Uplink** | Client → network/SFU send path (often the scarce access direction) |
| **Downlink** | Network/SFU → client receive path |
| **Bottleneck link** | Slowest / most constrained link that limits end-to-end throughput |
| **Fake media** | Chromium synthetic A/V for headless automation |
| **Puppeteer** | Node library to drive headless Chromium |
| **tc** | Linux traffic control — used here to cap uplink rate |
| **LiveKit** | Open-source WebRTC SFU stack used in `--dev` for this lab |
| **Janus** | Alternative open-source WebRTC gateway/SFU/MCU platform |
| **N** | Number of participants in the room |
| **Join time** | Time from join start until N−1 remotes are receiving |
