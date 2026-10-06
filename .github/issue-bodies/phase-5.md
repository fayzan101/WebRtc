## Summary

Build a complete Puppeteer single-run harness that launches N headless participants and writes schema v1 JSON (including CPU samples).

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 5  
**Depends on:** Phase 4  
**Schema:** [docs/DATA_SCHEMA.md](../blob/main/docs/DATA_SCHEMA.md)

## Scope

- [ ] `launchParticipants.js` — N Chromium instances, fake media flags, autojoin URLs
- [ ] Wait `__waitUntilConnected(N-1)` with loud timeout failure
- [ ] `cpuSampler.js` — `pidusage` on browser PIDs (+ optional LiveKit PID)
- [ ] `collectStats.js` — interval samples via `__webrtcStats()`
- [ ] `runOnce.js` CLI:

```text
node src/runOnce.js --mode mesh|sfu --n 4 --duration 90 --cap uncapped|1Mbps|5Mbps --out ../results
```

- [ ] Write `results/{mode}/n{N}-{cap}-{trial}.json`
- [ ] Always close browsers in `finally`

## Acceptance

- [ ] `runOnce --mode mesh --n 2` → valid schema JSON
- [ ] `runOnce --mode sfu --n 3` → valid schema JSON
- [ ] Enough samples for duration/interval
- [ ] No lingering browser processes after run

## Exit gate

Single-run automation trusted for the full matrix (Phase 6).
