# Submission Checklist

Use before demo / report hand-in.

## Code

- [ ] Mesh 3-party audio call works on lab LAN
- [ ] SFU (LiveKit `--dev`) 3-party call works
- [ ] Puppeteer can run N = 2..6 for mesh and SFU
- [ ] Fake media flags documented and used
- [ ] Results written as JSON per [DATA_SCHEMA.md](DATA_SCHEMA.md)
- [ ] No production secrets committed
- [ ] README run instructions match actual scripts

## Experiments

- [ ] Uncapped matrix N = 2..6 both modes
- [ ] At least one capped series (1 Mbps); 5 Mbps preferred too
- [ ] Cap applied to **one** peer only; verified via `tc qdisc show`
- [ ] CPU sampled (client + SFU)
- [ ] Join time recorded
- [ ] Failure N stated with operational definition

## Documentation / Report

- [ ] Report follows [REPORT_TEMPLATE.md](REPORT_TEMPLATE.md)
- [ ] Plots: uplink/downlink/CPU vs N; loss under cap
- [ ] Discussion of bottleneck (link vs CPU)
- [ ] Limitations section (single laptop, audio-only, etc.)
- [ ] How-to-run appendix works on a clean machine

## Learning Objective Check

- [ ] Can explain why mesh uplink scales with N−1
- [ ] Can explain how SFU fixes uplink but not downlink growth
- [ ] Can point to measured N where mesh breaks under 1 Mbps

## Optional Advanced

- [ ] Simulcast demo
- [ ] MCU comparison notes
- [ ] Active-speaker detection
- [ ] Wireshark appendix
