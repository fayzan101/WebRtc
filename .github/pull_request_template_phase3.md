## Summary

Implements **Phase 3: LiveKit SFU** — token API, SFU React client (obsidian glass UI parity with mesh), stats/automation hooks, and unit/integration tests.

Closes #4

## What changed

### Server (`sfu/server`)
- `POST /token` — LiveKit JWT (`roomJoin`, publish, subscribe, data)
- `GET /health` — `phase: 3`, `tokenApi: true`
- Validation helpers + fail-fast when LiveKit env missing (503)
- Tests: validate, token JWT shape, HTTP integration

### Client (`sfu/client`)
- LiveKit `Room.connect` + publish audio / optional ≤640×360 video
- Subscribe remotes, leave/cleanup
- Same stats field names as mesh + `window.__webrtc*` / `__sfuDebug`
- Full-viewport UI, splash (skipped on `?autojoin=1`), theme swatches
- Vitest unit tests for query/stats/splash gate

### Docs / tree
- Carries `docs/SERVER_SIDE_EXPLAINED.md` and index/README links from prior working tree

## Test plan

- [ ] `npm install`
- [ ] `npm run test:sfu-server` and `npm run test:sfu-client`
- [ ] `npm run build -w @webrtc/sfu-client`
- [ ] `npm run livekit` (Docker or binary `--dev`)
- [ ] `npm run sfu` + `npm run sfu:client`
- [ ] `POST /token` with `{ "roomName":"project23","identity":"p1" }` returns JWT
- [ ] 2–3 browser tabs mutual audio
- [ ] Stop LiveKit → media fails (not mesh)
- [ ] `?autojoin=1&roomId=project23&peerId=p1` joins without splash

## Notes

- Requires LiveKit env: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (`.env.example` defaults for `--dev`)
- Agent does not commit; push branch after your commit
