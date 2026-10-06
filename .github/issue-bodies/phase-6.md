## Summary

Run the full uncapped experiment matrix (N=2..6 × mesh/sfu) and produce CSV/markdown summaries for the report.

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 6  
**Depends on:** Phase 5  
**Also see:** [docs/EXPERIMENT_PLAN.md](../blob/main/docs/EXPERIMENT_PLAN.md), [docs/EVALUATION.md](../blob/main/docs/EVALUATION.md)

## Scope

- [ ] `runMatrix.js` — loop mode × N; cooldown; `--trials`; continue-on-error with summary
- [ ] `scripts/summarize-results.js` — read JSON, drop first ~10s ramp, emit means
- [ ] Output `results/summary/bitrate-vs-n.csv`
- [ ] Console/markdown tables: uplink, downlink, CPU, join time, loss/jitter/RTT vs N
- [ ] Sanity warnings if mesh uplink does not rise with N / SFU uplink not roughly flat

## Acceptance

- [ ] One matrix pass produces 10 JSON files (5 N × 2 modes) on a capable machine
- [ ] Summarizer writes CSV without manual editing
- [ ] Trends match expected architecture story (or documented CPU confound)

## Exit gate

Uncapped dataset ready for report plots.
