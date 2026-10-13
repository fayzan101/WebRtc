## Summary

Implements **Phase 6: Experiment matrix N=2–6 + CSV summaries** — loop mode × N with cooldown/trials, continue-on-error, and a summarizer that drops the first ~10s ramp and emits `results/summary/bitrate-vs-n.csv` plus markdown tables and architecture sanity warnings.

Closes #7

## Changes

- `automation/src/runMatrix.js` — `--modes`, `--n`, `--trials`, `--cooldown`, `--dry-run`; unique room ids; progress table; `matrix-last.json`
- `automation/src/summarize.js` — steady-state means, CSV, markdown tables, mesh↑ / SFU-flat warnings
- `scripts/summarize-results.mjs` + `summarizeCli.js` — summarizer CLI
- Unit tests for matrix plan/execution and summarizer/CLI (no live browsers)

## Test plan

- [ ] `npm run test -w @webrtc/automation`
- [ ] `npm run matrix -- --dry-run`
- [ ] `npm run summarize -- --results dashboard/client/public/fixtures`
- [ ] (Optional live) stack up mesh/SFU clients, then:
  ```bash
  npm run matrix -- --n 2,3 --modes mesh --duration 20 --cooldown 5
  npm run summarize
  ```
