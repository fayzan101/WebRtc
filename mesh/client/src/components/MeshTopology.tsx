import { peerHue } from '../lib/peerStyle';

type Props = {
  localPeerId: string;
  remotePeerIds: string[];
  videoEnabled: boolean;
  connected: boolean;
};

type Point = { id: string; x: number; y: number; local: boolean };

function layoutPeers(ids: string[], cx: number, cy: number, r: number): Point[] {
  const n = ids.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: ids[0], x: cx, y: cy, local: true }];
  return ids.map((id, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      id,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      local: i === 0,
    };
  });
}

export function MeshTopology({
  localPeerId,
  remotePeerIds,
  videoEnabled,
  connected,
}: Props) {
  const peerIds = connected
    ? [localPeerId, ...remotePeerIds.filter((id) => id !== localPeerId)]
    : [];
  const n = peerIds.length;
  const links = n < 2 ? 0 : (n * (n - 1)) / 2;
  const outbound = Math.max(0, n - 1);

  const W = 320;
  const H = 168;
  const cx = W / 2;
  const cy = H / 2 - 4;
  const radius = n <= 1 ? 0 : n === 2 ? 58 : n === 3 ? 54 : 62;
  const points = layoutPeers(peerIds, cx, cy, radius);

  const edges: Array<[Point, Point]> = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      edges.push([points[i], points[j]]);
    }
  }

  return (
    <section id="topology-card" className="glass-panel topology-panel card-enter card-delay-4">
      <div className="panel-header topology-header">
        <h2>Full-mesh topology</h2>
        <span className="count-badge" id="topology-link-count">
          {links} link{links === 1 ? '' : 's'}
        </span>
      </div>

      <div className="topology-body">
        <div className="topology-diagram" aria-hidden={!connected}>
          <svg viewBox={`0 0 ${W} ${H}`} className="topology-svg" role="img" aria-label="Mesh peer graph">
            <defs>
              <filter id="topo-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {!connected || n === 0 ? (
              <>
                <circle cx={cx} cy={cy} r="36" fill="none" stroke="var(--border)" strokeDasharray="4 6" />
                <text x={cx} y={cy + 4} textAnchor="middle" className="topology-empty-label">
                  Join to map peers
                </text>
              </>
            ) : (
              <>
                {edges.map(([a, b], idx) => (
                  <line
                    key={`e-${a.id}-${b.id}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className="topology-edge"
                    style={{ animationDelay: `${idx * 0.08}s` }}
                  />
                ))}
                {points.map((p) => {
                  const hue = peerHue(p.id);
                  return (
                    <g key={p.id} className="topology-node" filter="url(#topo-glow)">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={p.local ? 16 : 14}
                        fill={`hsla(${hue}, 50%, 22%, 0.95)`}
                        stroke={`hsla(${hue}, 70%, 62%, 0.95)`}
                        strokeWidth={p.local ? 2.4 : 1.8}
                      />
                      <text
                        x={p.x}
                        y={p.y + 4}
                        textAnchor="middle"
                        className="topology-node-label"
                      >
                        {p.id.length > 6 ? p.id.slice(0, 5) : p.id}
                      </text>
                    </g>
                  );
                })}
              </>
            )}
          </svg>
        </div>

        <div className="topology-copy">
          <p id="topology-explain">
            {n < 2 ? (
              <>
                Full-mesh grows as <strong>N(N−1)/2</strong> P2P links. Each client
                publishes <strong>N−1</strong> streams — uplink scales with every join.
              </>
            ) : (
              <>
                <strong>{`${links} P2P link${links === 1 ? '' : 's'}`}</strong>
                {` across ${n} peer${n === 1 ? '' : 's'}. Each client sends `}
                <strong>{`N−1 = ${outbound}`}</strong>
                {` outbound stream${outbound === 1 ? '' : 's'}, so uplink grows with every participant.`}
              </>
            )}
          </p>
          <div className="topology-tags" id="topology-tags">
            <span className="topo-tag">audio</span>
            <span className="topo-tag">
              {videoEnabled ? 'video 320×240' : 'audio-only'}
            </span>
            <span className="topo-tag">P2P</span>
            <span className="topo-tag">UDP</span>
          </div>
        </div>
      </div>
    </section>
  );
}
