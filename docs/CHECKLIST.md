# Submission Checklist

Use before demo / report hand-in.

## Code

- [x] Mesh 3-party audio call works on lab LAN *(implementation complete; verify live before demo)*
- [x] SFU (LiveKit `--dev`) 3-party call works *(implementation complete; verify live before demo)*
- [x] Puppeteer can run N = 2..6 for mesh and SFU (`runOnce` / `runMatrix`)
- [x] Fake media flags documented and used (`launchParticipants` + README / SETUP)
- [x] Results written as JSON per [DATA_SCHEMA.md](DATA_SCHEMA.md)
- [x] No production secrets committed (`.env` gitignored; `.env.example` only)
- [x] README run instructions match actual scripts (`npm run verify:phase8`)

## Experiments

- [ ] Uncapped matrix N = 2..6 both modes *(run `npm run matrix` on a capable machine)*
- [ ] At least one capped series (1 Mbps); 5 Mbps preferred too *(Linux + `--tc-iface`)*
- [ ] Cap applied to **one** peer only; verified via `tc qdisc show` / `tc-uplink.sh show`
- [x] CPU sampled (client + SFU via `pidusage` / optional `LIVEKIT_PID`)
- [x] Join time recorded (`__getJoinTimeMs` → schema `joinTimeMs`)
- [x] Failure N stated with operational definition (`failureDetect` → `failure-points.md`)

## Documentation / Report

- [x] Report follows [REPORT_TEMPLATE.md](REPORT_TEMPLATE.md) structure → filled [REPORT.md](REPORT.md)
- [x] Plots: uplink/downlink/CPU vs N; loss (`npm run plot` → `docs/figures/*.svg`)
- [x] Discussion of bottleneck (link vs CPU) in REPORT.md
- [x] Limitations section (single laptop, audio-only, etc.)
- [x] How-to-run appendix works on a clean machine (README + REPORT appendix)

## Learning Objective Check

- [x] Can explain why mesh uplink scales with N−1 *(ARCHITECTURE + REPORT)*
- [x] Can explain how SFU fixes uplink but not downlink growth
- [ ] Can point to measured N where mesh breaks under 1 Mbps *(after live capped matrix)*

## Optional Advanced

- [ ] Simulcast demo
- [ ] MCU comparison notes
- [ ] Active-speaker detection
- [ ] Wireshark appendix

## Phase 8 verification

```bash
npm run verify:phase8
```

Expect: fixture-based SVGs + `docs/REPORT.md`, README command strings present, automation unit tests green.
