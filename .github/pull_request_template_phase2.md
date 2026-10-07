## Summary

Implements **Phase 2: Mesh React client** — full N−1 `RTCPeerConnection` audio mesh (optional low-res video), polite glare handling, live `getStats`, automation hooks, and an **obsidian glass + blue steel** UI.

Closes #3

## What changed

- `mesh/client/src/lib/signaling.ts` — WebSocket client, reconnect-once, typed handlers
- `mesh/client/src/lib/mesh.ts` — mesh engine, trickle ICE, polite negotiation, video toggle
- `mesh/client/src/lib/stats.ts` + `automation.ts` — bitrate/RTT/jitter/loss + `window.__webrtc*`
- `mesh/client/src/hooks/useMeshRoom.ts` — join/leave lifecycle, 2s stats poll, autojoin query
- UI: `JoinForm`, `StatusPanel`, `RemoteMedia`, `ErrorBanner` + obsidian glass theme
- Unit tests (vitest) for polite rules, stats math, query/ICE helpers

## UI theme

Obsidian `#0B0F14`, frosted glass panels, blue steel `#4A7FB5` / `#2F5F8A` accents (matches mockups).

## Test plan

- [ ] `npm install`
- [ ] `npm run test:mesh-client`
- [ ] `npm run build -w @webrtc/mesh-client`
- [ ] Terminal A: `npm run mesh`
- [ ] Terminal B: `npm run mesh:client`
- [ ] Open two windows (`p1` / `p2`, same room) — bidirectional audio
- [ ] Third window `p3` — each shows `pcCount === 2`
- [ ] Leave one peer — others drop a PC
- [ ] `window.__webrtcStats()` after ~5s shows non-zero bitrates
- [ ] Optional: `?autojoin=1&roomId=project23&peerId=p1`

## Notes

- Depends on Phase 1 signaling (`ws://…/ws`) from branch/PR for #2
- No commit included from the agent — push this branch after your commit
