## Summary

Polish the runbook and report wiring. Optional advanced features only after Phase 7 passes.

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 8  
**Depends on:** Phase 7  
**Also see:** [docs/REPORT_TEMPLATE.md](../blob/main/docs/REPORT_TEMPLATE.md), [docs/ADVANCED.md](../blob/main/docs/ADVANCED.md), [docs/CHECKLIST.md](../blob/main/docs/CHECKLIST.md)

## Core polish (required)

- [ ] README: exact commands for mesh, SFU, LiveKit, runOnce, matrix, summarize, tc
- [ ] Checklist verified against real runs
- [ ] Report template filled with real figures from CSV (plots must be real if scripted)

## Optional advanced (full mini-features if started — no stubs)

- [ ] Simulcast + one bandwidth-limited subscriber with logged layer/bitrate
- [ ] Active-speaker events logged for N=6 SFU
- [ ] TURN / cross-NAT peer with recorded candidate types

## Acceptance

- [ ] Clean-machine runbook reproduces core POC
- [ ] Zero known stub modules in `mesh/`, `sfu/`, `automation/`
- [ ] Project done criteria from IMPLEMENTATION_PLAN satisfied

## Exit gate

Course deliverable complete; advanced only if time remains.
