import { mean, steadySamples } from './summarize.js';

export const LOSS_FAIL_THRESHOLD = 0.05;
/** Mesh floor: (N−1) × 25 kbps for capped peer uplink. */
export const MESH_FLOOR_KBPS_PER_PEER = 25;
/** SFU expected roughly one audio stream under a cap. */
export const SFU_MIN_UPLINK_KBPS = 15;
export const CPU_BOUND_THRESHOLD = 90;
export const STEADY_MIN_MS = 30_000;

/**
 * @param {number} n
 */
export function meshFloorKbps(n) {
  return Math.max(0, n - 1) * MESH_FLOOR_KBPS_PER_PEER;
}

/**
 * @param {number[]} values
 */
export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * @param {object} run schema-v1 document
 * @param {{ skipMs?: number }} [opts]
 */
export function evaluateRunFailure(run, opts = {}) {
  const skipMs = opts.skipMs ?? 10_000;
  const n = Number(run.n) || 0;
  const mode = run.mode;
  const cappedPeerId = run.cappedPeerId || 'p1';
  const peer =
    (run.participants ?? []).find((p) => p.peerId === cappedPeerId) ??
    (run.participants ?? [])[0];

  const samples = steadySamples(peer?.samples ?? [], skipMs);
  const lossMean = mean(samples.map((s) => Number(s.lossRatio) || 0));
  const uplinkKbpsMedian = median(
    samples.map((s) => (Number(s.uplinkBitrateBps) || 0) / 1000),
  );
  const cpuMean = mean(samples.map((s) => Number(s.cpuPercent) || 0));
  const spanMs =
    samples.length >= 2 ? samples[samples.length - 1].ts - samples[0].ts : 0;

  /** @type {string[]} */
  const reasons = [];
  let failed = false;

  if (lossMean > LOSS_FAIL_THRESHOLD) {
    failed = true;
    reasons.push(
      `mean loss ${(lossMean * 100).toFixed(1)}% > ${(LOSS_FAIL_THRESHOLD * 100).toFixed(0)}%`,
    );
  }

  if (mode === 'mesh') {
    const floor = meshFloorKbps(n);
    if (uplinkKbpsMedian + 1e-6 < floor) {
      failed = true;
      reasons.push(
        `capped peer median uplink ${uplinkKbpsMedian.toFixed(1)} kbps < mesh floor ${floor} kbps ((N-1)×${MESH_FLOOR_KBPS_PER_PEER})`,
      );
    }
  } else if (mode === 'sfu') {
    if (uplinkKbpsMedian + 1e-6 < SFU_MIN_UPLINK_KBPS) {
      failed = true;
      reasons.push(
        `capped peer median uplink ${uplinkKbpsMedian.toFixed(1)} kbps < SFU min ~${SFU_MIN_UPLINK_KBPS} kbps`,
      );
    }
  }

  const cpuBound = cpuMean >= CPU_BOUND_THRESHOLD;
  if (cpuBound) {
    reasons.push(
      `CPU-bound evidence: mean client CPU ${cpuMean.toFixed(0)}% ≥ ${CPU_BOUND_THRESHOLD}%`,
    );
  }

  const steadyEnough = spanMs >= STEADY_MIN_MS || samples.length >= 10;

  return {
    mode,
    n,
    uplinkCap: run.uplinkCap ?? 'uncapped',
    cappedPeerId,
    failed,
    cpuBound,
    steadyEnough,
    reasons,
    metrics: {
      lossMean,
      uplinkKbpsMedian,
      cpuMean,
      meshFloorKbps: mode === 'mesh' ? meshFloorKbps(n) : null,
      steadySpanMs: spanMs,
      sampleCount: samples.length,
    },
  };
}

/**
 * Smallest failing N per (mode, cap), preferring conclusive (non-CPU-only) failures.
 * @param {object[]} runs schema-v1 docs
 * @param {{ caps?: string[], skipMs?: number }} [opts]
 */
export function detectFailurePoints(runs, opts = {}) {
  const caps = opts.caps ?? ['1Mbps', '5Mbps'];
  const skipMs = opts.skipMs ?? 10_000;

  /** @type {Array<object>} */
  const evaluations = [];
  for (const run of runs) {
    if (!caps.includes(run.uplinkCap)) continue;
    evaluations.push(evaluateRunFailure(run, { skipMs }));
  }

  /** @type {Record<string, object>} */
  const points = {};
  for (const mode of ['mesh', 'sfu']) {
    for (const cap of caps) {
      const key = `${mode}:${cap}`;
      const subset = evaluations
        .filter((e) => e.mode === mode && e.uplinkCap === cap)
        .sort((a, b) => a.n - b.n);

      const firstHard = subset.find((e) => e.failed && !e.cpuBound);
      const firstAny = subset.find((e) => e.failed);
      const chosen = firstHard ?? firstAny ?? null;

      let status = 'no-failure-observed';
      if (!subset.length) status = 'no-data';
      else if (chosen?.failed && chosen.cpuBound && !firstHard) {
        status = 'cpu-bound-inconclusive';
      } else if (chosen?.failed) {
        status = 'failed';
      }

      points[key] = {
        mode,
        cap,
        status,
        failureN: chosen?.failed ? chosen.n : null,
        evaluation: chosen,
        all: subset,
      };
    }
  }

  return { evaluations, points };
}

/**
 * @param {ReturnType<typeof detectFailurePoints>} analysis
 */
export function formatFailurePointsMd(analysis) {
  const lines = [
    '# Failure points (Phase 7)',
    '',
    'Operational rules (steady state after ramp):',
    '',
    `- Mean loss > ${(LOSS_FAIL_THRESHOLD * 100).toFixed(0)}%, or`,
    `- Mesh: capped-peer median uplink < \`(N−1) × ${MESH_FLOOR_KBPS_PER_PEER} kbps\`, or`,
    `- SFU: capped-peer median uplink < ~${SFU_MIN_UPLINK_KBPS} kbps (one-stream floor)`,
    `- If mean client CPU ≥ ${CPU_BOUND_THRESHOLD}% → classify as CPU-bound / inconclusive when that is the only signal`,
    '',
    '| mode | cap | status | failure N | notes |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const key of Object.keys(analysis.points).sort()) {
    const p = analysis.points[key];
    const n = p.failureN == null ? '—' : String(p.failureN);
    const notes = p.evaluation?.reasons?.join('; ') || '—';
    lines.push(`| ${p.mode} | ${p.cap} | ${p.status} | ${n} | ${notes} |`);
  }

  lines.push('', '## Per-run detail', '');
  if (!analysis.evaluations.length) {
    lines.push('_No capped runs found under results/._', '');
    return `${lines.join('\n')}\n`;
  }

  for (const e of analysis.evaluations.sort(
    (a, b) =>
      String(a.uplinkCap).localeCompare(String(b.uplinkCap)) ||
      String(a.mode).localeCompare(String(b.mode)) ||
      a.n - b.n,
  )) {
    const flag = e.failed ? 'FAIL' : 'ok';
    lines.push(
      `- **${e.mode}** N=${e.n} \`${e.uplinkCap}\` → ${flag}` +
        ` (loss=${(e.metrics.lossMean * 100).toFixed(2)}%,` +
        ` uplinkMed=${e.metrics.uplinkKbpsMedian.toFixed(1)} kbps,` +
        ` cpu=${e.metrics.cpuMean.toFixed(0)}%)` +
        (e.reasons.length ? ` — ${e.reasons.join('; ')}` : ''),
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}
