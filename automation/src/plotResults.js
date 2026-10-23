import fs from 'node:fs';
import path from 'node:path';

/**
 * Parse schema summary CSV into row objects.
 * @param {string} csv
 */
export function parseSummaryCsv(csv) {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
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
  if (iMode < 0 || iN < 0 || iUp < 0) {
    throw new Error('CSV missing required columns mode,n,uplinkKbpsMean');
  }

  /** @type {object[]} */
  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const mode = cols[iMode];
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
 * Prefer latest trial per (mode, n, cap).
 * @param {object[]} rows
 * @param {string} [cap]
 */
export function seriesByMode(rows, cap = 'uncapped') {
  const subset = rows.filter((r) => r.uplinkCap === cap);
  /** @type {Map<string, object>} */
  const best = new Map();
  for (const r of subset) {
    const key = `${r.mode}:${r.n}`;
    const prev = best.get(key);
    if (!prev || String(r.trial) >= String(prev.trial)) best.set(key, r);
  }
  const mesh = [...best.values()]
    .filter((r) => r.mode === 'mesh')
    .sort((a, b) => a.n - b.n);
  const sfu = [...best.values()]
    .filter((r) => r.mode === 'sfu')
    .sort((a, b) => a.n - b.n);
  return { mesh, sfu, cap };
}

/**
 * Build a simple multi-series SVG line chart (real graphics, no stubs).
 * @param {object} opts
 */
export function buildLineChartSvg(opts) {
  const {
    title,
    xLabel = 'N',
    yLabel,
    series,
    width = 720,
    height = 420,
    padding = { top: 48, right: 24, bottom: 56, left: 64 },
  } = opts;

  if (!series?.length) {
    throw new Error('buildLineChartSvg requires at least one series');
  }

  const allPoints = series.flatMap((s) => s.points);
  if (!allPoints.length) throw new Error('series have no points');

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = 0;
  const yMax = Math.max(...ys, 1) * 1.1;

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const xScale = (x) =>
    padding.left + ((x - xMin) / Math.max(xMax - xMin, 1e-9)) * plotW;
  const yScale = (y) =>
    padding.top + plotH - ((y - yMin) / Math.max(yMax - yMin, 1e-9)) * plotH;

  const gridLines = [];
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i += 1) {
    const yVal = yMin + ((yMax - yMin) * i) / yTicks;
    const y = yScale(yVal);
    gridLines.push(
      `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d8dee9" stroke-width="1"/>`,
      `<text x="${padding.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#4c566a" font-family="Segoe UI, sans-serif">${yVal.toFixed(yVal >= 10 ? 0 : 1)}</text>`,
    );
  }

  const paths = series.map((s) => {
    const d = s.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`)
      .join(' ');
    const dots = s.points
      .map(
        (p) =>
          `<circle cx="${xScale(p.x).toFixed(1)}" cy="${yScale(p.y).toFixed(1)}" r="3.5" fill="${s.color}"/>`,
      )
      .join('');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5"/>${dots}`;
  });

  const legend = series
    .map((s, i) => {
      const lx = padding.left + i * 120;
      const ly = 22;
      return `<rect x="${lx}" y="${ly - 8}" width="12" height="12" fill="${s.color}" rx="2"/>
        <text x="${lx + 18}" y="${ly + 2}" font-size="12" fill="#2e3440" font-family="Segoe UI, sans-serif">${escapeXml(s.name)}</text>`;
    })
    .join('');

  const xTickNs = [...new Set(xs)].sort((a, b) => a - b);
  const xTicks = xTickNs
    .map((x) => {
      const px = xScale(x);
      return `<text x="${px.toFixed(1)}" y="${(height - padding.bottom + 20).toFixed(1)}" text-anchor="middle" font-size="11" fill="#4c566a" font-family="Segoe UI, sans-serif">${x}</text>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#fafbfc"/>
  <text x="${width / 2}" y="28" text-anchor="middle" font-size="16" font-weight="600" fill="#2e3440" font-family="Segoe UI, sans-serif">${escapeXml(title)}</text>
  ${legend}
  ${gridLines.join('\n  ')}
  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#4c566a" stroke-width="1.5"/>
  <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#4c566a" stroke-width="1.5"/>
  ${paths.join('\n  ')}
  ${xTicks}
  <text x="${width / 2}" y="${height - 12}" text-anchor="middle" font-size="12" fill="#4c566a" font-family="Segoe UI, sans-serif">${escapeXml(xLabel)}</text>
  <text x="18" y="${height / 2}" text-anchor="middle" font-size="12" fill="#4c566a" font-family="Segoe UI, sans-serif" transform="rotate(-90 18 ${height / 2})">${escapeXml(yLabel)}</text>
</svg>
`;
}

/**
 * @param {string} s
 */
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {ReturnType<typeof seriesByMode>} grouped
 * @param {string} metricKey
 * @param {string} yLabel
 * @param {string} title
 */
export function chartForMetric(grouped, metricKey, yLabel, title) {
  return buildLineChartSvg({
    title,
    yLabel,
    series: [
      {
        name: 'mesh',
        color: '#5b9fd4',
        points: grouped.mesh.map((r) => ({ x: r.n, y: Number(r[metricKey]) || 0 })),
      },
      {
        name: 'sfu',
        color: '#3ecf8e',
        points: grouped.sfu.map((r) => ({ x: r.n, y: Number(r[metricKey]) || 0 })),
      },
    ],
  });
}

/**
 * Generate standard Phase 8 report figures from summary rows.
 * @param {object[]} rows
 * @param {string} outDir
 * @param {{ writeFileSync?: typeof fs.writeFileSync, mkdirSync?: typeof fs.mkdirSync, cap?: string }} [fsApi]
 */
export function writeStandardPlots(rows, outDir, fsApi = {}) {
  const writeFileSync = fsApi.writeFileSync ?? fs.writeFileSync;
  const mkdirSync = fsApi.mkdirSync ?? fs.mkdirSync;
  const cap = fsApi.cap ?? 'uncapped';
  const grouped = seriesByMode(rows, cap);
  mkdirSync(outDir, { recursive: true });

  /** @type {{ name: string, path: string, bytes: number }[]} */
  const written = [];
  const specs = [
    ['uplink-vs-n.svg', 'uplinkKbpsMean', 'Uplink (kbps)', `Uplink vs N (${cap})`],
    ['downlink-vs-n.svg', 'downlinkKbpsMean', 'Downlink (kbps)', `Downlink vs N (${cap})`],
    ['cpu-vs-n.svg', 'cpuClientMean', 'Client CPU (%)', `Client CPU vs N (${cap})`],
    ['join-vs-n.svg', 'joinTimeMs', 'Join time (ms)', `Join time vs N (${cap})`],
    ['loss-vs-n.svg', 'lossMean', 'Loss ratio', `Loss vs N (${cap})`],
  ];

  for (const [file, key, yLabel, title] of specs) {
    if (
      (key === 'uplinkKbpsMean' || key === 'downlinkKbpsMean') &&
      !grouped.mesh.length &&
      !grouped.sfu.length
    ) {
      continue;
    }
    const svg = chartForMetric(grouped, key, yLabel, title);
    const filePath = path.join(outDir, file);
    writeFileSync(filePath, svg, 'utf8');
    written.push({ name: file, path: filePath, bytes: Buffer.byteLength(svg, 'utf8') });
  }

  return { written, grouped, cap };
}
