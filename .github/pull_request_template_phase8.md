## Summary

Implements **Phase 8: Polish, report wiring** — exact README runbook, checklist aligned to the real toolchain, SVG plot generator from summary CSV, filled `docs/REPORT.md`, and `npm run verify:phase8`.

Closes #9

## Changes

- README: exact commands for mesh, SFU, LiveKit, runOnce, matrix, summarize, tc, plot, fill-report
- `automation/src/plotResults.js` — CSV parse + real SVG line charts (no stubs)
- `automation/src/reportFill.js` — fill report tables/figures from CSV (+ failure-points.md)
- `scripts/plot-results.mjs`, `fill-report.mjs`, `verify-phase8.mjs`
- `docs/CHECKLIST.md` updated against implemented phases; live experiment boxes remain for lab runs
- Unit tests for plot + report helpers

## Test plan

- [x] `npm run test -w @webrtc/automation`
- [x] `npm run verify:phase8`
- [ ] Skim `docs/REPORT.md` + `docs/figures/*.svg`
- [ ] Optional live: matrix → summarize → plot → fill-report with real `results/`
