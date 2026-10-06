# UI Mockups — Obsidian Glass + Blue Steel

Visual targets for the full app surface (tabs, call states, results, advanced).  
**Theme:** obsidian (`#0B0F14`), frosted glass, **blue steel** (`#4A7FB5` / `#2F5F8A`).

## App shell & navigation

| File | Screen |
|------|--------|
| [app-home-shell.jpg](app-home-shell.jpg) | Home + top tabs (Mesh / SFU / Automation / Results / Advanced) |

## Mesh Call

| File | Screen |
|------|--------|
| [mesh-health-scaffold.jpg](mesh-health-scaffold.jpg) | Phase 0 health ping |
| [mesh-join.jpg](mesh-join.jpg) | Idle / join form |
| [mesh-joining.jpg](mesh-joining.jpg) | Connecting steps (mic → WS → negotiate) |
| [mesh-connected-audio.jpg](mesh-connected-audio.jpg) | In-call audio + stats |
| [mesh-connected-video.jpg](mesh-connected-video.jpg) | In-call low-res video |
| [mesh-error.jpg](mesh-error.jpg) | gUM / WebSocket failure |

## SFU Call

| File | Screen |
|------|--------|
| [sfu-health-scaffold.jpg](sfu-health-scaffold.jpg) | Phase 0 health ping |
| [sfu-join.jpg](sfu-join.jpg) | Idle / join via LiveKit |
| [sfu-connected.jpg](sfu-connected.jpg) | In-call audio + SFU CPU |
| [sfu-connected-video.jpg](sfu-connected-video.jpg) | In-call video |
| [sfu-error.jpg](sfu-error.jpg) | LiveKit / connect failure |

## Automation

| File | Screen |
|------|--------|
| [automation-runner.jpg](automation-runner.jpg) | Single run (mode / N / cap / logs) |
| [automation-matrix-complete.jpg](automation-matrix-complete.jpg) | Full matrix N=2–6 complete + export |

## Results

| File | Screen |
|------|--------|
| [results-dashboard.jpg](results-dashboard.jpg) | Bitrate vs N (sub-tab) |
| [results-cpu-join.jpg](results-cpu-join.jpg) | CPU & join time (sub-tab) |
| [results-uplink-cap.jpg](results-uplink-cap.jpg) | Uplink caps / failure-N (sub-tab) |

## Advanced & settings

| File | Screen |
|------|--------|
| [advanced-simulcast.jpg](advanced-simulcast.jpg) | Simulcast layers per receiver |
| [advanced-active-speaker.jpg](advanced-active-speaker.jpg) | Active-speaker highlight + event log |
| [settings-ice-turn.jpg](settings-ice-turn.jpg) | STUN/TURN toggles + ICE candidates |

## Design tokens

```css
--bg: #0B0F14;
--glass: rgba(18, 26, 36, 0.72);
--glass-border: rgba(148, 180, 220, 0.22);
--text: #E8EEF5;
--muted: #9BB4CC;
--steel: #4A7FB5;
--steel-deep: #2F5F8A;
```
