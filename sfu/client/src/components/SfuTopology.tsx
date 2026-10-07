import { peerHue } from '../lib/peerStyle';

type Props = {
  localPeerId: string;
  remotePeerIds: string[];
  videoEnabled: boolean;
  connected: boolean;
};

type Point = { id: string; x: number; y: number; hub?: boolean };

export function SfuTopology({
  localPeerId,
  remotePeerIds,
  videoEnabled,
  connected,
}: Props) {
  const clients = connected
    ? [localPeerId, ...remotePeerIds.filter((id) => id !== localPeerId)]
    : [];
  const n = clients.length;

  const W = 320;
  const H = 168;
  const cx = W / 2;
  const cy = H / 2 - 2;
  const r = n <= 1 ? 52 : 58;

  const hub: Point = { id: 'SFU', x: cx, y: cy, hub: true };
  const leaves: Point[] = clients.map((id, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 1);
    return {
      id,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  return (
    <section id="topology-card" className="glass-panel topology-panel card-enter card-delay-4">
      <div className="panel-header topology-header">
        <h2>SFU topology</h2>
        <span className="count-badge" id="topology-link-count">
          {n} uplink{n === 1 ? '' : 's'}
        </span>
      </div>

      <div className="topology-body">
        <div className="topology-diagram" aria-hidden={!connected}>
          <svg viewBox={`0 0 ${W} ${H}`} className="topology-svg" role="img" aria-label="SFU star graph">
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
                  Join to map SFU
                </text>
              </>
            ) : (
              <>
                {leaves.map((p, idx) => (
                  <line
                    key={`e-${p.id}`}
                    x1={hub.x}
                    y1={hub.y}
                    x2={p.x}
                    y2={p.y}
                    className="topology-edge"
                    style={{ animationDelay: `${idx * 0.08}s` }}
                  />
                ))}
                <g filter="url(#topo-glow)">
                  <rect
                    x={hub.x - 22}
                    y={hub.y - 14}
                    width="44"
                    height="28"
                    rx="8"
                    fill="hsla(205, 55%, 22%, 0.95)"
                    stroke="hsla(205, 70%, 62%, 0.95)"
                    strokeWidth="2"
                  />
                  <text x={hub.x} y={hub.y + 4} textAnchor="middle" className="topology-node-label">
                    SFU
                  </text>
                </g>
                {leaves.map((p) => {
                  const hue = peerHue(p.id);
                  return (
                    <g key={p.id} className="topology-node" filter="url(#topo-glow)">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={14}
                        fill={`hsla(${hue}, 50%, 22%, 0.95)`}
                        stroke={`hsla(${hue}, 70%, 62%, 0.95)`}
                        strokeWidth="1.8"
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
            {n < 1 ? (
              <>
                Selective forwarding: each client publishes <strong>one</strong> uplink
                to the SFU. Downlink scales with subscribers, not full mesh.
              </>
            ) : (
              <>
                {`Star topology via LiveKit — ${n} client${n === 1 ? '' : 's'}, each with `}
                <strong>1 uplink</strong>
                {` to the SFU (vs mesh N−1 = ${Math.max(0, n - 1)}).`}
              </>
            )}
          </p>
          <div className="topology-tags" id="topology-tags">
            <span className="topo-tag">audio</span>
            <span className="topo-tag">
              {videoEnabled ? 'video ≤640×360' : 'audio-only'}
            </span>
            <span className="topo-tag">SFU</span>
            <span className="topo-tag">LiveKit</span>
          </div>
        </div>
      </div>
    </section>
  );
}
