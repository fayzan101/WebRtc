import { useEffect, useMemo, useState } from 'react';
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
import { fetchRun } from '../lib/api';
import { runAggregateMeans, seriesForParticipant } from '../lib/aggregate';
import type { RunData, RunMeta } from '../lib/types';

type Props = {
  runs: RunMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function RunDetail({ runs, selectedId, onSelect }: Props) {
  const [run, setRun] = useState<RunData | null>(null);
  const [source, setSource] = useState<'results' | 'fixture' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setRun(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchRun(selectedId)
      .then((res) => {
        if (cancelled) return;
        setRun(res.data);
        setSource(res.source);
        setPeerId(res.data.participants?.[0]?.peerId ?? '');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setRun(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const participant = run?.participants?.find((p) => p.peerId === peerId);
  const series = useMemo(
    () => seriesForParticipant(participant?.samples ?? []),
    [participant],
  );
  const means = run ? runAggregateMeans(run) : null;

  return (
    <section className="glass-panel run-detail card-enter">
      <div className="panel-header">
        <div>
          <h2>Run detail</h2>
          <p className="section-sub">Participant time series for one schema-v1 run</p>
        </div>
        <select
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="Select run"
        >
          <option value="" disabled>
            Select a run…
          </option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} ({r.source})
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">Loading run…</p>}
      {error && <p className="error-text">{error}</p>}

      {run && (
        <>
          <div className="meta-chips">
            <span className="chip">{run.mode}</span>
            <span className="chip">N={run.n}</span>
            <span className="chip">{run.uplinkCap}</span>
            <span className="chip">join {run.joinTimeMs ?? '—'} ms</span>
            <span className="chip">{source}</span>
            {run.runId ? <span className="chip">{run.runId}</span> : null}
          </div>

          {means && (
            <div className="stat-cards compact">
              <article className="stat-card">
                <span className="stat-label">Uplink mean</span>
                <strong className="stat-value">{means.uplinkKbps.toFixed(1)} kbps</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">Downlink mean</span>
                <strong className="stat-value">{means.downlinkKbps.toFixed(1)} kbps</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">RTT mean</span>
                <strong className="stat-value">{means.rttMs.toFixed(1)} ms</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">Loss mean</span>
                <strong className="stat-value">{(means.loss * 100).toFixed(2)}%</strong>
              </article>
            </div>
          )}

          <label className="inline-filter">
            <span>Participant</span>
            <select value={peerId} onChange={(e) => setPeerId(e.target.value)}>
              {(run.participants ?? []).map((p) => (
                <option key={p.peerId} value={p.peerId}>
                  {p.peerId}
                  {p.role ? ` (${p.role})` : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="chart-block">
            <h3>Bitrate over time</h3>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series}>
                  <CartesianGrid stroke="rgba(148,180,220,0.12)" />
                  <XAxis dataKey="tSec" stroke="#9bb4cc" unit="s" />
                  <YAxis stroke="#9bb4cc" />
                  <Tooltip
                    contentStyle={{
                      background: '#121a24',
                      border: '1px solid rgba(148,180,220,0.25)',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="uplinkKbps" name="Uplink kbps" stroke="#5b9fd4" dot={false} />
                  <Line type="monotone" dataKey="downlinkKbps" name="Downlink kbps" stroke="#3ecf8e" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-block">
            <h3>RTT / loss / CPU</h3>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series}>
                  <CartesianGrid stroke="rgba(148,180,220,0.12)" />
                  <XAxis dataKey="tSec" stroke="#9bb4cc" unit="s" />
                  <YAxis stroke="#9bb4cc" />
                  <Tooltip
                    contentStyle={{
                      background: '#121a24',
                      border: '1px solid rgba(148,180,220,0.25)',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="rttMs" name="RTT ms" stroke="#e0b45a" dot={false} />
                  <Line type="monotone" dataKey="lossPct" name="Loss %" stroke="#f07178" dot={false} />
                  <Line type="monotone" dataKey="cpuPercent" name="CPU %" stroke="#a78bfa" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
