import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ComparePoint, SummaryRow } from '../lib/types';
import { buildCompareSeries } from '../lib/aggregate';

type Props = {
  rows: SummaryRow[] | null;
  error: string | null;
  cap: string;
  onCap: (v: string) => void;
};

export function CompareView({ rows, error, cap, onCap }: Props) {
  const effectiveCap = cap || 'uncapped';
  const series: ComparePoint[] = rows
    ? buildCompareSeries(rows, effectiveCap)
    : [];

  return (
    <section className="glass-panel compare card-enter">
      <div className="panel-header">
        <div>
          <h2>Compare N</h2>
          <p className="section-sub">Mean uplink / downlink from summary CSV</p>
        </div>
        <label className="inline-filter">
          <span>Cap</span>
          <select value={effectiveCap} onChange={(e) => onCap(e.target.value)}>
            <option value="uncapped">uncapped</option>
            <option value="1Mbps">1Mbps</option>
            <option value="5Mbps">5Mbps</option>
          </select>
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!error && !rows && <p className="muted">Loading summary…</p>}
      {rows && series.length === 0 && (
        <p className="muted">No summary rows for cap “{effectiveCap}”.</p>
      )}

      {series.length > 0 && (
        <>
          <div className="chart-block">
            <h3>Mean uplink (kbps) vs N</h3>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={series}>
                  <CartesianGrid stroke="rgba(148,180,220,0.12)" />
                  <XAxis dataKey="n" stroke="#9bb4cc" />
                  <YAxis stroke="#9bb4cc" />
                  <Tooltip
                    contentStyle={{
                      background: '#121a24',
                      border: '1px solid rgba(148,180,220,0.25)',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="meshUplinkKbps"
                    name="Mesh uplink"
                    stroke="#5b9fd4"
                    strokeWidth={2}
                    connectNulls
                    dot
                  />
                  <Line
                    type="monotone"
                    dataKey="sfuUplinkKbps"
                    name="SFU uplink"
                    stroke="#3ecf8e"
                    strokeWidth={2}
                    connectNulls
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-block">
            <h3>Mean downlink (kbps) vs N</h3>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={series}>
                  <CartesianGrid stroke="rgba(148,180,220,0.12)" />
                  <XAxis dataKey="n" stroke="#9bb4cc" />
                  <YAxis stroke="#9bb4cc" />
                  <Tooltip
                    contentStyle={{
                      background: '#121a24',
                      border: '1px solid rgba(148,180,220,0.25)',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="meshDownlinkKbps"
                    name="Mesh downlink"
                    stroke="#e0b45a"
                    strokeWidth={2}
                    connectNulls
                    dot
                  />
                  <Line
                    type="monotone"
                    dataKey="sfuDownlinkKbps"
                    name="SFU downlink"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    connectNulls
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
