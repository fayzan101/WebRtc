/** Deterministic accent hue for a peer id (avoids flat grey tiles). */
export function peerHue(peerId: string): number {
  let h = 0;
  for (let i = 0; i < peerId.length; i += 1) {
    h = (h * 33 + peerId.charCodeAt(i)) % 360;
  }
  return (h % 280) + 10;
}

export function peerGradient(peerId: string): string {
  const h = peerHue(peerId);
  return `radial-gradient(ellipse 80% 70% at 50% 35%, hsla(${h}, 55%, 42%, 0.55), transparent 65%),
    linear-gradient(160deg, hsl(${h}, 35%, 18%), #0c121a 70%)`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
