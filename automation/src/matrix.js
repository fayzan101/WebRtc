import { peerIdsForN, DEFAULT_ROOM_ID, SCHEMA_VERSION } from '@webrtc/shared';

/**
 * Phase 0 entrypoint for `npm run matrix`.
 * Full Puppeteer matrix lands in Phase 6 — this validates shared contracts
 * and prints the planned run grid so the workspace script is real today.
 */
const modes = ['mesh', 'sfu'];
const ns = [2, 3, 4, 5, 6];

console.log(JSON.stringify({
  msg: 'automation matrix scaffold',
  phase: 0,
  schemaVersion: SCHEMA_VERSION,
  defaultRoomId: DEFAULT_ROOM_ID,
  plannedRuns: modes.flatMap((mode) =>
    ns.map((n) => ({
      mode,
      n,
      peers: peerIdsForN(n),
      status: 'pending-phase-6',
    })),
  ),
  next: 'Implement Puppeteer runOnce (Phase 5) then runMatrix (Phase 6).',
}, null, 2));
