/**
 * In-memory room registry for mesh signaling.
 * roomId -> Map(peerId -> { ws, joinedAt })
 */
export class RoomRegistry {
  constructor() {
    /** @type {Map<string, Map<string, { ws: import('ws').WebSocket, joinedAt: number }>>} */
    this.rooms = new Map();
  }

  /**
   * @param {string} roomId
   * @param {string} peerId
   * @param {import('ws').WebSocket} ws
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  addPeer(roomId, peerId, ws) {
    if (!roomId || typeof roomId !== 'string') {
      return { ok: false, error: 'roomId is required' };
    }
    if (!peerId || typeof peerId !== 'string') {
      return { ok: false, error: 'peerId is required' };
    }
    if (!ws) {
      return { ok: false, error: 'ws is required' };
    }

    let peers = this.rooms.get(roomId);
    if (!peers) {
      peers = new Map();
      this.rooms.set(roomId, peers);
    }

    if (peers.has(peerId)) {
      return {
        ok: false,
        error: `peerId "${peerId}" already joined room "${roomId}"`,
      };
    }

    peers.set(peerId, { ws, joinedAt: Date.now() });
    return { ok: true };
  }

  /**
   * @param {string} roomId
   * @param {string} peerId
   * @returns {{ removed: boolean, roomEmpty: boolean }}
   */
  removePeer(roomId, peerId) {
    const peers = this.rooms.get(roomId);
    if (!peers || !peers.has(peerId)) {
      return { removed: false, roomEmpty: !peers || peers.size === 0 };
    }

    peers.delete(peerId);
    const roomEmpty = peers.size === 0;
    if (roomEmpty) {
      this.rooms.delete(roomId);
    }
    return { removed: true, roomEmpty };
  }

  /**
   * Remove peer by WebSocket reference (socket close / leave without ids).
   * @param {import('ws').WebSocket} ws
   * @returns {{ roomId: string, peerId: string } | null}
   */
  removeBySocket(ws) {
    for (const [roomId, peers] of this.rooms.entries()) {
      for (const [peerId, entry] of peers.entries()) {
        if (entry.ws === ws) {
          this.removePeer(roomId, peerId);
          return { roomId, peerId };
        }
      }
    }
    return null;
  }

  /**
   * @param {string} roomId
   * @param {string} peerId
   */
  getPeer(roomId, peerId) {
    return this.rooms.get(roomId)?.get(peerId) ?? null;
  }

  /**
   * @param {string} roomId
   * @param {{ excludePeerId?: string }} [opts]
   * @returns {string[]}
   */
  listPeers(roomId, opts = {}) {
    const peers = this.rooms.get(roomId);
    if (!peers) return [];
    const ids = [...peers.keys()];
    if (opts.excludePeerId) {
      return ids.filter((id) => id !== opts.excludePeerId);
    }
    return ids;
  }

  /**
   * @param {string} roomId
   * @param {string} fromPeerId
   * @param {unknown} message
   * @returns {number} number of recipients
   */
  broadcast(roomId, fromPeerId, message) {
    const peers = this.rooms.get(roomId);
    if (!peers) return 0;
    let sent = 0;
    const raw = typeof message === 'string' ? message : JSON.stringify(message);
    for (const [peerId, entry] of peers.entries()) {
      if (peerId === fromPeerId) continue;
      if (entry.ws.readyState === 1 /* OPEN */) {
        entry.ws.send(raw);
        sent += 1;
      }
    }
    return sent;
  }

  /**
   * @param {string} roomId
   * @param {string} toPeerId
   * @param {unknown} message
   * @returns {boolean}
   */
  sendTo(roomId, toPeerId, message) {
    const peer = this.getPeer(roomId, toPeerId);
    if (!peer || peer.ws.readyState !== 1) return false;
    const raw = typeof message === 'string' ? message : JSON.stringify(message);
    peer.ws.send(raw);
    return true;
  }

  roomCount() {
    return this.rooms.size;
  }

  peerCount(roomId) {
    return this.rooms.get(roomId)?.size ?? 0;
  }

  clear() {
    this.rooms.clear();
  }
}
