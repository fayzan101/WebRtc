## Summary

Implements **Phase 7: tc uplink caps + mesh failure-N detection** — Linux `tc-uplink.sh` helper, runner `--tc-iface` / `--capped-peer` integration (clear in `finally`), and summarizer output `results/summary/failure-points.md` using EXPERIMENT_PLAN failure rules.

Closes #8

## Changes

- `scripts/tc-uplink.sh` — `apply` / `clear` / `show` (TBF, idempotent clear-before-apply)
- `automation/src/tcUplink.js` — Node wrapper; `--cap` alone does not shape without `--tc-iface`
- `runOnce` / `runMatrix` — apply before launch, clear in `finally`; notes single-host NIC limitation
- `failureDetect.js` — loss > 5%, mesh floor `(N−1)×25 kbps`, SFU min uplink, CPU-bound inconclusive
- Summarizer writes `failure-points.md` alongside CSV
- Unit tests for tc helper, failure detector, runner tc lifecycle

## Test plan

- [ ] `npm run test -w @webrtc/automation`
- [ ] (Linux) `sudo ./scripts/tc-uplink.sh apply eth0 1mbit` → `show` → `clear`
- [ ] `npm run run-once -- --mode mesh --n 3 --cap 1Mbps --tc-iface eth0 --duration 20`
- [ ] `npm run matrix -- --cap 1Mbps --n 3,4,5 --tc-iface eth0 --duration 20 --cooldown 5`
- [ ] `npm run summarize` → check `results/summary/failure-points.md`
