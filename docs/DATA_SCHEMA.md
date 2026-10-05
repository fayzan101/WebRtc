# Results Data Schema

Machine-readable contract for automation output. Bump `schemaVersion` when fields break.

## File Naming

```text
results/{mode}/n{N}-{cap}-{trial}.json

mode:  mesh | sfu
N:     2..6
cap:   uncapped | 1Mbps | 5Mbps
trial: 001, 002, ...
```

Example: `results/mesh/n4-1Mbps-002.json`

## Top-Level Object

```json
{
  "schemaVersion": 1,
  "runId": "M4-1M",
  "mode": "mesh",
  "n": 4,
  "uplinkCap": "1Mbps",
  "cappedPeerId": "p1",
  "media": "audio",
  "durationSec": 90,
  "sampleIntervalMs": 2000,
  "startedAt": "2026-10-05T08:00:00.000Z",
  "endedAt": "2026-10-05T08:01:45.000Z",
  "joinTimeMs": 1840,
  "host": {
    "os": "linux",
    "arch": "x64",
    "cpuModel": "",
    "singleLaptop": true
  },
  "versions": {
    "node": "20.x",
    "chromium": "",
    "livekitServer": "",
    "livekitClient": ""
  },
  "participants": [
    {
      "peerId": "p1",
      "role": "capped",
      "samples": []
    }
  ],
  "sfu": {
    "pid": 0,
    "samples": [{ "ts": 0, "cpuPercent": 0 }]
  },
  "notes": ""
}
```

## Participant Sample Object

```json
{
  "ts": 1720000000123,
  "remoteCount": 3,
  "uplinkBitrateBps": 48000,
  "downlinkBitrateBps": 140000,
  "rttMs": 12.5,
  "jitterMs": 4.2,
  "lossRatio": 0.01,
  "cpuPercent": 35.0,
  "bytesSent": 123456,
  "bytesReceived": 654321
}
```

## Field Definitions

| Field | Unit | Meaning |
|-------|------|---------|
| `uplinkBitrateBps` | bit/s | Send rate over last interval |
| `downlinkBitrateBps` | bit/s | Receive rate sum over remotes |
| `rttMs` | ms | Selected pair RTT |
| `jitterMs` | ms | Inbound jitter |
| `lossRatio` | 0..1 | Interval loss fraction |
| `cpuPercent` | % | Process CPU (document basis) |
| `joinTimeMs` | ms | Join start → fully connected |

## Summary CSV

`results/summary/bitrate-vs-n.csv`:

```text
mode,n,uplinkCap,trial,uplinkKbpsMean,downlinkKbpsMean,rttMsMean,jitterMsMean,lossMean,cpuClientMean,cpuSfuMean,joinTimeMs
```

Means are over steady-state samples (exclude first 5–10 s after join if still ramping).
