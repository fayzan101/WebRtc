import { formatBitrate } from '../lib/automation';
import type { StatsSample } from '../lib/types';

type Props = {
  pcCount: number;
  remoteCount: number;
  stats: StatsSample | null;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

export function StatusPanel({ pcCount, remoteCount, stats }: Props) {
  return (
    <section className="glass-panel">
      <div className="panel-header">
        <h2>Live stats</h2>
        <span className="muted">getStats · 2s</span>
      </div>
      <div className="metrics-grid">
        <Metric label="Peer connections" value={String(pcCount)} />
        <Metric label="Remotes" value={String(remoteCount)} />
        <Metric
          label="Uplink"
          value={formatBitrate(stats?.uplinkBitrateBps ?? 0)}
        />
        <Metric
          label="Downlink"
          value={formatBitrate(stats?.downlinkBitrateBps ?? 0)}
        />
        <Metric label="RTT" value={`${(stats?.rttMs ?? 0).toFixed(1)} ms`} />
        <Metric label="Jitter" value={`${(stats?.jitterMs ?? 0).toFixed(1)} ms`} />
        <Metric
          label="Loss"
          value={`${((stats?.lossRatio ?? 0) * 100).toFixed(2)}%`}
        />
        <Metric
          label="Bytes in"
          value={String(stats?.bytesReceived ?? 0)}
        />
      </div>
      <p className="hint">
        Mesh uplink scales as <strong>N−1</strong> streams per client.
      </p>
    </section>
  );
}
