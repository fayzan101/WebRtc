import { AccessToken } from 'livekit-server-sdk';

/**
 * Mint a LiveKit room join JWT.
 * @param {{
 *   apiKey: string,
 *   apiSecret: string,
 *   roomName: string,
 *   identity: string,
 *   ttl?: string,
 * }} opts
 * @returns {Promise<string>}
 */
export async function createRoomToken(opts) {
  const { apiKey, apiSecret, roomName, identity, ttl = '2h' } = opts;

  if (!apiKey || !apiSecret) {
    throw new Error('apiKey and apiSecret are required');
  }
  if (!roomName || !identity) {
    throw new Error('roomName and identity are required');
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}
