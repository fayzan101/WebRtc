# Phase-Wise Implementation Plan (Complete Builds Only)

**Rule for every phase:** ship **working end-to-end code**. No stubs, no `TODO` media paths, no fake “stats later”, no empty Puppeteer shells. A phase is done only when its **acceptance tests pass on a real run**.

**Stack decisions (locked for this plan)**

| Choice | Decision |
|--------|----------|
| Mesh signaling | Node.js + `ws` + Express (API + WS; proxies Vite in dev) |
| Mesh / SFU UI | **React 18 + Vite** (TypeScript preferred) |
| SFU media | LiveKit server `--dev` + `livekit-client` |
| Tokens | Express endpoint using `livekit-server-sdk` |
| Automation | Puppeteer against Vite dev URLs or built `dist/` |
| Stats schema | [DATA_SCHEMA.md](DATA_SCHEMA.md) `schemaVersion: 1` |
| Package layout | npm workspaces at repo root |

**React conventions**

- WebRTC/LiveKit logic lives in plain modules/hooks (`useMeshRoom`, `useSfuRoom`), not inside JSX soup
- Automation hooks still attach to `window.__webrtc*` from a small `installAutomationApi()` called in `useEffect`
- Dev: Vite on 5173 (mesh) / 5174 (sfu); proxy `/ws` and `/token` to Express
- Prod/lab: `vite build` → Express serves `client/dist`

---

## Target Repository Layout (end state)

```text
WebRtc/
├── package.json                 # workspaces + root scripts
├── .env.example
├── mesh/
│   ├── server/
│   │   ├── package.json
│   │   ├── src/index.js         # HTTP + WebSocket signaling (+ dist static)
│   │   └── src/rooms.js         # room/peer registry
│   └── client/                  # Vite + React app
│       ├── package.json
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/      # JoinForm, StatusPanel, RemoteMedia
│           ├── lib/signaling.ts
│           ├── lib/mesh.ts      # N−1 RTCPeerConnections
│           ├── lib/stats.ts
│           ├── lib/automation.ts
│           └── hooks/useMeshRoom.ts
├── sfu/
│   ├── server/
│   │   ├── package.json
│   │   └── src/index.js         # token API + dist static
│   └── client/                  # Vite + React app
│       ├── package.json
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/
│           ├── lib/sfuRoom.ts
│           ├── lib/stats.ts
│           ├── lib/automation.ts
│           └── hooks/useSfuRoom.ts
├── automation/
│   ├── package.json
│   ├── src/launchParticipants.js
│   ├── src/collectStats.js
│   ├── src/cpuSampler.js
│   ├── src/runOnce.js
│   └── src/runMatrix.js
├── scripts/
│   ├── start-mesh.sh / .ps1
│   ├── start-sfu.sh / .ps1
│   ├── start-livekit.sh / .ps1
│   ├── tc-uplink.sh
│   └── summarize-results.js
└── results/
    ├── mesh/
    ├── sfu/
    └── summary/
```

---

## Phase 0 — Monorepo Scaffold + Shared Contracts

**Goal:** runnable workspace with shared message/stats contracts so later phases plug in without rework.

### Implement (complete)

1. Root `package.json` with workspaces: `mesh/server`, `mesh/client`, `sfu/server`, `sfu/client`, `automation`.
2. Scaffold **two Vite React apps** (`mesh/client`, `sfu/client`) with a real `App` that renders title + health ping to their Express backends.
3. `.env.example` with:
   - `MESH_PORT=3000`
   - `SFU_PORT=3001`
   - `MESH_VITE_PORT=5173` / `SFU_VITE_PORT=5174`
   - `LIVEKIT_URL=ws://127.0.0.1:7880`
   - `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (dev defaults documented)
4. Shared constants (room default `project23`, peer id pattern `p1`…`pN`).
5. Root scripts: `mesh`, `mesh:client`, `sfu`, `sfu:client`, `livekit`, `matrix`.
6. `.gitignore`: `node_modules`, `dist`, `.env`, raw `results/**/*.json`.

### Explicitly out of scope here

No WebRTC mesh/SFU logic yet — but apps must **compile and render** (not an empty Vite template left untouched).

### Acceptance

- [ ] `npm install` from root succeeds
- [ ] Express health routes return 200
- [ ] `npm run mesh:client` / `sfu:client` show React UI in browser
- [ ] `.env.example` documents every required variable

**Exit gate:** React + Express scaffolding live; ready for Phase 1 signaling.

---

## Phase 1 — Mesh Signaling Server (Production-Quality for Lab)

**Goal:** a complete room signaling server that can sustain N≤6 peers with join/leave and directed SDP/ICE relay.

### Implement (complete)

**`mesh/server/src/rooms.js`**

- `Map<roomId, Map<peerId, { ws, joinedAt }>>`
- `addPeer`, `removePeer`, `listPeers`, `getPeer`
- Reject duplicate `peerId` in same room with explicit error message

**`mesh/server/src/index.js`**

- Express: `GET /health`, WebSocket upgrade on same port
- In production: `express.static` → `mesh/client/dist`
- Message validation (required fields per type)
- Handlers:
  - `join` → ack `joined` with existing peer list; broadcast `peer-joined`
  - `offer` / `answer` / `ice-candidate` → directed relay only
  - `leave` or socket close → `peer-left` + cleanup
- Heartbeat/ping every 30s; drop dead sockets
- Structured logs: join, leave, relay counts (stdout JSON lines OK)

**Protocol (freeze this envelope):**

```json
{ "type": "join|joined|peer-joined|peer-left|offer|answer|ice-candidate|error",
  "roomId": "project23",
  "from": "p1",
  "to": "p2",
  "payload": { } }
```

- `offer`/`answer`: `payload.sdp`
- `ice-candidate`: `payload.candidate` (RTCIceCandidateInit)
- `joined`: `payload.peers: string[]`
- `error`: `payload.message`

### Acceptance

- [ ] Two `wscat`/small test clients: join same room; both see each other
- [ ] Directed offer from A→B only B receives it
- [ ] Disconnect removes peer; others get `peer-left`
- [ ] Duplicate peerId rejected with `error`

**Exit gate:** signaling alone verified without browsers if needed; browser client next.

---

## Phase 2 — Mesh React Client (Full Audio Mesh)

**Goal:** working N-party **audio** mesh with N−1 `RTCPeerConnection`s per client — React UI + real mic or Chromium fake devices.

### Implement (complete)

**`lib/signaling.ts`**

- Connect, reconnect-once policy, send/receive typed messages
- Callbacks or small EventTarget: `onJoined`, `onPeerJoined`, `onPeerLeft`, `onOffer`, `onAnswer`, `onIce`

**`lib/mesh.ts`**

- Maintain `Map<remotePeerId, RTCPeerConnection>`
- ICE servers: empty for LAN default; optional STUN via query `?stun=1`
- **Polite peer rule:** lower `peerId` lexicographically is polite (rollback on glare) — implement fully
- On local stream ready: `addTrack` to every existing and future PC
- Trickle ICE to signaling
- Remote track registry (peerId → MediaStream) consumed by React `<audio>` / `<video>` elements
- On peer left: `pc.close()`, drop stream, delete map entry
- Join flow:
  1. `getUserMedia({ audio: true, video: false })`
  2. WS `join`
  3. Negotiate with existing peers using a documented offerer rule
  4. On `peer-joined`, negotiate with the new peer

**`lib/stats.ts` + `lib/automation.ts`**

- Aggregate `getStats()` across all PCs (bitrate deltas, RTT, jitter, loss)
- `installAutomationApi(getters)` sets `window.__webrtcReady`, `__webrtcStats`, `__meshDebug`, etc.

**`hooks/useMeshRoom.ts`**

- Owns join/leave lifecycle, local stream, remote streams, status, errors
- Polls stats every 2s for UI
- Calls `installAutomationApi` in `useEffect`

**React UI (`App.tsx` + components)**

- `JoinForm`: roomId, peerId, Join / Leave, video toggle (low-res ≤320×240 — fully wired)
- `StatusPanel`: `pcCount`, remotes, live uplink/downlink kbps, `data-testid="status"`
- `RemoteMedia`: one media element per remote peer (`autoPlay` `playsInline`)
- Error banner for gUM / WS failures
- Vite proxy: WS → `mesh/server`

### Acceptance

- [ ] **N=2** two Chrome windows: bidirectional audio
- [ ] **N=3** three windows: each has `pcCount === 2` and rising inbound bytes
- [ ] Leave cleans up; remaining peers drop to N−2 PCs
- [ ] Glare: near-simultaneous joins still connect
- [ ] `window.__webrtcStats()` returns non-zero bitrates after 5s

**Exit gate:** manual 3-party mesh audio is solid before SFU.

---

## Phase 3 — LiveKit SFU Path (Server Token + Full Client)

**Goal:** complete SFU conference equivalent to mesh UX (audio default, optional low-res video).

### Implement (complete)

**Infra**

- `scripts/start-livekit` using Docker **or** local binary:
  - `docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev`
- Document exact ports and dev key/secret in SETUP (already partially there — keep in sync)

**`sfu/server`**

- `POST /token` `{ roomName, identity }` → JWT via `AccessToken` from `livekit-server-sdk`
  - Grants: `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`
- `GET /health`
- Production: serve `sfu/client/dist`
- Read key/secret/URL from env (fail fast if missing)

**`sfu/client` (React + Vite)**

- `lib/sfuRoom.ts` + `hooks/useSfuRoom.ts`:
  - Fetch token from Express, `Room.connect(LIVEKIT_URL, token)`
  - Publish `LocalAudioTrack` (optional `LocalVideoTrack` ≤640×360)
  - Handle `TrackSubscribed` / `TrackUnsubscribed` / `ParticipantDisconnected`
  - Map remotes to React media elements; clean disconnect on Leave
- `lib/stats.ts` / `lib/automation.ts`:
  - Same field names as mesh (`uplinkBitrateBps`, etc.)
  - `window.__webrtcStats()`, `__webrtcReady`, `__sfuDebug`
- UI parity with mesh React app (shared look: JoinForm / StatusPanel / RemoteMedia patterns)
- Vite proxy: `/token` → `sfu/server`

### Acceptance

- [ ] LiveKit up; token endpoint returns valid token
- [ ] **N=3** browser tabs: mutual audio
- [ ] Stopping LiveKit breaks media (proves non-mesh path)
- [ ] `remoteCount === N-1`; stats bitrates non-zero
- [ ] Video toggle publishes/unpublishes without reconnecting unless SDK requires republish (handle correctly)

**Exit gate:** SFU 3-party matches mesh feature surface for automation.

---

## Phase 4 — Shared In-Page Automation Hooks (Hardening)

**Goal:** both clients expose a **stable automation API** used by Puppeteer — complete, not a second rewrite later.

### Implement (complete)

On both mesh and SFU pages (query-driven headless mode):

| Hook / query | Behavior |
|--------------|----------|
| `?roomId=&peerId=&autojoin=1&video=0` | Auto getUserMedia + join on load |
| `window.__webrtcReady` | `true` when joined and negotiation started |
| `window.__waitUntilConnected(nMinus1)` | Promise resolves when `remoteCount >= nMinus1` and inbound bytes increased at least once |
| `window.__webrtcStats()` | Full sample object |
| `window.__getJoinTimeMs()` | From navigation/join click to connected |
| `window.__leave()` | Full teardown |

Add a visible `data-testid="status"` reflecting `idle|joining|connected|failed`.

### Acceptance

- [ ] Manual URL with `autojoin=1` connects without clicking
- [ ] `__waitUntilConnected(2)` resolves in 3-party room
- [ ] After `__leave()`, remotes see peer departure

**Exit gate:** Puppeteer can drive pages without UI selectors beyond URL (selectors allowed as backup).

---

## Phase 5 — Puppeteer Runner + CPU Sampler (Single Run Complete)

**Goal:** one command runs N headless participants for one mode, writes a **valid schema v1 JSON** file.

### Implement (complete)

**`automation/src/launchParticipants.js`**

- Launch N Chromium instances (or N pages in separate contexts — **prefer separate browsers** for fairer CPU)
- Args:
  - `--use-fake-device-for-media-stream`
  - `--use-fake-ui-for-media-stream`
  - `--autoplay-policy=no-user-gesture-required`
  - optional `--use-file-for-fake-audio-capture=<wav>` if file provided
- Open mesh or SFU URL with `autojoin=1`
- Wait `__waitUntilConnected(N-1)` with timeout (e.g. 60s) → fail run loudly

**`cpuSampler.js`**

- Use `pidusage` on browser PIDs + optional SFU PID from env `LIVEKIT_PID` or process name discovery
- Sample on same interval as stats

**`collectStats.js`**

- Every `sampleIntervalMs` (default 2000): call `__webrtcStats()` in each page; sample CPU
- Exclude nothing yet; Phase 6 can trim ramp-up in summarizer

**`runOnce.js` CLI**

```text
node src/runOnce.js --mode mesh|sfu --n 4 --duration 90 --cap uncapped|1Mbps|5Mbps --out ../results
```

- Builds metadata per DATA_SCHEMA
- Writes `results/{mode}/n{N}-{cap}-{trial}.json`
- Always closes browsers in `finally`
- Non-zero exit on join timeout / stats failure

### Acceptance

- [ ] `runOnce --mode mesh --n 2` produces JSON that validates against schema fields
- [ ] `runOnce --mode sfu --n 3` same
- [ ] File contains ≥ (duration/interval − 1) samples per participant
- [ ] Browsers do not linger after run

**Exit gate:** single-run automation trusted for matrix.

---

## Phase 6 — Experiment Matrix + Summaries

**Goal:** full uncapped matrix N=2..6 × {mesh,sfu} and CSV/tables for the report.

### Implement (complete)

**`runMatrix.js`**

- Nested loops mode × N
- Cooldown sleep between runs
- Trial index support `--trials 3`
- Continues after one failure but records error file / exit summary
- Prints progress table to console

**`scripts/summarize-results.js`**

- Read all JSON under `results/{mesh,sfu}`
- Drop first 10s of samples (configurable) for means
- Emit `results/summary/bitrate-vs-n.csv` and print markdown tables:
  - uplink/downlink vs N
  - CPU client/SFU vs N
  - join time vs N
  - loss/jitter/RTT vs N

### Acceptance

- [ ] One matrix pass produces 10 JSON files (5 N × 2 modes) on a capable machine
- [ ] Summarizer outputs CSV without manual editing
- [ ] Mesh uplink trend rises with N; SFU uplink roughly flat (sanity check in console warnings if inverted)

**Exit gate:** uncapped dataset ready for report plots.

---

## Phase 7 — Uplink Caps (`tc`) + Failure Detection

**Goal:** complete capped experiments and automated **failure N** detection for mesh vs SFU.

### Implement (complete)

**`scripts/tc-uplink.sh`** (Linux)

- `apply <iface> <rate>` e.g. `1mbit` / `5mbit` via `tbf`
- `clear <iface>`
- `show <iface>`
- Idempotent clear-before-apply

**Automation integration**

- `--cap 1Mbps` does **not** apply `tc` from Windows blindly:
  - Document: run capped peer on Linux or WSL with iface passed as `--tc-iface eth0`
  - When `--tc-iface` set, runner shells out to `tc-uplink.sh apply` before launch and `clear` in `finally`
- Support `--capped-peer p1` (only that participant’s host is shaped — for single-laptop, document limitation: shaping NIC affects all; prefer **multi-host** note in results `notes`)

**Failure detector in summarizer**

- Implement operational rules from EXPERIMENT_PLAN:
  - sustained loss > 5%, or
  - capped peer uplink << needed mesh floor `(N-1)*25kbps`
- Write `results/summary/failure-points.md` with mesh vs SFU at 1/5 Mbps

### Acceptance

- [ ] On Linux lab host: 1 Mbps apply/show/clear works
- [ ] Capped matrix subset at least N=3,4,5 for both modes runs and saves JSON
- [ ] `failure-points.md` states smallest failing N for mesh (or “CPU-bound, inconclusive” with CPU evidence)

**Exit gate:** learning objective evidence exists in numbers.

---

## Phase 8 — Polish, Report Wiring, Optional Advanced

**Goal:** finish core course deliverable; advanced only if time.

### Core polish (complete, not cosmetic-only)

- README: exact commands for mesh, SFU, LiveKit, one-run, matrix, summarize, tc
- `docs/CHECKLIST.md` boxes checked against reality
- Fill [REPORT_TEMPLATE.md](REPORT_TEMPLATE.md) with real figures from CSV (scripts may emit plot-ready data; plots can be spreadsheet/matplotlib — if you add `scripts/plot.py`, it must generate actual PNGs, not stubs)

### Optional advanced (each is a full mini-phase if started)

| Feature | Done means |
|---------|------------|
| Simulcast | LiveKit publish encodings + one `tc`-limited subscriber shows lower layer; metrics logged |
| Active speaker | LiveKit events logged to results JSON for N=6 |
| TURN | coturn or LiveKit TURN; one cross-NAT peer joins; candidate type recorded |

Do **not** start advanced until Phase 7 acceptance passes.

---

## Cross-Phase Engineering Rules

1. **No stub merges:** if a function exists, it works in a demo path.
2. **Same stats field names** on mesh and SFU from Phase 2/3 onward.
3. **Fail loud:** timeouts and missing LiveKit throw with actionable errors.
4. **Cleanup always:** WS close, `pc.close()`, browser.close(), `tc clear` in `finally`.
5. **Do not skip gates:** Phase N+1 starts only after Phase N acceptance checkboxes are true.
6. **Audio-first:** video is optional but when present must be fully wired.
7. **Single-laptop honesty:** write `host.singleLaptop: true` and treat N=6 CPU saturation as a first-class result.

---

## Suggested Calendar (intensive)

| Phase | Focus | Est. (focused days) |
|-------|--------|---------------------|
| 0 | Scaffold | 0.5 |
| 1 | Mesh signaling | 1 |
| 2 | Mesh client + stats | 2 |
| 3 | LiveKit SFU + tokens | 1.5 |
| 4 | Automation hooks | 0.5 |
| 5 | Puppeteer runOnce | 1.5 |
| 6 | Matrix + summarize | 1 |
| 7 | tc + failure N | 1–2 |
| 8 | Report polish | 1 |

---

## Definition of Project Done

- [ ] Mesh and SFU audio conferences work manually for N≥3
- [ ] Automation produces schema-valid JSON for N=2..6 both modes
- [ ] Summaries/CSV exist; uplink scaling story is visible in data
- [ ] At least one capped series identifies mesh failure N or documents CPU limit with evidence
- [ ] README runbook reproduces the above on a clean machine
- [ ] Zero known stub modules in `mesh/`, `sfu/`, `automation/`

---

## Immediate Next Action

Start **Phase 0 + Phase 1** in one pass: npm workspaces + Vite React scaffolds + mesh signaling server, then Phase 2 `useMeshRoom` until 3-party audio passes.
