## Summary

Implements **Phase 9: Results Dashboard** — Vite + React UI over schema-v1 experiment JSON / summary CSV, with a small Express API that merges `results/` and bundled fixtures.

Closes #<issue>

## Changes

- `dashboard/server` — `GET /api/runs`, `/api/run`, `/api/summary` (results preferred over fixtures)
- `dashboard/client` — Overview, Compare N (mesh vs SFU), Run detail (time series)
- Fixtures: mesh/sfu × N=2,4,6 uncapped + `summary/bitrate-vs-n.csv`
- Aggregate helpers + unit tests (CSV parse, steady-state skip, compare series)
- Root scripts: `npm run dashboard` / `dashboard:client` · ports `5180` / `5181`

## Test plan

- [ ] `npm run test -w @webrtc/dashboard-server`
- [ ] `npm run test -w @webrtc/dashboard-client`
- [ ] `npm run build -w @webrtc/dashboard-client`
- [ ] `npm run dashboard` + `npm run dashboard:client` → Overview shows fixture runs
- [ ] Compare N shows mesh vs SFU uplink/downlink curves
- [ ] Run detail charts bitrate / RTT / loss / CPU for a selected participant
- [ ] Copy a JSON into `results/mesh/` → Refresh lists it with `source: results`
