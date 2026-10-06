## Summary

Add Linux `tc` uplink capping, integrate with automation, and detect the N where mesh fails vs SFU under 1/5 Mbps caps.

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 7  
**Depends on:** Phase 6  
**Learning objective:** relate architecture to access-link bottlenecks.

## Scope

- [ ] `scripts/tc-uplink.sh` — `apply` / `clear` / `show` (tbf, idempotent)
- [ ] Runner flags `--cap`, `--tc-iface`, `--capped-peer` with `finally` clear
- [ ] Document Windows/single-laptop limitations (shape on Linux host when possible)
- [ ] Failure detector: sustained loss > 5% or uplink below mesh floor `(N-1)*25kbps`
- [ ] Write `results/summary/failure-points.md`

## Acceptance

- [ ] On Linux: apply/show/clear works for 1 Mbps and 5 Mbps
- [ ] Capped subset at least N=3,4,5 for mesh and SFU saves JSON
- [ ] `failure-points.md` states mesh failure N (or CPU-bound inconclusive with evidence)

## Exit gate

Quantitative evidence for where mesh breaks under uplink caps.
