import fs from 'node:fs';
import path from 'node:path';

/** Drop ramp-up samples (first ~10s) before means — Phase 6. */
export const STEADY_STATE_SKIP_MS = 10_000;

export const SUMMARY_CSV_HEADER = [
  'mode',
  'n',
  'uplinkCap',
  'trial',
  'uplinkKbpsMean',
  'downlinkKbpsMean',
  'rttMsMean',
  'jitterMsMean',
  'lossMean',
  'cpuClientMean',
  'cpuSfuMean',
  'joinTimeMs',
];

/**
 * @param {number[]} values
 */
export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @param {Array<{ ts: number }>} samples
 * @param {number} [skipMs]
 */
export function steadySamples(samples, skipMs = STEADY_STATE_SKIP_MS) {
  if (!samples?.length) return [];
  const t0 = samples[0].ts;
  const steady = samples.filter((s) => s.ts - t0 >= skipMs);
  return steady.length ? steady : samples.slice(0, Math.min(samples.length, 1));
}

/**
 * @param {Array<Record<string, number>>} samples
 * @param {number} [skipMs]
 */
export function participantMeans(samples, skipMs = STEADY_STATE_SKIP_MS) {
  const steady = steadySamples(samples, skipMs);
  return {
    uplinkKbps: mean(steady.map((s) => Number(s.uplinkBitrateBps) || 0)) / 1000,
    downlinkKbps: mean(steady.map((s) => Number(s.downlinkBitrateBps) || 0)) / 1000,
    rttMs: mean(steady.map((s) => Number(s.rttMs) || 0)),
    jitterMs: mean(steady.map((s) => Number(s.jitterMs) || 0)),
    loss: mean(steady.map((s) => Number(s.lossRatio) || 0)),
    cpu: mean(steady.map((s) => Number(s.cpuPercent) || 0)),
  };
}

/**
 * @param {object} run schema-v1 document
 * @param {number} [skipMs]
 */
export function aggregateRun(run, skipMs = STEADY_STATE_SKIP_MS) {
  const parts = run.participants ?? [];
  const per = parts.map((p) => participantMeans(p.samples ?? [], skipMs));
  const sfuSamples = run.sfu?.samples ?? [];
  const sfuSteady = steadySamples(sfuSamples, skipMs);
  const cpuSfu =
    sfuSteady.length > 0 ? mean(sfuSteady.map((s) => Number(s.cpuPercent) || 0)) : null;

  const trial =
    typeof run.trial === 'string'
      ? run.trial
      : inferTrialFromNotes(run.notes) ?? '001';

  return {
    mode: run.mode,
    n: run.n,
    uplinkCap: run.uplinkCap ?? 'uncapped',
    trial,
    uplinkKbpsMean: per.length ? mean(per.map((p) => p.uplinkKbps)) : 0,
    downlinkKbpsMean: per.length ? mean(per.map((p) => p.downlinkKbps)) : 0,
    rttMsMean: per.length ? mean(per.map((p) => p.rttMs)) : 0,
    jitterMsMean: per.length ? mean(per.map((p) => p.jitterMs)) : 0,
    lossMean: per.length ? mean(per.map((p) => p.loss)) : 0,
    cpuClientMean: per.length ? mean(per.map((p) => p.cpu)) : 0,
    cpuSfuMean: cpuSfu,
    joinTimeMs: Number(run.joinTimeMs) || 0,
  };
}

/**
 * @param {string|undefined} notes
 */
function inferTrialFromNotes(notes) {
  if (!notes) return null;
  const m = /trial\s+(\d{3})/i.exec(notes);
  return m ? m[1] : null;
}

/**
 * Infer trial from filename `n4-uncapped-002.json`.
 * @param {string} fileName
 */
export function trialFromFileName(fileName) {
  const m = /n\d+-[^-]+-(\d{3})\.json$/i.exec(fileName);
  return m ? m[1] : '001';
}

/**
 * Load schema-v1 JSON files from results/{mesh,sfu}/.
 * @param {string} resultsDir
 * @param {{ readdirSync?: typeof fs.readdirSync, readFileSync?: typeof fs.readFileSync, modes?: string[] }} [fsApi]
 */
export function loadRunDocuments(resultsDir, fsApi = {}) {
  const readdirSync = fsApi.readdirSync ?? fs.readdirSync;
  const readFileSync = fsApi.readFileSync ?? fs.readFileSync;
  const modes = fsApi.modes ?? ['mesh', 'sfu'];
  /** @type {object[]} */
  const docs = [];

  for (const mode of modes) {
    const dir = path.join(resultsDir, mode);
    let names = [];
    try {
      names = readdirSync(dir);
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') continue;
      throw err;
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const raw = readFileSync(path.join(dir, name), 'utf8');
      const doc = JSON.parse(raw);
      if (!doc.trial) doc.trial = trialFromFileName(name);
      docs.push(doc);
    }
  }
  return docs;
}

/**
 * @param {object[]} docs
 * @param {number} [skipMs]
 */
export function summarizeRuns(docs, skipMs = STEADY_STATE_SKIP_MS) {
  return docs
    .filter((d) => d && (d.mode === 'mesh' || d.mode === 'sfu'))
    .map((d) => aggregateRun(d, skipMs))
    .sort((a, b) => {
      if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
      if (a.uplinkCap !== b.uplinkCap) return String(a.uplinkCap).localeCompare(String(b.uplinkCap));
      if (a.n !== b.n) return a.n - b.n;
      return String(a.trial).localeCompare(String(b.trial));
    });
}

/**
 * @param {ReturnType<typeof aggregateRun>[]} rows
 */
export function rowsToCsv(rows) {
  const lines = [SUMMARY_CSV_HEADER.join(',')];
  for (const r of rows) {
    const sfu =
      r.cpuSfuMean == null || Number.isNaN(r.cpuSfuMean) ? '' : formatNum(r.cpuSfuMean, 2);
    lines.push(
      [
        r.mode,
        r.n,
        r.uplinkCap,
        r.trial,
        formatNum(r.uplinkKbpsMean, 2),
        formatNum(r.downlinkKbpsMean, 2),
        formatNum(r.rttMsMean, 2),
        formatNum(r.jitterMsMean, 2),
        formatNum(r.lossMean, 4),
        formatNum(r.cpuClientMean, 2),
        sfu,
        Math.round(r.joinTimeMs),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {number} n
 * @param {number} digits
 */
function formatNum(n, digits) {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(digits);
}

/**
 * Build markdown tables for console / report.
 * @param {ReturnType<typeof aggregateRun>[]} rows
 * @param {string} [cap]
 */
export function formatMarkdownTables(rows, cap = 'uncapped') {
  const subset = rows.filter((r) => r.uplinkCap === cap);
  if (!subset.length) {
    return `_No rows for uplinkCap=${cap}._\n`;
  }

  const sections = [
    ['Uplink / downlink (kbps)', ['uplinkKbpsMean', 'downlinkKbpsMean']],
    ['CPU client / SFU', ['cpuClientMean', 'cpuSfuMean']],
    ['Join time (ms)', ['joinTimeMs']],
    ['RTT / jitter / loss', ['rttMsMean', 'jitterMsMean', 'lossMean']],
  ];

  /** @type {string[]} */
  const out = [`### Summary tables (\`${cap}\`)`, ''];

  for (const [title, fields] of sections) {
    out.push(`#### ${title}`, '');
    out.push(`| mode | n | ${fields.join(' | ')} |`);
    out.push(`| --- | --- | ${fields.map(() => '---').join(' | ')} |`);
    for (const r of subset) {
      const vals = fields.map((f) => {
        const v = r[f];
        if (v == null || v === '') return '—';
        if (f === 'lossMean') return formatNum(v, 4);
        if (f === 'joinTimeMs') return String(Math.round(v));
        return formatNum(Number(v), 2);
      });
      out.push(`| ${r.mode} | ${r.n} | ${vals.join(' | ')} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

/**
 * Sanity warnings for architecture story (uncapped preferred).
 * @param {ReturnType<typeof aggregateRun>[]} rows
 * @param {string} [cap]
 */
export function sanityWarnings(rows, cap = 'uncapped') {
  /** @type {string[]} */
  const warnings = [];
  const subset = rows.filter((r) => r.uplinkCap === cap);

  const meshByN = bestByN(subset.filter((r) => r.mode === 'mesh'));
  const sfuByN = bestByN(subset.filter((r) => r.mode === 'sfu'));

  const meshNs = [...meshByN.keys()].sort((a, b) => a - b);
  if (meshNs.length >= 2) {
    const lo = meshByN.get(meshNs[0]);
    const hi = meshByN.get(meshNs[meshNs.length - 1]);
    if (hi.uplinkKbpsMean + 1e-6 < lo.uplinkKbpsMean) {
      warnings.push(
        `Mesh uplink did not rise with N (${meshNs[0]}→${meshNs.at(-1)}): ` +
          `${formatNum(lo.uplinkKbpsMean, 1)} → ${formatNum(hi.uplinkKbpsMean, 1)} kbps`,
      );
    }
  }

  const sfuNs = [...sfuByN.keys()].sort((a, b) => a - b);
  if (sfuNs.length >= 2) {
    const lo = sfuByN.get(sfuNs[0]);
    const hi = sfuByN.get(sfuNs[sfuNs.length - 1]);
    const base = Math.max(lo.uplinkKbpsMean, 1);
    const ratio = hi.uplinkKbpsMean / base;
    // Roughly flat: allow up to 2× growth (CPU/congestion noise); warn if steeper
    if (ratio > 2) {
      warnings.push(
        `SFU uplink not roughly flat (${sfuNs[0]}→${sfuNs.at(-1)}): ` +
          `${formatNum(lo.uplinkKbpsMean, 1)} → ${formatNum(hi.uplinkKbpsMean, 1)} kbps ` +
          `(${formatNum(ratio, 2)}×)`,
      );
    }
  }

  return warnings;
}

/**
 * Prefer highest trial number per N.
 * @param {ReturnType<typeof aggregateRun>[]} rows
 */
function bestByN(rows) {
  /** @type {Map<number, typeof rows[0]>} */
  const map = new Map();
  for (const r of rows) {
    const prev = map.get(r.n);
    if (!prev || String(r.trial) >= String(prev.trial)) map.set(r.n, r);
  }
  return map;
}

/**
 * Full summarize pipeline for a results directory.
 * @param {string} resultsDir
 * @param {{ skipMs?: number, readdirSync?: Function, readFileSync?: Function }} [opts]
 */
export function summarizeResultsDir(resultsDir, opts = {}) {
  const skipMs = opts.skipMs ?? STEADY_STATE_SKIP_MS;
  const docs = loadRunDocuments(resultsDir, opts);
  const rows = summarizeRuns(docs, skipMs);
  const csv = rowsToCsv(rows);
  const markdown = formatMarkdownTables(rows, 'uncapped');
  const warnings = sanityWarnings(rows, 'uncapped');
  return { docs, rows, csv, markdown, warnings };
}
