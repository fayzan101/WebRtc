/**
 * Default Vite origin for a mode.
 * @param {'mesh'|'sfu'} mode
 * @param {NodeJS.ProcessEnv} [env]
 */
export function defaultBaseUrl(mode, env = process.env) {
  if (mode === 'mesh') {
    const port = env.MESH_VITE_PORT || '5173';
    return `http://127.0.0.1:${port}/`;
  }
  if (mode === 'sfu') {
    const port = env.SFU_VITE_PORT || '5174';
    return `http://127.0.0.1:${port}/`;
  }
  throw new Error(`Unknown mode: ${mode}`);
}

/**
 * Build autojoin participant URL (Phase 4 contract).
 * @param {{ baseUrl: string, roomId: string, peerId: string, video?: 0|1 }} opts
 */
export function participantUrl({ baseUrl, roomId, peerId, video = 0 }) {
  if (!baseUrl) throw new Error('baseUrl is required');
  if (!roomId?.trim()) throw new Error('roomId is required');
  if (!peerId?.trim()) throw new Error('peerId is required');

  const url = new URL(baseUrl);
  url.searchParams.set('roomId', roomId.trim());
  url.searchParams.set('peerId', peerId.trim());
  url.searchParams.set('autojoin', '1');
  url.searchParams.set('video', String(video));
  return url.toString();
}
