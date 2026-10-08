## Summary

Implements **Phase 4: Shared in-page automation hooks** — harden the Puppeteer contract on mesh + SFU clients with live `__webrtcReady`, shared `waitUntilConnected` semantics, `data-status` on `[data-testid="status"]`, and unit tests for edge cases.

Closes #<issue>

## Changes

- `createWaitUntilConnected` — validates `nMinus1`, timeout / failed / byte-growth / `n=0` paths
- `installAutomationApi` — `__webrtcReady` is a **live getter** (not a stale boolean snapshot)
- `shouldAutojoin` — requires `autojoin=1` **and** room + peer (supports `roomName` / `identity` aliases)
- JoinForm: `data-testid="status"` + `data-status={idle|joining|connected|failed}`
- Shared constants: `AUTOMATION_HOOKS`, `AUTOMATION_STATUS_*` in `@webrtc/shared`
- Unit tests: wait helper + install/uninstall + query/autojoin edge cases (mesh + SFU)

## Test plan

- [ ] `npm run test -w @webrtc/mesh-client`
- [ ] `npm run test -w @webrtc/sfu-client`
- [ ] `npm run build:clients`
- [ ] Mesh: open `http://localhost:5173/?roomId=lab&peerId=p1&autojoin=1&video=0` — connects without click; `[data-testid=status]` has `data-status="connected"`; `window.__webrtcReady === true`
- [ ] Two tabs same room → `__waitUntilConnected(1)` resolves
- [ ] `__leave()` returns to idle; remote sees departure
- [ ] SFU same hooks via `http://localhost:5174/?roomId=lab&peerId=p1&autojoin=1&video=0` (+ LiveKit + token server)
