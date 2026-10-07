export const MESSAGE_TYPES = Object.freeze([
  'join',
  'joined',
  'peer-joined',
  'peer-left',
  'offer',
  'answer',
  'ice-candidate',
  'leave',
  'error',
]);

const CLIENT_TYPES = new Set(['join', 'offer', 'answer', 'ice-candidate', 'leave']);
const DIRECTED_TYPES = new Set(['offer', 'answer', 'ice-candidate']);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse raw WebSocket data into a JSON object.
 * @param {unknown} raw
 * @returns {{ ok: true, value: unknown } | { ok: false, error: string }}
 */
export function parseRawMessage(raw) {
  if (raw == null) {
    return { ok: false, error: 'empty message' };
  }

  let text;
  if (typeof raw === 'string') {
    text = raw;
  } else if (Buffer.isBuffer(raw)) {
    text = raw.toString('utf8');
  } else if (raw instanceof ArrayBuffer) {
    text = Buffer.from(raw).toString('utf8');
  } else if (ArrayBuffer.isView(raw)) {
    text = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8');
  } else {
    return { ok: false, error: 'unsupported message format' };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'empty message' };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
}

/**
 * Validate a client→server signaling envelope.
 * @param {unknown} msg
 * @returns {{ ok: true, message: object } | { ok: false, error: string }}
 */
export function validateClientMessage(msg) {
  if (!isObject(msg)) {
    return { ok: false, error: 'message must be a JSON object' };
  }

  const type = msg.type;
  if (typeof type !== 'string' || !CLIENT_TYPES.has(type)) {
    return {
      ok: false,
      error: `unsupported type "${String(type)}"; expected join|offer|answer|ice-candidate|leave`,
    };
  }

  if (typeof msg.roomId !== 'string' || msg.roomId.trim() === '') {
    return { ok: false, error: 'roomId must be a non-empty string' };
  }

  if (typeof msg.from !== 'string' || msg.from.trim() === '') {
    return { ok: false, error: 'from must be a non-empty string' };
  }

  const roomId = msg.roomId.trim();
  const from = msg.from.trim();

  if (type === 'join') {
    return {
      ok: true,
      message: {
        type: 'join',
        roomId,
        from,
        payload: isObject(msg.payload) ? msg.payload : {},
      },
    };
  }

  if (type === 'leave') {
    return {
      ok: true,
      message: {
        type: 'leave',
        roomId,
        from,
        payload: isObject(msg.payload) ? msg.payload : {},
      },
    };
  }

  if (DIRECTED_TYPES.has(type)) {
    if (typeof msg.to !== 'string' || msg.to.trim() === '') {
      return { ok: false, error: 'to must be a non-empty string' };
    }
    const to = msg.to.trim();
    if (to === from) {
      return { ok: false, error: 'to must differ from from' };
    }

    if (!isObject(msg.payload)) {
      return { ok: false, error: 'payload must be an object' };
    }

    if (type === 'offer' || type === 'answer') {
      if (typeof msg.payload.sdp !== 'string' || msg.payload.sdp.trim() === '') {
        return { ok: false, error: `${type} payload.sdp must be a non-empty string` };
      }
      return {
        ok: true,
        message: {
          type,
          roomId,
          from,
          to,
          payload: { sdp: msg.payload.sdp },
        },
      };
    }

    // ice-candidate — candidate may be null (end-of-candidates)
    if (!('candidate' in msg.payload)) {
      return { ok: false, error: 'ice-candidate payload.candidate is required (may be null)' };
    }
    const candidate = msg.payload.candidate;
    if (candidate !== null && !isObject(candidate) && typeof candidate !== 'string') {
      return {
        ok: false,
        error: 'ice-candidate payload.candidate must be object, string, or null',
      };
    }
    return {
      ok: true,
      message: {
        type: 'ice-candidate',
        roomId,
        from,
        to,
        payload: { candidate },
      },
    };
  }

  return { ok: false, error: `unhandled type "${type}"` };
}

/**
 * @param {string} message
 * @param {string} [roomId]
 * @param {string} [from]
 */
export function errorMessage(message, roomId = '', from = 'server') {
  return {
    type: 'error',
    roomId,
    from,
    payload: { message },
  };
}

export function joinedMessage(roomId, from, peers) {
  return {
    type: 'joined',
    roomId,
    from: 'server',
    to: from,
    payload: { peers },
  };
}

export function peerJoinedMessage(roomId, peerId) {
  return {
    type: 'peer-joined',
    roomId,
    from: peerId,
    payload: { peerId },
  };
}

export function peerLeftMessage(roomId, peerId) {
  return {
    type: 'peer-left',
    roomId,
    from: peerId,
    payload: { peerId },
  };
}
