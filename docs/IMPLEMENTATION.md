# Implementation Guide

Follow these steps in order. Each step has a verification gate before moving on.

---

## Step 1 — Mesh Signaling + 3-Party Audio Call

### 1.1 Signaling server (Node.js)

Implement a WebSocket room server that:

1. Accepts connections and a `join` message `{ roomId, peerId }`
2. Tracks peers per room
3. Broadcasts `peer-joined` / `peer-left`
4. Relays directed messages: `offer`, `answer`, `ice-candidate` from `from` → `to`

**Suggested relay envelope:**

```json
{
  "type": "offer",
  "roomId": "lab",
  "from": "peer-A",
  "to": "peer-B",
  "sdp": { }
}
```

### 1.2 Mesh client (browser)

For each remote peer:

1. Create `RTCPeerConnection` with optional STUN (`stun:stun.l.google.com:19302`) for non-LAN tests
2. `getUserMedia({ audio: true, video: false })` (or fake tracks in automation)
3. `addTrack` local audio on every PC
4. Perfect negotiation or simple “polite peer” rule to avoid glare
5. Trickle ICE via signaling
6. Attach remote `track` events to `<audio autoplay>` elements

**Connection count:** after join, client must have **N−1** peer connections.

### 1.3 Verify (gate)

- [ ] Two browsers: audio both ways
- [ ] Three browsers: each receives two remote audio tracks
- [ ] Leaving a peer cleans up PCs and notifies others
- [ ] Wireshark (optional): UDP between browser hosts

---

## Step 2 — LiveKit Dev SFU + Client Page

### 2.1 Run LiveKit

```bash
livekit-server --dev
# or Docker equivalent from SETUP.md
```

### 2.2 Token minting

Small Node endpoint or CLI token:

- API key/secret from LiveKit dev defaults
- Identity = participant name
- Room = shared room name
- Grants: join, publish, subscribe

### 2.3 SFU client page

Using LiveKit JS SDK:

1. `Room.connect(url, token)`
2. Create local audio track; `room.localParticipant.publishTrack(...)`
3. On `TrackSubscribed`, attach remote audio
4. Handle disconnect / participant left

Optional: low-res video checkbox (`640x360` or lower) for later runs.

### 2.4 Verify (gate)

- [ ] Three browser tabs in one room hear each other
- [ ] Only **one** publish uplink per client (observe getStats / LiveKit dashboard)
- [ ] SFU process running; media fails if SFU stopped (proves path is not mesh)

---

## Step 3 — Automate Participants (Puppeteer + Fake Media)

### 3.1 Runner responsibilities

For a given `{ mode: mesh|sfu, n, durationSec, roomId }`:

1. Launch `n` Chromium instances with fake media flags
2. Open mesh or SFU URL with query params (`?peerId=&roomId=`)
3. Wait until each page reports “joined” / remote count ≥ n−1
4. Run for fixed duration (e.g., 60–120 s)
5. Periodically evaluate `getStats()` in-page; return aggregates to Node
6. Sample CPU (optional): Node `pidusage` or OS tools for browser PIDs + SFU PID
7. Write `results/<mode>/n<N>-<timestamp>.json`

### 3.2 In-page stats hook

Expose something like `window.__webrtcStats = async () => { ... }` that:

- Mesh: iterates all `RTCPeerConnection`s; sums outbound/inbound bitrates
- SFU: uses room engine PCs or SDK stats helpers / underlying PCs

Compute bitrates from byte counter deltas over a known interval (1–2 s).

### 3.3 Verify (gate)

- [ ] `n=2` and `n=3` headless runs complete without manual UI
- [ ] JSON contains bitrate, rtt, jitter, loss fields
- [ ] Fake media: no camera permission prompts

---

## Step 4 — Collect getStats + CPU for N = 2–6 (Both Modes)

### 4.1 Matrix runner

Script `automation/run-matrix.js` (or `scripts/run-matrix.sh`) loops:

```text
for mode in mesh sfu:
  for n in 2 3 4 5 6:
    run(mode, n, duration=90s)
    sleep cooldown
```

Keep machine load otherwise idle. Record:

- Hostname, OS, CPU model, whether single-laptop
- LiveKit / Node versions
- Audio-only vs audio+video flag

### 4.2 CPU sampling

| Target | How |
|--------|-----|
| Per Chromium | Sum PID CPU% for that instance |
| SFU | `livekit-server` PID |
| Mesh signaling | Node signaling PID (usually negligible vs media) |

Align samples with stats intervals (e.g., every 2 s).

### 4.3 Verify (gate)

- [ ] 10 result files minimum (5 N × 2 modes), ideally 3 repeats each
- [ ] Plots or tables: uplink/downlink vs N (see EVALUATION.md)

---

## Step 5 — Cap One Client Uplink with `tc`; Find Mesh Failure N

### 5.1 Procedure

1. Place **one** real or VM client under `tc` egress cap (**1 Mbps**, then **5 Mbps**)
2. Other participants uncapped (headless on same LAN or laptop)
3. Run N = 2→6 for **mesh**, then **SFU**
4. Define “failure” operationally, e.g.:

   - Packet loss > 5% sustained on capped peer’s outbound or peers’ inbound from it
   - Audio score / gaps (if instrumented)
   - Outbound bitrate collapses below usable audio floor (~20–30 kbps × (N−1) needed in mesh)

5. Record smallest N where mesh fails but SFU remains acceptable

### 5.2 Expected qualitative result

- Mesh needs ~(N−1)·R uplink; hits 1 Mbps sooner than SFU’s single ~R uplink
- At 5 Mbps, mesh may survive longer; failure N increases
- If CPU saturates first on one laptop, note **CPU-bound** vs **link-bound** and retest with split machines if possible

### 5.3 Verify (gate)

- [ ] `tc` qdisc active during run
- [ ] Comparison table: mesh vs SFU under 1 Mbps and 5 Mbps
- [ ] Written statement of bottleneck (uplink vs CPU vs SFU egress)

---

## Implementation Order Summary

```text
Mesh 2p → Mesh 3p → LiveKit up → SFU 3p → Puppeteer n=2
  → Matrix N=2..6 both modes → tc 1/5 Mbps → analyze → report
```

## Coding Conventions (Suggested)

- One room id for lab: `project23`
- Peer ids: `p1` … `pN`
- Results schema version field: `"schemaVersion": 1`
- No secrets in repo; `.env` for tokens if needed (gitignored)

## Definition of Done (Implementation)

- [ ] Mesh 3-party audio verified manually
- [ ] SFU client page works against `livekit-server --dev`
- [ ] Automation supports mesh and SFU for N≤6
- [ ] Stats + CPU collected for full matrix
- [ ] Uplink-cap experiment documented with failure N (or evidence of CPU limit)
