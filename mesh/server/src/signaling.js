import {
  errorMessage,
  joinedMessage,
  parseRawMessage,
  peerJoinedMessage,
  peerLeftMessage,
  validateClientMessage,
} from './protocol.js';

/**
 * @typedef {{
 *   rooms: import('./rooms.js').RoomRegistry,
 *   log?: (event: Record<string, unknown>) => void,
 *   now?: () => number,
 * }} SignalingDeps
 */

/**
 * Per-connection session state attached after successful join.
 * @typedef {{ roomId: string, peerId: string }} Session
 */

export class SignalingSession {
  /**
   * @param {import('ws').WebSocket} ws
   * @param {SignalingDeps} deps
   */
  constructor(ws, deps) {
    this.ws = ws;
    this.rooms = deps.rooms;
    this.log = deps.log ?? (() => {});
    this.now = deps.now ?? Date.now;
    /** @type {Session | null} */
    this.session = null;
    this.relayCount = 0;
    this.isAlive = true;
  }

  /** @param {unknown} message */
  send(message) {
    if (this.ws.readyState !== 1) return;
    this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  /** @param {unknown} raw */
  handleRaw(raw) {
    const parsed = parseRawMessage(raw);
    if (!parsed.ok) {
      this.send(errorMessage(parsed.error, this.session?.roomId ?? ''));
      return;
    }

    const validated = validateClientMessage(parsed.value);
    if (!validated.ok) {
      this.send(errorMessage(validated.error, this.session?.roomId ?? ''));
      return;
    }

    this.handleMessage(validated.message);
  }

  /** @param {object} message */
  handleMessage(message) {
    switch (message.type) {
      case 'join':
        this.handleJoin(message);
        break;
      case 'leave':
        this.handleLeave(message);
        break;
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.handleRelay(message);
        break;
      default:
        this.send(errorMessage(`unsupported type "${message.type}"`));
    }
  }

  handleJoin(message) {
    if (this.session) {
      this.send(
        errorMessage(
          `already joined as "${this.session.peerId}" in room "${this.session.roomId}"`,
          this.session.roomId,
          this.session.peerId,
        ),
      );
      return;
    }

    const existing = this.rooms.listPeers(message.roomId);
    const added = this.rooms.addPeer(message.roomId, message.from, this.ws);
    if (!added.ok) {
      this.send(errorMessage(added.error, message.roomId, message.from));
      this.log({ msg: 'join-rejected', roomId: message.roomId, peerId: message.from, error: added.error });
      return;
    }

    this.session = { roomId: message.roomId, peerId: message.from };
    this.send(joinedMessage(message.roomId, message.from, existing));
    this.rooms.broadcast(message.roomId, message.from, peerJoinedMessage(message.roomId, message.from));
    this.log({
      msg: 'join',
      roomId: message.roomId,
      peerId: message.from,
      peers: existing.length + 1,
      ts: this.now(),
    });
  }

  handleLeave(message) {
    if (!this.session) {
      this.send(errorMessage('not joined', message.roomId, message.from));
      return;
    }
    if (message.roomId !== this.session.roomId || message.from !== this.session.peerId) {
      this.send(
        errorMessage(
          'leave roomId/from must match joined session',
          this.session.roomId,
          this.session.peerId,
        ),
      );
      return;
    }
    this.depart('leave');
  }

  handleRelay(message) {
    if (!this.session) {
      this.send(errorMessage('must join before relaying', message.roomId, message.from));
      return;
    }
    if (message.roomId !== this.session.roomId || message.from !== this.session.peerId) {
      this.send(
        errorMessage(
          'relay roomId/from must match joined session',
          this.session.roomId,
          this.session.peerId,
        ),
      );
      return;
    }

    const ok = this.rooms.sendTo(message.roomId, message.to, message);
    if (!ok) {
      this.send(
        errorMessage(
          `peer "${message.to}" not found in room "${message.roomId}"`,
          message.roomId,
          message.from,
        ),
      );
      return;
    }

    this.relayCount += 1;
    this.log({
      msg: 'relay',
      type: message.type,
      roomId: message.roomId,
      from: message.from,
      to: message.to,
      relayCount: this.relayCount,
      ts: this.now(),
    });
  }

  /**
   * @param {'leave' | 'disconnect'} reason
   */
  depart(reason) {
    if (!this.session) {
      const orphan = this.rooms.removeBySocket(this.ws);
      if (orphan) {
        this.rooms.broadcast(
          orphan.roomId,
          orphan.peerId,
          peerLeftMessage(orphan.roomId, orphan.peerId),
        );
      }
      return;
    }

    const { roomId, peerId } = this.session;
    const { removed } = this.rooms.removePeer(roomId, peerId);
    this.session = null;
    if (removed) {
      this.rooms.broadcast(roomId, peerId, peerLeftMessage(roomId, peerId));
      this.log({ msg: reason, roomId, peerId, ts: this.now() });
    }
  }
}

/**
 * Attach signaling handlers to a WebSocket server.
 * @param {import('ws').WebSocketServer} wss
 * @param {SignalingDeps & { heartbeatMs?: number }} options
 */
export function attachSignaling(wss, options) {
  const heartbeatMs = options.heartbeatMs ?? 30_000;
  /** @type {Map<import('ws').WebSocket, SignalingSession>} */
  const sessions = new Map();

  wss.on('connection', (ws) => {
    const session = new SignalingSession(ws, options);
    sessions.set(ws, session);
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
      session.isAlive = true;
    });

    ws.on('message', (data) => {
      session.handleRaw(data);
    });

    ws.on('close', () => {
      session.depart('disconnect');
      sessions.delete(ws);
    });

    ws.on('error', () => {
      session.depart('disconnect');
      sessions.delete(ws);
    });
  });

  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        const session = sessions.get(ws);
        session?.depart('disconnect');
        sessions.delete(ws);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        // ignore ping failures; next tick will terminate
      }
    }
  }, heartbeatMs);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  wss.on('close', () => {
    clearInterval(interval);
  });

  return { sessions, heartbeatInterval: interval };
}
