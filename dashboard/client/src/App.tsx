import { useCallback, useEffect, useState } from 'react';
import { CompareView } from './components/CompareView';
import { Filters } from './components/Filters';
import { Overview } from './components/Overview';
import { RunDetail } from './components/RunDetail';
import { fetchRuns, fetchSummary, type RunsResponse } from './lib/api';
import type { SummaryRow } from './lib/types';

type Tab = 'overview' | 'compare' | 'run';

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [mode, setMode] = useState('');
  const [n, setN] = useState('');
  const [cap, setCap] = useState('');
  const [compareCap, setCompareCap] = useState('uncapped');
  const [runsData, setRunsData] = useState<RunsResponse | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[] | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setRunsError(null);
    try {
      const data = await fetchRuns({
        mode: mode || undefined,
        n: n ? Number(n) : undefined,
        cap: cap || undefined,
      });
      setRunsData(data);
      setSelectedRun((prev) => {
        if (prev && data.runs.some((r) => r.id === prev)) return prev;
        return data.runs[0]?.id ?? null;
      });
    } catch (err) {
      setRunsData(null);
      setRunsError(err instanceof Error ? err.message : String(err));
    }
  }, [mode, n, cap]);

  const loadSummary = useCallback(async () => {
    setSummaryError(null);
    try {
      const data = await fetchSummary();
      setSummaryRows(data.rows);
    } catch (err) {
      setSummaryRows(null);
      setSummaryError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const refreshAll = () => {
    void loadRuns();
    void loadSummary();
  };

  return (
    <div className="app-shell app-ready">
      <div className="ambient ambient-a" aria-hidden />
      <div className="ambient ambient-b" aria-hidden />
      <div className="grid-veil" aria-hidden />

      <header className="topbar glass-panel card-enter">
        <div className="topbar-brand">
          <div className="logo-mark" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="title-row">
              <h1>Results</h1>
              <span className="n1-chip">Dashboard</span>
            </div>
            <p className="subtitle">Mesh vs SFU experiment runs · Project 23</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn ghost" onClick={refreshAll}>
            Refresh
          </button>
        </div>
      </header>

      <div className="chrome-row card-enter card-delay-1">
        <nav className="tabs glass-panel" aria-label="Dashboard sections">
          {(
            [
              ['overview', 'Overview'],
              ['compare', 'Compare N'],
              ['run', 'Run detail'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {(tab === 'overview' || tab === 'run') && (
          <div className="filters-shell glass-panel">
            <Filters
              mode={mode}
              n={n}
              cap={cap}
              onMode={setMode}
              onN={setN}
              onCap={setCap}
            />
          </div>
        )}
      </div>

      <main className="dash-main">
        {tab === 'overview' && (
          <Overview
            data={runsData}
            error={runsError}
            summaryRows={summaryRows}
            onOpenRun={(id) => {
              setSelectedRun(id);
              setTab('run');
            }}
            onGoCompare={() => setTab('compare')}
          />
        )}
        {tab === 'compare' && (
          <CompareView
            rows={summaryRows}
            error={summaryError}
            cap={compareCap}
            onCap={setCompareCap}
          />
        )}
        {tab === 'run' && (
          <RunDetail
            runs={runsData?.runs ?? []}
            selectedId={selectedRun}
            onSelect={setSelectedRun}
          />
        )}
      </main>
    </div>
  );
}
