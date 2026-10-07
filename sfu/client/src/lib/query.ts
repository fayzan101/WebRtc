export function readQueryDefaults(search: string) {
  const params = new URLSearchParams(search);
  return {
    roomId: params.get('roomId') ?? params.get('roomName') ?? '',
    peerId: params.get('peerId') ?? params.get('identity') ?? '',
    autojoin: params.get('autojoin') === '1',
    video: params.get('video') === '1',
  };
}
