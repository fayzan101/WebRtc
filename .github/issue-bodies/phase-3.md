## Summary

Deploy LiveKit in dev mode and build the SFU React client + token API with UX parity to the mesh app.

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 3  
**Depends on:** Phase 0 (scaffold); ideally Phase 2 for UI parity  
**Stack:** `livekit-server --dev`, `livekit-server-sdk`, `livekit-client`, React + Vite.

## Scope

### Infra

- [ ] `scripts/start-livekit` (Docker or binary) documenting ports and dev key/secret

### `sfu/server`

- [ ] `POST /token` with roomJoin / canPublish / canSubscribe / canPublishData
- [ ] `GET /health`; fail fast if env missing
- [ ] Production: serve `sfu/client/dist`

### `sfu/client`

- [ ] `lib/sfuRoom.ts` + `hooks/useSfuRoom.ts` — connect, publish, subscribe, leave
- [ ] Optional video ≤640×360 fully wired
- [ ] Stats + automation hooks with **same field names as mesh**
- [ ] UI parity: JoinForm / StatusPanel / RemoteMedia
- [ ] Vite proxy `/token` → Express

## Acceptance

- [ ] Token endpoint returns valid JWT
- [ ] N=3 browser tabs: mutual audio
- [ ] Stopping LiveKit breaks media (proves non-mesh path)
- [ ] `remoteCount === N-1`; stats bitrates non-zero
- [ ] Video toggle publish/unpublish handled correctly

## Exit gate

SFU 3-party matches mesh feature surface for automation.
