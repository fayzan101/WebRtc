import { useMemo } from 'react';
import type { RunsResponse } from '../lib/api';
import { buildCompareSeries } from '../lib/aggregate';
import type { RunMeta, SummaryRow } from '../lib/types';

type Props = {
  data: RunsResponse | null;
  error: string | null;
  summaryRows: SummaryRow[] | null;
  onOpenRun: (id: string) => void;
  onGoCompare: () => void;
};

function latest(runs: RunMeta[], mode: 'mesh' | 'sfu') {
  return runs
    .filter((r) => r.mode === mode)
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.n - a.n)[0];
}

function MetricCard({
  label,
  value,
  hint,
  tone,
  icon,
  share,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: 'neutral' | 'mesh' | 'sfu' | 'live';
  icon: string;
  share?: number;
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-card-top">
        <span className="metric-icon" aria-hidden>
          {icon}
        </span>
        <span className="metric-hint">{hint}</span>
      </div>
      <strong className="metric-value tabular">{value}</strong>
      <span className="metric-label">{label}</span>
      {typeof share === 'number' && (
        <div className="metric-track" aria-hidden>
          <div className="metric-fill" style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
        </div>
      )}
    </article>
  );
}

function LatestRunCard({
  mode,
  run,
  onOpen,
}: {
  mode: 'mesh' | 'sfu';
  run: RunMeta | undefined;
  onOpen: (id: string) => void;
}) {
  const title = mode === 'mesh' ? 'Latest mesh' : 'Latest SFU';
  const blurb =
    mode === 'mesh'
      ? 'Full-mesh · uplink scales with N−1'
      : 'Selective forward · ~1 publish uplink';

  return (
    <article className={`latest-card mode-${mode}`}>
      <div className="latest-card-wash" aria-hidden />
      <div className="latest-card-head">
        <div>
          <p className="latest-kicker">{mode.toUpperCase()}</p>
          <h3>{title}</h3>
        </div>
        <span className={`mode-pill mode-${mode}`}>{mode}</span>
      </div>
      <p className="latest-blurb">{blurb}</p>

      {run ? (
        <>
          <code className="latest-id">{run.id}</code>
          <div className="meta-chips">
            <span className="chip">N={run.n}</span>
            <span className="chip">{run.uplinkCap}</span>
            <span className="chip">{run.source}</span>
            <span className="chip">trial {run.trial}</span>
          </div>
          <button type="button" className="btn primary" onClick={() => onOpen(run.id)}>
            Open run
          </button>
        </>
      ) : (
        <p className="muted empty-latest">No {mode} runs in the current filter.</p>
      )}
    </article>
  );
}

export function Overview({ data, error, summaryRows, onOpenRun, onGoCompare }: Props) {
  const insight = useMemo(() => {
    if (!summaryRows?.length) return null;
    const series = buildCompareSeries(summaryRows, 'uncapped');
    const at = [...series].reverse().find((p) => p.meshUplinkKbps != null || p.sfuUplinkKbps != null);
    if (!at) return null;
    return at;
  }, [summaryRows]);

  if (error) {
    return (
      <section className="glass-panel card-enter">
        <h2>Overview</h2>
        <p className="error-text">{error}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="glass-panel card-enter">
        <h2>Overview</h2>
        <p className="muted">Loading runs…</p>
      </section>
    );
  }

  const meshLatest = latest(data.runs, 'mesh');
  const sfuLatest = latest(data.runs, 'sfu');
  const meshShare = data.counts.total
    ? Math.round((data.counts.mesh / data.counts.total) * 100)
    : 0;

  return (
    <div className="overview-stack">
      <section className="glass-panel overview card-enter">
        <div className="panel-header">
          <div>
            <h2>Overview</h2>
            <p className="section-sub">
              Experiment inventory across mesh and SFU schema-v1 runs
            </p>
          </div>
          <span className={`source-badge ${data.fixtureOnly ? 'fixture' : 'live'}`}>
            <span className="status-dot" />
            {data.fixtureOnly ? 'Fixtures only' : 'Live results'}
          </span>
        </div>

        {data.fixtureOnly && (
          <p className="banner-hint">
            Showing bundled fixtures. Drop schema-v1 JSON into{' '}
            <code>results/mesh/</code> or <code>results/sfu/</code> — Refresh picks
            them up without a rebuild.
          </p>
        )}

        <div className="stat-cards">
          <MetricCard
            label="Total runs"
            value={data.counts.total}
            hint="catalog"
            tone="neutral"
            icon="◎"
            share={100}
          />
          <MetricCard
            label="Mesh runs"
            value={data.counts.mesh}
            hint={`${meshShare}% of catalog`}
            tone="mesh"
            icon="⬡"
            share={meshShare}
          />
          <MetricCard
            label="SFU runs"
            value={data.counts.sfu}
            hint={`${100 - meshShare}% of catalog`}
            tone="sfu"
            icon="◈"
            share={100 - meshShare}
          />
          <MetricCard
            label="From results/"
            value={data.counts.results}
            hint={data.counts.results ? 'disk live' : 'fixtures only'}
            tone={data.counts.results ? 'live' : 'neutral'}
            icon="⇩"
            share={
              data.counts.total
                ? Math.round((data.counts.results / data.counts.total) * 100)
                : 0
            }
          />
        </div>

        <div className="split-bar" aria-hidden>
          <div className="split-mesh" style={{ width: `${meshShare}%` }} />
          <div className="split-sfu" style={{ width: `${100 - meshShare}%` }} />
        </div>
        <div className="split-legend">
          <span>
            <i className="swatch mesh" /> Mesh {data.counts.mesh}
          </span>
          <span>
            <i className="swatch sfu" /> SFU {data.counts.sfu}
          </span>
        </div>
      </section>

      <section className="latest-grid card-enter card-delay-1">
        <LatestRunCard mode="mesh" run={meshLatest} onOpen={onOpenRun} />
        <LatestRunCard mode="sfu" run={sfuLatest} onOpen={onOpenRun} />
      </section>

      {insight && (
        <section className="glass-panel insight-panel card-enter card-delay-2">
          <div className="panel-header">
            <div>
              <h2>Uncapped snapshot</h2>
              <p className="section-sub">
                Mean uplink at N={insight.n} from summary CSV
              </p>
            </div>
            <button type="button" className="btn primary" onClick={onGoCompare}>
              Compare bitrate vs N
            </button>
          </div>
          <div className="insight-metrics">
            <div className="insight-metric mesh">
              <span className="stat-label">Mesh uplink</span>
              <strong className="insight-value">
                {insight.meshUplinkKbps != null
                  ? `${insight.meshUplinkKbps.toFixed(0)}`
                  : '—'}
              </strong>
              <span className="insight-unit">kbps mean</span>
            </div>
            <div className="insight-vs" aria-hidden>
              vs
            </div>
            <div className="insight-metric sfu">
              <span className="stat-label">SFU uplink</span>
              <strong className="insight-value">
                {insight.sfuUplinkKbps != null
                  ? `${insight.sfuUplinkKbps.toFixed(0)}`
                  : '—'}
              </strong>
              <span className="insight-unit">kbps mean</span>
            </div>
          </div>
          {insight.meshUplinkKbps != null &&
            insight.sfuUplinkKbps != null &&
            insight.meshUplinkKbps + insight.sfuUplinkKbps > 0 && (
              <div className="insight-ratio" aria-hidden>
                <div
                  className="insight-ratio-mesh"
                  style={{
                    width: `${(insight.meshUplinkKbps / (insight.meshUplinkKbps + insight.sfuUplinkKbps)) * 100}%`,
                  }}
                />
                <div
                  className="insight-ratio-sfu"
                  style={{
                    width: `${(insight.sfuUplinkKbps / (insight.meshUplinkKbps + insight.sfuUplinkKbps)) * 100}%`,
                  }}
                />
              </div>
            )}
        </section>
      )}
    </div>
  );
}
