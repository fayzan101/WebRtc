## Summary

Implement the full React mesh client: N−1 `RTCPeerConnection`s per participant, polite glare handling, live stats, and UI.

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 2  
**Depends on:** Phase 1  
**Stack:** React 18 + Vite + TypeScript; logic in hooks/libs, not JSX-only.

## Scope

- [ ] `lib/signaling.ts` — WS client, reconnect-once, typed callbacks
- [ ] `lib/mesh.ts` — PC map, trickle ICE, polite peer rule, track registry
- [ ] `lib/stats.ts` — aggregate getStats (bitrate deltas, RTT, jitter, loss)
- [ ] `lib/automation.ts` — `installAutomationApi` → `window.__webrtc*`
- [ ] `hooks/useMeshRoom.ts` — join/leave lifecycle, poll stats every 2s
- [ ] UI: `JoinForm`, `StatusPanel` (`data-testid="status"`), `RemoteMedia`
- [ ] Optional low-res video toggle fully wired (≤320×240)
- [ ] Vite proxy WS → mesh server

## Acceptance

- [ ] N=2: bidirectional audio
- [ ] N=3: each client `pcCount === 2`, rising inbound bytes
- [ ] Leave cleans up; remotes drop to N−2 PCs
- [ ] Near-simultaneous joins still connect (glare / polite rule)
- [ ] `window.__webrtcStats()` non-zero bitrates after ~5s

## Exit gate

Manual 3-party mesh audio solid before SFU (Phase 3).
