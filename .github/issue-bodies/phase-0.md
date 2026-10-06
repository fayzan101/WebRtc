## Summary

Set up the npm workspaces monorepo and React + Vite scaffolds so later phases plug in without rework.

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 0  
**Rule:** Complete implementation only — no stub packages. Apps must compile and render.

## Scope

- [ ] Root `package.json` workspaces: `mesh/server`, `mesh/client`, `sfu/server`, `sfu/client`, `automation`
- [ ] Scaffold two Vite React apps (`mesh/client`, `sfu/client`) with a real `App` (title + health ping to Express)
- [ ] `.env.example` with `MESH_PORT`, `SFU_PORT`, Vite ports, LiveKit URL/key/secret
- [ ] Shared constants (default room `project23`, peer ids `p1`…`pN`)
- [ ] Root scripts: `mesh`, `mesh:client`, `sfu`, `sfu:client`, `livekit`, `matrix`
- [ ] `.gitignore`: `node_modules`, `dist`, `.env`, raw results JSON

## Acceptance

- [ ] `npm install` from root succeeds
- [ ] Express health routes return 200
- [ ] `npm run mesh:client` / `sfu:client` show React UI in browser
- [ ] `.env.example` documents every required variable

## Exit gate

React + Express scaffolding live; ready for Phase 1 signaling.
