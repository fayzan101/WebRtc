# Environment Setup

## Prerequisites

| Tool | Version (suggested) | Purpose |
|------|---------------------|---------|
| Node.js | 18+ LTS | Signaling, automation, scripts |
| npm / pnpm | latest | Package management |
| Google Chrome or Chromium | recent stable | WebRTC clients / Puppeteer |
| LiveKit Server | latest stable | SFU (`livekit-server --dev`) |
| Git | any | Version control |
| Wireshark | optional | Packet analysis |
| Linux with `tc` | for uplink caps | Bandwidth emulation |

> **Windows note:** Core mesh/SFU/Puppeteer can run on Windows. `tc` is Linux traffic control — use WSL2, a Linux VM, or a Linux lab machine for capped-uplink experiments.

## 1. Clone / Project Root

```bash
cd WebRtc
npm init -y   # when implementing; docs-only repos can skip until coding starts
```

## 2. Mesh Stack

```bash
# From project root (once mesh/ exists)
cd mesh/server && npm install ws express cors
cd ../client   # Vite + React app (npm run dev)
```

**Minimal mesh server needs:**

- HTTP static file hosting (client page)
- WebSocket endpoint for signaling

## 3. LiveKit SFU (Dev Mode)

### Install LiveKit Server

Pick one:

**Option A — Download binary** (see [LiveKit docs](https://docs.livekit.io/home/self-hosting/local/))

**Option B — Docker** (or `npm run livekit`, which uses the same flags)

```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server --dev --bind 0.0.0.0 --node-ip 127.0.0.1
```

Without `--bind 0.0.0.0`, LiveKit only listens on container localhost and browsers get `could not establish signal connection: Failed to fetch`.

**Option C — Installed CLI/binary**

```bash
livekit-server --dev
```

Dev mode typically:

- Listens for WebRTC / HTTP API on local ports (commonly `7880`)
- Uses published dev API key/secret (fine for lab only)

### SFU token server + React client (Phase 3)

Copy env once (gitignored): `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`).

```bash
# Terminal A — LiveKit SFU
npm run livekit

# Terminal B — token API (default :3001; override with SFU_PORT in .env)
npm run sfu

# Terminal C — React client (:5174; proxies /token using SFU_PORT)
npm run sfu:client
```

`POST /token` body: `{ "roomName": "project23", "identity": "p1" }`  
Uses `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` from `.env` (defaults match `livekit-server --dev`).

If you see `LIVEKIT_API_KEY is required`, `.env` is missing. If `Port 3001 is already in use`, set `SFU_PORT=3002` (or any free port) in `.env` — Docker/WSL sometimes holds 3001 on Windows.

### Results dashboard (Phase 9)

```bash
# Terminal A — API (:5180) lists results/ + fixtures
npm run dashboard

# Terminal B — UI (:5181) proxies /api → dashboard server
npm run dashboard:client
```

Open http://localhost:5181/ — Overview / Compare N / Run detail.  
Real runs: write schema-v1 JSON under `results/mesh/` or `results/sfu/` (see [DATA_SCHEMA.md](DATA_SCHEMA.md)); optional `results/summary/bitrate-vs-n.csv`. Until then, bundled fixtures under `dashboard/client/public/fixtures/` power the charts.

## 4. Puppeteer Automation (Phase 5)

From repo root (`npm install` already pulls `puppeteer` + `pidusage` into `@webrtc/automation`):

```bash
# Mesh path — signaling + Vite client must be up
npm run mesh
npm run mesh:client

# Single run → results/mesh/n2-uncapped-001.json
npm run run-once -- --mode mesh --n 2 --duration 20 --cap uncapped

# Phase 6 — uncapped matrix (mesh+sfu × N=2..6) then CSV summary
npm run matrix -- --dry-run
npm run matrix -- --duration 90 --cooldown 15
npm run summarize
# → results/summary/bitrate-vs-n.csv + markdown tables on stdout
# fixtures dry-check: npm run summarize -- --results dashboard/client/public/fixtures
```

SFU path: start LiveKit + `npm run sfu` + `npm run sfu:client`, then `--mode sfu` (or include sfu in the matrix).  
Optional SFU CPU: set `LIVEKIT_PID` (or `SFU_PID`) in `.env` to the LiveKit process id.

Useful Chromium flags (applied by `launchParticipants`):

```text
--use-fake-device-for-media-stream
--use-fake-ui-for-media-stream
--autoplay-policy=no-user-gesture-required
```

Optional: `--audio-file /path/to/audio.wav` → `--use-file-for-fake-audio-capture=…`.

## 5. Wireshark (Optional)

Capture filter examples:

```text
udp or websocket
```

Or port-based once you know LiveKit / ephemeral WebRTC ports.

Verify:

- Signaling on TCP WebSocket
- Media on UDP

## 6. Traffic Control (`tc`) — Uplink Caps (Phase 7)

On Linux, identify the client interface (e.g. `eth0`, `wlan0`), then use the helper:

```bash
sudo ./scripts/tc-uplink.sh apply eth0 1mbit
./scripts/tc-uplink.sh show eth0
sudo ./scripts/tc-uplink.sh apply eth0 5mbit
sudo ./scripts/tc-uplink.sh clear eth0
```

Automation (does **not** shape from Windows blindly — requires `--tc-iface` on Linux/WSL):

```bash
# Label + real shaping
npm run run-once -- --mode mesh --n 3 --cap 1Mbps --tc-iface eth0 --duration 20

# Capped matrix subset (N=3,4,5)
npm run matrix -- --cap 1Mbps --n 3,4,5 --tc-iface eth0 --duration 20 --cooldown 5

# Summarize → CSV + results/summary/failure-points.md
npm run summarize
```

`--cap` alone only records the label in JSON. Pass `--tc-iface` so `runOnce` calls `tc-uplink.sh apply` before launch and `clear` in `finally`.  
`--capped-peer p1` marks which participant is the capped role in the schema (default `p1`).

**Single-laptop caveat:** shaping the NIC egress affects all browsers on that host. Prefer a multi-host setup (capped peer on a Linux machine) for clean isolation; the run `notes` field records when tc was applied.

### WSL2 / Windows

- Core mesh/SFU/Puppeteer can run on Windows
- Real `tc` caps need Linux (native, VM, or WSL with a real iface) — set `TC_SHELL` if `bash` is not on PATH
- Or run the shaped peer on a separate Linux laptop on the lab LAN

## 7. Ports (Typical Local Dev)

| Service | Port (typical) |
|---------|----------------|
| Mesh HTTP + WS | 3000 (or chosen) |
| LiveKit | 7880 (HTTP/WS), UDP media ports as configured |
| Token endpoint | small Express port if separate |

Allow local firewall access for UDP between machines if using multiple laptops.

## 8. Directory Bootstrap (when coding begins)

```text
WebRtc/
├── mesh/
│   ├── server/
│   └── client/
├── sfu/
├── automation/
├── scripts/
│   ├── tc-uplink.sh
│   └── run-matrix.sh
└── results/
    ├── mesh/
    └── sfu/
```

## 9. Sanity Checks

| Check | Pass criteria |
|-------|---------------|
| Mesh 2-party | Bidirectional audio (or fake track stats rising) |
| Mesh 3-party | Each hears/receives the other two |
| LiveKit `--dev` up | Health/API responds; client can join room |
| SFU 3-party | Three publishers visible to each other |
| Puppeteer N=2 | Headless join + stats file written |
| `tc` 1 Mbps | `tc qdisc show` reflects rate; bitrate/loss respond |

## 10. Safety

- Do not commit real production secrets
- Keep LiveKit `--dev` and open mesh rooms on localhost / lab LAN only
- Fake media in CI/automation to avoid device prompts
