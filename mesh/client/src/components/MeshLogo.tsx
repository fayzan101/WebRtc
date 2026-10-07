type Props = {
  size?: number;
  animated?: boolean;
  className?: string;
};

/** Inline SVG mesh of glowing nodes — peer-to-peer metaphor. */
export function MeshLogo({ size = 96, animated = true, className = '' }: Props) {
  return (
    <svg
      className={`mesh-logo ${animated ? 'is-animated' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Mesh peer network logo"
    >
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.2" />
        </radialGradient>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Edges drawn in sequence via CSS stroke-dashoffset */}
      <g className="mesh-edges" stroke="var(--accent)" strokeWidth="1.4" fill="none" opacity="0.75">
        <line className="edge e1" x1="60" y1="22" x2="92" y2="42" />
        <line className="edge e2" x1="92" y1="42" x2="82" y2="84" />
        <line className="edge e3" x1="82" y1="84" x2="38" y2="84" />
        <line className="edge e4" x1="38" y1="84" x2="28" y2="42" />
        <line className="edge e5" x1="28" y1="42" x2="60" y2="22" />
        <line className="edge e6" x1="28" y1="42" x2="82" y2="84" />
        <line className="edge e7" x1="92" y1="42" x2="38" y2="84" />
        <line className="edge e8" x1="60" y1="22" x2="60" y2="60" />
        <line className="edge e9" x1="60" y1="60" x2="38" y2="84" />
        <line className="edge e10" x1="60" y1="60" x2="82" y2="84" />
      </g>

      <g className="mesh-nodes" filter="url(#softGlow)">
        <circle className="node n1" cx="60" cy="22" r="5.5" fill="url(#nodeGlow)" />
        <circle className="node n2" cx="92" cy="42" r="5" fill="url(#nodeGlow)" />
        <circle className="node n3" cx="82" cy="84" r="5" fill="url(#nodeGlow)" />
        <circle className="node n4" cx="38" cy="84" r="5" fill="url(#nodeGlow)" />
        <circle className="node n5" cx="28" cy="42" r="5" fill="url(#nodeGlow)" />
        <circle className="node n6" cx="60" cy="60" r="6" fill="url(#nodeGlow)" />
      </g>
    </svg>
  );
}
