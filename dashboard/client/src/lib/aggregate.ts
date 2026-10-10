import type { ComparePoint, Mode, RunData, Sample, SummaryRow } from './types';

/** Drop ramp-up samples (first ~10s) before means — matches Phase 6 summarizer. */
export const STEADY_STATE_SKIP_MS = 10_000;

export function steadySamples(samples: Sample[], skipMs = STEADY_STATE_SKIP_MS): Sample[] {
  if (!samples.length) return [];
  const t0 = samples[0].ts;
  const steady = samples.filter((s) => s.ts - t0 >= skipMs);
  return steady.length ? steady : samples.slice(Math.min(samples.length, 1));
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function participantMeans(samples: Sample[]) {
  const steady = steadySamples(samples);
  return {
    uplinkKbps: mean(steady.map((s) => s.uplinkBitrateBps)) / 1000,
    downlinkKbps: mean(steady.map((s) => s.downlinkBitrateBps)) / 1000,
    rttMs: mean(steady.map((s) => s.rttMs)),
    jitterMs: mean(steady.map((s) => s.jitterMs)),
    loss: mean(steady.map((s) => s.lossRatio)),
    cpu: mean(steady.map((s) => s.cpuPercent ?? 0)),
  };
}

/** Average uplink across participants for a run (lab single-laptop view). */
export function runAggregateMeans(run: RunData) {
  const parts = run.participants ?? [];
  if (!parts.length) {
    return {
      uplinkKbps: 0,
      downlinkKbps: 0,
      rttMs: 0,
      jitterMs: 0,
      loss: 0,
      cpu: 0,
    };
  }
  const per = parts.map((p) => participantMeans(p.samples ?? []));
  return {
    uplinkKbps: mean(per.map((p) => p.uplinkKbps)),
    downlinkKbps: mean(per.map((p) => p.downlinkKbps)),
    rttMs: mean(per.map((p) => p.rttMs)),
    jitterMs: mean(per.map((p) => p.jitterMs)),
    loss: mean(per.map((p) => p.loss)),
    cpu: mean(per.map((p) => p.cpu)),
  };
}

export function parseSummaryCsv(csv: string): SummaryRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

  const iMode = idx('mode');
  const iN = idx('n');
  const iCap = idx('uplinkCap');
  const iTrial = idx('trial');
  const iUp = idx('uplinkKbpsMean');
  const iDown = idx('downlinkKbpsMean');
  const iRtt = idx('rttMsMean');
  const iJit = idx('jitterMsMean');
  const iLoss = idx('lossMean');
  const iCpu = idx('cpuClientMean');
  const iSfu = idx('cpuSfuMean');
  const iJoin = idx('joinTimeMs');

  if (iMode < 0 || iN < 0 || iUp < 0) return [];

  /** @type {SummaryRow[]} */
  const rows: SummaryRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const mode = cols[iMode] as Mode;
    if (mode !== 'mesh' && mode !== 'sfu') continue;
    const n = Number(cols[iN]);
    if (!Number.isFinite(n)) continue;
    const sfuRaw = iSfu >= 0 ? cols[iSfu]?.trim() : '';
    rows.push({
      mode,
      n,
      uplinkCap: iCap >= 0 ? cols[iCap] || 'uncapped' : 'uncapped',
      trial: iTrial >= 0 ? cols[iTrial] || '001' : '001',
      uplinkKbpsMean: Number(cols[iUp]) || 0,
      downlinkKbpsMean: iDown >= 0 ? Number(cols[iDown]) || 0 : 0,
      rttMsMean: iRtt >= 0 ? Number(cols[iRtt]) || 0 : 0,
      jitterMsMean: iJit >= 0 ? Number(cols[iJit]) || 0 : 0,
      lossMean: iLoss >= 0 ? Number(cols[iLoss]) || 0 : 0,
      cpuClientMean: iCpu >= 0 ? Number(cols[iCpu]) || 0 : 0,
      cpuSfuMean: sfuRaw === '' || sfuRaw == null ? null : Number(sfuRaw) || 0,
      joinTimeMs: iJoin >= 0 ? Number(cols[iJoin]) || 0 : 0,
    });
  }
  return rows;
}

/**
 * Build mesh vs SFU uplink/downlink vs N for a given cap.
 * Averages trials when multiple rows share mode+n+cap.
 */
export function buildCompareSeries(
  rows: SummaryRow[],
  uplinkCap = 'uncapped',
): ComparePoint[] {
  const filtered = rows.filter((r) => r.uplinkCap === uplinkCap);
  const ns = [...new Set(filtered.map((r) => r.n))].sort((a, b) => a - b);

  return ns.map((n) => {
    const mesh = filtered.filter((r) => r.mode === 'mesh' && r.n === n);
    const sfu = filtered.filter((r) => r.mode === 'sfu' && r.n === n);
    return {
      n,
      meshUplinkKbps: mesh.length ? mean(mesh.map((r) => r.uplinkKbpsMean)) : null,
      sfuUplinkKbps: sfu.length ? mean(sfu.map((r) => r.uplinkKbpsMean)) : null,
      meshDownlinkKbps: mesh.length
        ? mean(mesh.map((r) => r.downlinkKbpsMean))
        : null,
      sfuDownlinkKbps: sfu.length
        ? mean(sfu.map((r) => r.downlinkKbpsMean))
        : null,
    };
  });
}

/** Align participant samples by index for charting (relative seconds). */
export function seriesForParticipant(samples: Sample[]) {
  if (!samples.length) return [];
  const t0 = samples[0].ts;
  return samples.map((s) => ({
    tSec: Math.round((s.ts - t0) / 1000),
    uplinkKbps: s.uplinkBitrateBps / 1000,
    downlinkKbps: s.downlinkBitrateBps / 1000,
    rttMs: s.rttMs,
    lossPct: s.lossRatio * 100,
    cpuPercent: s.cpuPercent ?? 0,
  }));
}
