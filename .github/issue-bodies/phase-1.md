## Summary

Build a complete mesh WebSocket signaling server that supports N≤6 peers with join/leave and directed SDP/ICE relay.

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 1  
**Depends on:** Phase 0  
**Rule:** No stubs — real room registry, validation, heartbeat, and cleanup.

## Scope

### `mesh/server/src/rooms.js`

- [ ] `Map<roomId, Map<peerId, { ws, joinedAt }>>`
- [ ] `addPeer`, `removePeer`, `listPeers`, `getPeer`
- [ ] Reject duplicate `peerId` in same room with explicit error

### `mesh/server/src/index.js`

- [ ] `GET /health`, WebSocket upgrade on same port
- [ ] Production: serve `mesh/client/dist`
- [ ] Handlers: `join` / `joined` / `peer-joined` / `peer-left` / `offer` / `answer` / `ice-candidate` / `error`
- [ ] Directed relay only for offer/answer/ICE
- [ ] Heartbeat/ping every 30s; drop dead sockets
- [ ] Structured logs (join, leave, relay counts)

### Protocol envelope (frozen)

```json
{
  "type": "join|joined|peer-joined|peer-left|offer|answer|ice-candidate|error",
  "roomId": "project23",
  "from": "p1",
  "to": "p2",
  "payload": {}
}
```

## Acceptance

- [ ] Two test clients join same room and see each other
- [ ] Directed offer A→B is received only by B
- [ ] Disconnect removes peer; others get `peer-left`
- [ ] Duplicate peerId rejected with `error`

## Exit gate

Signaling verified; ready for Phase 2 React mesh client.
