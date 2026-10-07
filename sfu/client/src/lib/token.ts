export type TokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
};

export async function fetchRoomToken(
  roomName: string,
  identity: string,
  endpoint = '/token',
): Promise<TokenResponse> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomName, identity }),
  });

  const text = await res.text();
  let body: {
    token?: string;
    url?: string;
    roomName?: string;
    identity?: string;
    error?: string;
  } = {};
  try {
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    throw new Error(
      `token endpoint returned non-JSON (HTTP ${res.status}). Is the SFU server running and Vite proxy SFU_PORT correct?`,
    );
  }

  if (!res.ok) {
    throw new Error(body.error || `token request failed (HTTP ${res.status})`);
  }
  if (!body.token || !body.url) {
    throw new Error('token response missing token or url');
  }

  return {
    token: body.token,
    url: body.url,
    roomName: body.roomName ?? roomName,
    identity: body.identity ?? identity,
  };
}
