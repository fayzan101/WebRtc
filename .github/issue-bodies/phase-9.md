## Summary

Add a **Results Dashboard** that visualizes schema-v1 experiment JSON and summary CSV (mesh vs SFU bitrate vs N, per-run time series).

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 9  
**Depends on:** DATA_SCHEMA (fixtures until Phase 5–6 produce real `results/`)

## Deliverables

- [ ] `dashboard/server` — `/api/runs`, `/api/run`, `/api/summary`
- [ ] `dashboard/client` — Overview, Compare N, Run detail (Recharts)
- [ ] Bundled fixtures + summary CSV
- [ ] Unit tests for catalog / aggregate edge cases
- [ ] `npm run dashboard` / `dashboard:client` documented in SETUP

## Exit gate

Experimenters can inspect scaling plots without opening raw JSON.
