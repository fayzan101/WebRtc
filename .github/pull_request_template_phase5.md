## Summary

Implements **Phase 5: Puppeteer runOnce + CPU sampler** — launch N headless Chromium participants, wait on Phase 4 automation hooks, sample `__webrtcStats()` + process CPU, and write schema-v1 JSON under `results/{mode}/`.

Closes #6

## Changes

- `launchParticipants.js` — N separate browsers, fake-media flags, `__waitUntilConnected(N-1)`
- `cpuSampler.js` — `pidusage` on browser PIDs (+ optional `LIVEKIT_PID` / `SFU_PID`)
- `collectStats.js` — interval sampling loop with join-time capture
- `runOnce.js` CLI — `--mode --n --duration --cap --out …`, always closes browsers in `finally`
- Pure helpers: `parseArgs`, `urls`, `paths`, `schema` (+ validate / expected sample count)
- Unit tests with mocked Puppeteer / pidusage / filesystem (no live browsers required)

## Test plan

- [ ] `npm run test -w @webrtc/automation`
- [ ] `npm test` (full workspace)
- [ ] Stack up mesh (or SFU + LiveKit) clients, then:
  ```bash
  npm run run-once -w @webrtc/automation -- --mode mesh --n 2 --duration 20 --cap uncapped
  ```
- [ ] Confirm `results/mesh/n2-uncapped-001.json` validates schema fields and has enough samples
- [ ] Confirm no Chromium processes linger after the run
