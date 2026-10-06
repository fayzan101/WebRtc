# WebRTC Group Calling — Mesh vs SFU Architecture and Bandwidth Scaling

A 1:1 WebRTC call does not scale to groups: in a full mesh every participant uploads a separate stream to every other participant. SFUs fix the uplink problem. This project builds both architectures and measures where each breaks.

## Learning Objective

Relate architecture choice to **per-host throughput demands** and **access-link bottlenecks**.

## Quick Links

| Document | Purpose |
|----------|---------|
| [docs/INDEX.md](docs/INDEX.md) | Full docs map and reading order |
| [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) | Formal problem statement and requirements |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Mesh vs SFU design, call anatomy, media paths |
| [docs/PROTOCOLS.md](docs/PROTOCOLS.md) | ICE/STUN, DTLS-SRTP, RTP/RTCP, signaling, NAT |
| [docs/SETUP.md](docs/SETUP.md) | Environment, dependencies, LiveKit, tools |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Step-by-step build guide (mesh → SFU → automation) |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phase-wise plan — complete builds only (no stubs) |
| [docs/EXPERIMENT_PLAN.md](docs/EXPERIMENT_PLAN.md) | N=2–6 tests, uplink caps, scenarios |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Metrics, getStats collection, analysis |
| [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) | JSON/CSV results contract |
| [docs/REPORT_TEMPLATE.md](docs/REPORT_TEMPLATE.md) | Lab report structure for submission |
| [docs/ADVANCED.md](docs/ADVANCED.md) | Optional: simulcast, MCU, active speaker |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Terms |
| [docs/CHECKLIST.md](docs/CHECKLIST.md) | Submission readiness |

## Core POC

An **audio conference** (optional low-resolution video) in two modes:

1. **Mesh** — custom WebSocket signaling; N−1 peer connections per client
2. **SFU** — LiveKit (or Janus); one connection to the SFU per client

Automated participants for **N = 2 to 6** via Puppeteer + fake media, with a script that collects `getStats()` data.

## Networking Concepts

- Throughput and bottleneck links
- Application architectures (P2P mesh vs middlebox SFU)
- Content distribution by a middlebox
- UDP real-time media

## Free / Open-Source Stack

| Component | Role |
|-----------|------|
| LiveKit server (`livekit-server --dev`) or Janus | SFU |
| LiveKit JS SDK | SFU client |
| Node.js | Signaling server, automation, stats scripts |
| React + Vite | Mesh and SFU frontends |
| Puppeteer + Chromium | Headless participants with fake media |
| Chrome DevTools / `getStats()` | Quality metrics |
| Wireshark | Packet capture (RTP/UDP/WebSocket) |
| `tc` (Linux traffic control) | Uplink bandwidth caps |

## Implementation Checklist

- [ ] 1. Build mesh signaling and verify a 3-party audio call
- [ ] 2. Deploy LiveKit in dev mode; build the SFU client page
- [ ] 3. Automate participants with Puppeteer and fake media
- [ ] 4. Collect getStats and CPU for N = 2–6 in both modes
- [ ] 5. Cap one client’s uplink with `tc` and find the N where mesh fails

## Testing Snapshot

| Variable | Values |
|----------|--------|
| Participants (N) | 2, 3, 4, 5, 6 |
| Modes | Mesh, SFU |
| Uplink caps (one participant) | unlimited, 1 Mbps, 5 Mbps |

## Evaluation Metrics

- Uplink / downlink bitrate per client vs N
- CPU per client and SFU
- RTT, jitter, packet loss
- Join time

## Repository Layout

```
WebRtc/
├── README.md
├── package.json             # npm workspaces
├── shared/                  # room/peer constants
├── docs/
├── mesh/
│   ├── server/              # Express (+ WS in Phase 1)
│   └── client/              # React + Vite mesh UI
├── sfu/
│   ├── server/              # Express token API (Phase 3)
│   └── client/              # React + Vite SFU UI
├── automation/              # Puppeteer (Phase 5+)
├── scripts/
└── results/
```

## Quick start (Phase 0)

```bash
npm install
cp .env.example .env   # optional on Windows: copy .env.example .env
npm run mesh           # http://127.0.0.1:3000/health
npm run sfu            # http://127.0.0.1:3001/health
npm run mesh:client    # http://127.0.0.1:5173 (proxies /health)
npm run sfu:client     # http://127.0.0.1:5174
```

## License Note

LiveKit server is Apache 2.0. Use open-source tooling only as specified in the FREE stack.
