# WebRTC Group Calling — Mesh vs SFU Architecture and Bandwidth Scaling

A 1:1 WebRTC call does not scale to groups: in a full mesh every participant uploads a separate stream to every other participant. SFUs fix the uplink problem. This project builds both architectures and measures where each breaks.

## Learning Objective

Relate architecture choice to **per-host throughput demands** and **access-link bottlenecks**.

## Quick Links

| Document | Purpose |
|----------|---------|
| [docs/INDEX.md](docs/INDEX.md) | Full docs map and reading order |
| [docs/PROJECT_PROPOSAL.md](docs/PROJECT_PROPOSAL.md) | Project proposal (if present) |
| [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) | Formal problem statement and requirements |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Mesh vs SFU design, call anatomy, media paths |
| [docs/SETUP.md](docs/SETUP.md) | Environment, dependencies, LiveKit, tools |
| [docs/EXPERIMENT_PLAN.md](docs/EXPERIMENT_PLAN.md) | N=2–6 tests, uplink caps, scenarios |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Metrics, getStats collection, analysis |
| [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) | JSON/CSV results contract |
| [docs/REPORT_TEMPLATE.md](docs/REPORT_TEMPLATE.md) | Blank lab report outline |
| [docs/REPORT.md](docs/REPORT.md) | Filled report (from CSV via `npm run fill-report`) |
| [docs/CHECKLIST.md](docs/CHECKLIST.md) | Submission readiness |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phase-wise complete-build plan |

## Core POC

1. **Mesh** — custom WebSocket signaling; N−1 peer connections per client  
2. **SFU** — LiveKit; one connection to the SFU per client  
3. **Automation** — Puppeteer + fake media for N = 2…6; schema-v1 JSON; summarize + failure points  
4. **Dashboard** — browse runs and mesh vs SFU curves in the browser  

## Exact runbook (clean machine)

```bash
npm install
cp .env.example .env          # PowerShell: Copy-Item .env.example .env

# --- Mesh ---
npm run mesh                  # Express+WS  http://127.0.0.1:3000/health
npm run mesh:client           # Vite        http://127.0.0.1:5173

# --- SFU ---
npm run livekit               # LiveKit --dev (needs Docker or livekit-server)
npm run sfu                   # Token API   http://127.0.0.1:3001/health
npm run sfu:client            # Vite        http://127.0.0.1:5174

# --- Dashboard ---
npm run dashboard             # API         http://127.0.0.1:5180/health
npm run dashboard:client      # UI          http://127.0.0.1:5181

# --- One run (Phase 5) — mesh client must be up ---
npm run run-once -- --mode mesh --n 2 --duration 20 --cap uncapped

# --- Matrix + summarize (Phase 6) ---
npm run matrix -- --dry-run
npm run matrix -- --n 2,3,4,5,6 --modes mesh,sfu --duration 90 --cooldown 15
npm run summarize             # → results/summary/bitrate-vs-n.csv (+ failure-points.md)

# --- Uplink cap (Phase 7, Linux/WSL) ---
sudo ./scripts/tc-uplink.sh apply eth0 1mbit
npm run run-once -- --mode mesh --n 3 --cap 1Mbps --tc-iface eth0 --duration 20
sudo ./scripts/tc-uplink.sh clear eth0
# or matrix subset:
# npm run matrix -- --cap 1Mbps --n 3,4,5 --tc-iface eth0 --duration 20 --cooldown 5

# --- Report wiring (Phase 8) ---
npm run plot                  # SVG figures → docs/figures/ (uses results CSV or fixtures)
npm run fill-report           # docs/REPORT.md from CSV
npm run verify:phase8         # plots + report + README + unit tests

# --- Tests ---
npm test
npm run test:automation
```

Fake-media Chromium flags are applied by `launchParticipants` (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--autoplay-policy=no-user-gesture-required`).

## Testing Snapshot

| Variable | Values |
|----------|--------|
| Participants (N) | 2, 3, 4, 5, 6 |
| Modes | Mesh, SFU |
| Uplink caps (one participant) | uncapped, 1 Mbps, 5 Mbps |

## Evaluation Metrics

- Uplink / downlink bitrate per client vs N  
- CPU per client and SFU  
- RTT, jitter, packet loss  
- Join time  
- Failure N under caps (`results/summary/failure-points.md`)  

## Repository Layout

```
WebRtc/
├── README.md
├── package.json             # npm workspaces
├── shared/
├── docs/                    # spec, plan, REPORT.md, figures/
├── mesh/                    # server + React client
├── sfu/                     # token API + React client
├── dashboard/               # Results Dashboard (Phase 9)
├── automation/              # runOnce, matrix, summarize, plot helpers
├── scripts/                 # livekit, tc-uplink, summarize, plot, verify
└── results/                 # schema-v1 JSON + summary CSV (gitignored data)
```

## Free / Open-Source Stack

| Component | Role |
|-----------|------|
| LiveKit server (`--dev`) | SFU |
| LiveKit JS SDK | SFU client |
| Node.js + Express + `ws` | Signaling / tokens / automation |
| React + Vite | Mesh and SFU frontends |
| Puppeteer + Chromium | Headless participants with fake media |
| `tc` (Linux) | Uplink bandwidth caps |
| Results Dashboard | Browse / plot experiment JSON |

## License Note

LiveKit server is Apache 2.0. Use open-source tooling only as specified in the FREE stack.
