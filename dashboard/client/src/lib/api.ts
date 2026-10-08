import type { RunData, RunMeta, SummaryRow } from './types';
import { parseSummaryCsv } from './aggregate';

export type RunsResponse = {
  runs: RunMeta[];
  counts: {
    total: number;
    mesh: number;
    sfu: number;
    results: number;
    fixtures: number;
  };
  fixtureOnly: boolean;
};

export async function fetchRuns(params?: {
  mode?: string;
  n?: number;
  cap?: string;
}): Promise<RunsResponse> {
  const q = new URLSearchParams();
  if (params?.mode) q.set('mode', params.mode);
  if (params?.n != null) q.set('n', String(params.n));
  if (params?.cap) q.set('cap', params.cap);
  const res = await fetch(`/api/runs?${q}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `runs failed (${res.status})`);
  }
  return (await res.json()) as RunsResponse;
}

export async function fetchRun(id: string): Promise<{
  id: string;
  source: 'results' | 'fixture';
  data: RunData;
}> {
  const res = await fetch(`/api/run?id=${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `run failed (${res.status})`);
  }
  return (await res.json()) as { id: string; source: 'results' | 'fixture'; data: RunData };
}

export async function fetchSummary(): Promise<{
  source: 'results' | 'fixture';
  rows: SummaryRow[];
}> {
  const res = await fetch('/api/summary');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `summary failed (${res.status})`);
  }
  const body = (await res.json()) as { source: 'results' | 'fixture'; csv: string };
  return { source: body.source, rows: parseSummaryCsv(body.csv) };
}
