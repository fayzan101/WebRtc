# Experiment Plan

## Goal

Measure how **mesh** and **SFU** scale with participant count **N** and constrained **uplink**, and identify where mesh breaks relative to SFU.

## Variables

| Variable | Type | Values |
|----------|------|--------|
| `mode` | independent | `mesh`, `sfu` |
| `N` | independent | 2, 3, 4, 5, 6 |
| `uplink_cap` | independent | `none`, `1Mbps`, `5Mbps` (one participant only) |
| `media` | controlled | audio-only (default); optional low-res video |
| `duration` | controlled | 60–120 s steady state after join |
| `environment` | recorded | single laptop vs multi-host LAN |

## Constants / Controls

- Same Opus/audio constraints when possible across modes
- Same room size N and duration
- Idle machine aside from test processes
- Fake media for automated peers (repeatability)
- Cooldown 15–30 s between runs

## Test Matrix

### Core matrix (required)

| Run ID | Mode | N | Uplink cap | Media |
|--------|------|---|------------|-------|
| M2 | mesh | 2 | none | audio |
| M3 | mesh | 3 | none | audio |
| M4 | mesh | 4 | none | audio |
| M5 | mesh | 5 | none | audio |
| M6 | mesh | 6 | none | audio |
| S2 | sfu | 2 | none | audio |
| S3 | sfu | 3 | none | audio |
| S4 | sfu | 4 | none | audio |
| S5 | sfu | 5 | none | audio |
| S6 | sfu | 6 | none | audio |

Repeat **×3** if time allows; report mean ± stdev.

### Uplink-cap matrix (required)

Apply cap to **participant p1 only**.

| Run ID | Mode | N | Cap |
|--------|------|---|-----|
| M*-1M | mesh | 2..6 | 1 Mbps |
| S*-1M | sfu | 2..6 | 1 Mbps |
| M*-5M | mesh | 2..6 | 5 Mbps |
| S*-5M | sfu | 2..6 | 5 Mbps |

Priority if short on time: N = 3,4,5 at 1 Mbps first (clearest mesh vs SFU contrast).

### Optional

- Low-res video on/off at N = 4
- Simulcast + one capped receiver (see ADVANCED.md)
- Multi-laptop to reduce CPU confounding

## Procedure (Per Run)

1. Start infrastructure
   - Mesh: signaling server
   - SFU: `livekit-server --dev`
2. Apply `tc` if this run is capped; verify with `tc qdisc show`
3. Start stats/CPU logger
4. Launch N participants (Puppeteer)
5. Mark `t_join_start`; wait until each has N−1 remotes; mark `t_joined`
6. Steady-state collect for `duration` seconds (sample every 1–2 s)
7. Stop participants; stop logger; remove `tc` if applied
8. Save raw JSON under `results/`
9. Cooldown; next run

## Operational Definitions

### Join time

```text
join_time = t_joined - t_join_start
```

`t_joined`: first time remote track count ≥ N−1 **and** inbound bytes increasing.

### Failure (mesh under cap)

Declare mesh **failed** at N when **any** hold for ≥30 s steady state:

- Mean loss from capped peer’s audio to others > **5%**, or
- Median outbound audio bitrate from capped peer < **(N−1) × 25 kbps** while remotes expect that peer, or
- Subjective/automated audio dropout flag if implemented

SFU **acceptable** if loss < 5% and uplink ≈ one audio stream under same cap.

Document if **CPU ≥ ~90%** on the laptop — then classify run as CPU-limited.

## Data to Record (Metadata)

```json
{
  "schemaVersion": 1,
  "runId": "M4-1M",
  "mode": "mesh",
  "n": 4,
  "uplinkCap": "1Mbps",
  "media": "audio",
  "durationSec": 90,
  "host": {
    "os": "",
    "cpu": "",
    "singleLaptop": true
  },
  "versions": {
    "node": "",
    "chromium": "",
    "livekit": ""
  },
  "joinTimeMs": 0,
  "samples": []
}
```

## Sample Fields (Per Interval)

Per client (and SFU CPU globally):

- `ts`
- `uplinkBitrateBps`
- `downlinkBitrateBps`
- `rttMs`
- `jitterMs` (or seconds × 1000)
- `lossRatio`
- `cpuPercent`
- `remoteCount`

## Analysis Plan

1. Plot **mean uplink bitrate vs N** (mesh vs SFU)
2. Plot **mean downlink bitrate vs N**
3. Plot **CPU vs N** (client avg, SFU)
4. Plot **loss / jitter / RTT vs N** under caps
5. Table **join time vs N**
6. Annotate **failure N** for mesh at 1 Mbps and 5 Mbps

## Hypotheses

| ID | Hypothesis |
|----|------------|
| H1 | Mesh client uplink grows roughly linearly with (N−1); SFU uplink stays flat |
| H2 | Downlink grows with (N−1) in both modes |
| H3 | Under 1 Mbps uplink cap, mesh fails at smaller N than SFU |
| H4 | On one laptop, CPU may mask network differences at N≥5–6 |

## Safety / Lab Etiquette

- Remove `tc` rules after experiments
- Do not DDoS lab networks; N≤6 is intentional
- Use headphones if real mics to avoid echo (automation prefers fake media)
