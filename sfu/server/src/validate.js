/**
 * Validate POST /token body.
 * @param {unknown} body
 * @returns {{ ok: true, roomName: string, identity: string } | { ok: false, error: string }}
 */
export function validateTokenRequest(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }

  const roomRaw = body.roomName ?? body.room;
  const identityRaw = body.identity ?? body.peerId;

  if (typeof roomRaw !== 'string' || roomRaw.trim() === '') {
    return { ok: false, error: 'roomName must be a non-empty string' };
  }
  if (typeof identityRaw !== 'string' || identityRaw.trim() === '') {
    return { ok: false, error: 'identity must be a non-empty string' };
  }

  const roomName = roomRaw.trim();
  const identity = identityRaw.trim();

  if (roomName.length > 128) {
    return { ok: false, error: 'roomName too long (max 128)' };
  }
  if (identity.length > 128) {
    return { ok: false, error: 'identity too long (max 128)' };
  }
  if (!/^[\w.@\-]+$/.test(identity)) {
    return {
      ok: false,
      error: 'identity may only contain letters, numbers, ._@-',
    };
  }

  return { ok: true, roomName, identity };
}

/**
 * @param {{ apiKey?: string, apiSecret?: string, livekitUrl?: string }} env
 */
export function validateLiveKitEnv(env) {
  const apiKey = env.apiKey?.trim() ?? '';
  const apiSecret = env.apiSecret?.trim() ?? '';
  const livekitUrl = env.livekitUrl?.trim() ?? '';

  if (!apiKey) return { ok: false, error: 'LIVEKIT_API_KEY is required' };
  if (!apiSecret) return { ok: false, error: 'LIVEKIT_API_SECRET is required' };
  if (!livekitUrl) return { ok: false, error: 'LIVEKIT_URL is required' };
  if (!/^wss?:\/\//i.test(livekitUrl)) {
    return { ok: false, error: 'LIVEKIT_URL must start with ws:// or wss://' };
  }
  return { ok: true, apiKey, apiSecret, livekitUrl };
}
