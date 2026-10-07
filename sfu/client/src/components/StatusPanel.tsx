import { useEffect, useRef, useState } from 'react';
import { formatBitrate } from '../lib/automation';
import { formatBytes } from '../lib/peerStyle';
import type { StatsSample } from '../lib/types';

type Props = {
  pcCount: number;
  remoteCount: number;
  stats: StatsSample | null;
};

type History = {
  uplink: number[];
  downlink: number[];
  rtt: number[];
  jitter: number[];
  loss: number[];
};

const EMPTY: History = {
  uplink: [],
  downlink: [],
  rtt: [],
  jitter: [],
  loss: [],
};

function push(arr: number[], value: number, max = 30): number[] {
  const next = [...arr, value];
  return next.length > max ? next.slice(next.length - max) : next;
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  if (values.length < 2) {
    return <svg className="sparkline" viewBox="0 0 64 20" aria-hidden />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 64;
    const y = 18 - ((v - min) / span) * 16;
    return { x, y };
  });
  const line = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `M0,20 L${coords.map((p) => `${p.x},${p.y}`).join(' L')} L64,20 Z`;
  return (
    <svg className="sparkline" viewBox="0 0 64 20" aria-hidden>
      <path d={area} fill={tone} opacity="0.18" />
      <polyline
        fill="none"
        stroke={tone}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
      />
    </svg>
  );
}

function toneForRtt(ms: number) {
  if (ms < 80) return 'tone-ok';
  if (ms < 200) return 'tone-warn';
  return 'tone-bad';
}

function toneForJitter(ms: number) {
  if (ms < 15) return 'tone-ok';
  if (ms < 40) return 'tone-warn';
  return 'tone-bad';
}

function toneForLoss(ratio: number) {
  if (ratio < 0.01) return 'tone-ok';
  if (ratio < 0.05) return 'tone-warn';
  return 'tone-bad';
}

function MetricTile({
  id,
  label,
  value,
  unit,
  icon,
  history,
  toneClass = '',
}: {
  id: string;
  label: string;
  value: string;
  unit?: string;
  icon: string;
  history: number[];
  toneClass?: string;
}) {
  const sparkTone =
    toneClass === 'tone-bad'
      ? 'var(--danger)'
      : toneClass === 'tone-warn'
        ? 'var(--warning)'
        : 'var(--accent)';

  return (
    <div id={id} className={`metric-tile ${toneClass}`}>
      <div className="metric-top">
        <span className="metric-icon" aria-hidden>
          {icon}
        </span>
        <Sparkline values={history} tone={sparkTone} />
      </div>
      <div className={`metric-value tabular ${toneClass}`}>
        {value}
        {unit ? <span className="metric-unit">{unit}</span> : null}
      </div>
      <span className="metric-label">{label}</span>
    </div>
  );
}

export function StatusPanel({ pcCount, remoteCount, stats }: Props) {
  const [history, setHistory] = useState<History>(EMPTY);
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    if (!stats || stats.ts === lastTs.current) return;
    lastTs.current = stats.ts;
    setHistory((h) => ({
      uplink: push(h.uplink, stats.uplinkBitrateBps),
      downlink: push(h.downlink, stats.downlinkBitrateBps),
      rtt: push(h.rtt, stats.rttMs),
      jitter: push(h.jitter, stats.jitterMs),
      loss: push(h.loss, stats.lossRatio * 100),
    }));
  }, [stats]);

  const rtt = stats?.rttMs ?? 0;
  const jitter = stats?.jitterMs ?? 0;
  const lossPct = (stats?.lossRatio ?? 0) * 100;

  return (
    <section id="stats-card" className="glass-panel card-enter card-delay-2">
      <div className="panel-header">
        <h2>Live stats</h2>
        <span className="refresh-indicator" id="stats-refresh">
          <span className="pulse-dot" aria-hidden />
          getStats · 2s
        </span>
      </div>

      <div className="metrics-grid metrics-grid-8">
        <MetricTile
          id="stat-pc-count"
          label="Peer connections"
          value={String(pcCount)}
          icon="⇄"
          history={[pcCount]}
        />
        <MetricTile
          id="stat-remotes"
          label="Remotes"
          value={String(remoteCount)}
          icon="◉"
          history={[remoteCount]}
        />
        <MetricTile
          id="stat-uplink"
          label="Uplink"
          value={(stats ? stats.uplinkBitrateBps / 1000 : 0).toFixed(1)}
          unit="kbps"
          icon="↑"
          history={history.uplink.map((v) => v / 1000)}
        />
        <MetricTile
          id="stat-downlink"
          label="Downlink"
          value={(stats ? stats.downlinkBitrateBps / 1000 : 0).toFixed(1)}
          unit="kbps"
          icon="↓"
          history={history.downlink.map((v) => v / 1000)}
        />
        <MetricTile
          id="stat-rtt"
          label="RTT"
          value={rtt.toFixed(1)}
          unit="ms"
          icon="⏱"
          history={history.rtt}
          toneClass={toneForRtt(rtt)}
        />
        <MetricTile
          id="stat-jitter"
          label="Jitter"
          value={jitter.toFixed(1)}
          unit="ms"
          icon="∿"
          history={history.jitter}
          toneClass={toneForJitter(jitter)}
        />
        <MetricTile
          id="stat-loss"
          label="Loss"
          value={lossPct.toFixed(2)}
          unit="%"
          icon="!"
          history={history.loss}
          toneClass={toneForLoss(stats?.lossRatio ?? 0)}
        />
        <MetricTile
          id="stat-bytes-in"
          label="Bytes in"
          value={formatBytes(stats?.bytesReceived ?? 0)}
          icon="⇩"
          history={history.downlink}
        />
      </div>

      <p className="hint" id="stats-hint">
        Uplink now {formatBitrate(stats?.uplinkBitrateBps ?? 0)} · SFU keeps
        publish path ~flat vs N
      </p>
    </section>
  );
}
