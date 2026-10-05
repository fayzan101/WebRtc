# Evaluation Metrics and Analysis

## Metrics Overview

| Metric | Why it matters | Primary source |
|--------|----------------|----------------|
| Uplink bitrate / client | Shows mesh O(N) vs SFU O(1) send cost | `outbound-rtp` |
| Downlink bitrate / client | Shows receive scaling ~(N−1) in both | `inbound-rtp` |
| RTT | Congestion / path delay | `candidate-pair` / RTCP |
| Jitter | Playback stability | `inbound-rtp.jitter` |
| Packet loss | Hard quality cliff | `inbound-rtp` packetsLost |
| CPU (client) | Encode fan-out (mesh) | OS process sampler |
| CPU (SFU) | Forwarding cost | SFU process |
| Join time | Signaling / negotiation overhead | App timestamps |

## Collecting getStats()

### Bitrate from counters

For each stats report of type `outbound-rtp` / `inbound-rtp`:

```text
bitrate_bps = 8 * (bytes_now - bytes_prev) / (t_now - t_prev)
```

Aggregate:

- **Mesh uplink:** sum of all PCs’ `outbound-rtp` (audio)
- **Mesh downlink:** sum of all PCs’ `inbound-rtp` (audio)
- **SFU:** same on the single publisher/subscriber connections

### RTT

Prefer selected ICE candidate pair:

- `currentRoundTripTime` (seconds → ms)

### Jitter

- `inbound-rtp.jitter` (seconds in the spec) → convert to ms for plots

### Loss

```text
lossRatio = packetsLost_delta / (packetsReceived_delta + packetsLost_delta)
```

Use deltas over the sample window, not lifetime totals alone when comparing intervals.

## CPU Measurement

| Process | Notes |
|---------|-------|
| Each Chromium | One participant ≈ one browser process tree; sample carefully |
| `livekit-server` | SFU CPU |
| Node signaling | Usually small; still log for completeness |

Report **percent of one core** or **overall %** consistently; state which.

## Expected Trends (Audio-Only Idealized)

```text
Uplink (kbps) vs N
  Mesh:  ~ rising slope
  SFU:   ~ flat

Downlink (kbps) vs N
  Mesh:  ~ rising
  SFU:   ~ rising (similar order)

CPU client vs N
  Mesh:  rising (N−1 encodes/sends)
  SFU:   flatter

CPU SFU vs N
  rising with fan-out
```

## Pass / Fail Against Learning Objective

You successfully meet the learning objective if the report shows:

1. Quantitative evidence that **mesh uplink ∝ (N−1)** and **SFU uplink ≈ constant**
2. Identification of the **bottleneck link** under `tc` (access uplink)
3. Clear statement of **N where mesh breaks** at 1 Mbps (and 5 Mbps if measured)
4. Discussion of **CPU vs network** limits on single-laptop runs

## Results Directory Layout

```text
results/
  mesh/
    n2-uncapped-001.json
    n4-1Mbps-001.json
    ...
  sfu/
    n2-uncapped-001.json
    ...
  summary/
    bitrate-vs-n.csv
    cpu-vs-n.csv
    failure-points.md
```

## Summary CSV Columns (Suggested)

```text
mode,n,uplinkCap,trial,uplinkKbpsMean,downlinkKbpsMean,rttMsMean,jitterMsMean,lossMean,cpuClientMean,cpuSfuMean,joinTimeMs
```

## Plot Checklist (Report)

1. Uplink bitrate vs N (mesh vs SFU) — uncapped
2. Downlink bitrate vs N — uncapped
3. Client CPU vs N — both modes
4. SFU CPU vs N
5. Loss vs N under 1 Mbps cap (mesh vs SFU)
6. Join time vs N

## Interpreting Confounds

| Observation | Likely cause |
|-------------|--------------|
| Mesh uplink flat but CPU 100% | Encoder/CPU bound; not a fair link test |
| Both modes fail equally under cap | Cap applied wrong (ingress vs egress) or shared laptop shaping all |
| SFU downlink much higher than mesh | Different codec/bitrate settings — align constraints |
| Huge join time mesh at N=6 | Serialization of many offer/answer exchanges |

## Wireshark Spot Checks (Optional Evidence)

- Mesh: multiple UDP 5-tuples between browser IPs
- SFU: client UDP primarily to SFU host
- Signaling: TCP WebSocket to signaling/LiveKit port
