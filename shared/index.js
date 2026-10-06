/** Shared lab constants for mesh, SFU, and automation. */

export const DEFAULT_ROOM_ID = 'project23';

/** Peer id pattern: p1 … pN */
export function peerIdForIndex(index) {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error(`peer index must be integer >= 1, got ${index}`);
  }
  return `p${index}`;
}

export function peerIdsForN(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`n must be integer >= 1, got ${n}`);
  }
  return Array.from({ length: n }, (_, i) => peerIdForIndex(i + 1));
}

export const SCHEMA_VERSION = 1;
