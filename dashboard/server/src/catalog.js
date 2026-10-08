import fs from 'node:fs';
import path from 'node:path';

const RUN_FILE_RE = /^n(\d+)-(uncapped|1Mbps|5Mbps)-(\d+)\.json$/i;

/**
 * @param {string} filePath
 * @returns {{ mode: string, n: number, uplinkCap: string, trial: string, fileName: string } | null}
 */
export function parseRunFileName(filePath) {
  const fileName = path.basename(filePath);
  const m = RUN_FILE_RE.exec(fileName);
  if (!m) return null;
  const parent = path.basename(path.dirname(filePath)).toLowerCase();
  if (parent !== 'mesh' && parent !== 'sfu') return null;
  return {
    mode: parent,
    n: Number(m[1]),
    uplinkCap: m[2],
    trial: m[3],
    fileName,
  };
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
export function listJsonFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsonFilesRecursive(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {{ resultsDir: string, fixturesDir: string }} roots
 */
export function buildRunCatalog(roots) {
  /** @type {Map<string, { id: string, mode: string, n: number, uplinkCap: string, trial: string, fileName: string, source: 'results' | 'fixture', absolutePath: string, mtimeMs: number }>} */
  const byId = new Map();

  const ingest = (absolutePath, source) => {
    const meta = parseRunFileName(absolutePath);
    if (!meta) return;
    const id = `${meta.mode}/${meta.fileName}`;
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(absolutePath).mtimeMs;
    } catch {
      mtimeMs = 0;
    }
    const prev = byId.get(id);
    // Prefer real results/ over fixtures when the same id exists
    if (prev && prev.source === 'results' && source === 'fixture') return;
    byId.set(id, {
      id,
      ...meta,
      source,
      absolutePath,
      mtimeMs,
    });
  };

  for (const file of listJsonFilesRecursive(path.join(roots.resultsDir, 'mesh'))) {
    ingest(file, 'results');
  }
  for (const file of listJsonFilesRecursive(path.join(roots.resultsDir, 'sfu'))) {
    ingest(file, 'results');
  }
  for (const file of listJsonFilesRecursive(path.join(roots.fixturesDir, 'mesh'))) {
    ingest(file, 'fixture');
  }
  for (const file of listJsonFilesRecursive(path.join(roots.fixturesDir, 'sfu'))) {
    ingest(file, 'fixture');
  }

  return [...byId.values()].sort((a, b) => {
    if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
    if (a.n !== b.n) return a.n - b.n;
    if (a.uplinkCap !== b.uplinkCap) return a.uplinkCap.localeCompare(b.uplinkCap);
    return a.trial.localeCompare(b.trial);
  });
}

/**
 * @param {{ resultsDir: string, fixturesDir: string }} roots
 * @param {string} id e.g. mesh/n2-uncapped-001.json
 */
export function resolveRunPath(roots, id) {
  const normalized = id.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const parts = normalized.split('/');
  if (parts.length !== 2) return null;
  const [mode, fileName] = parts;
  if ((mode !== 'mesh' && mode !== 'sfu') || !RUN_FILE_RE.test(fileName)) return null;

  const resultsPath = path.join(roots.resultsDir, mode, fileName);
  if (fs.existsSync(resultsPath)) {
    return { absolutePath: resultsPath, source: /** @type {'results'} */ ('results') };
  }
  const fixturePath = path.join(roots.fixturesDir, mode, fileName);
  if (fs.existsSync(fixturePath)) {
    return { absolutePath: fixturePath, source: /** @type {'fixture'} */ ('fixture') };
  }
  return null;
}

/**
 * @param {{ resultsDir: string, fixturesDir: string }} roots
 */
export function resolveSummaryCsv(roots) {
  const resultsCsv = path.join(roots.resultsDir, 'summary', 'bitrate-vs-n.csv');
  if (fs.existsSync(resultsCsv)) {
    return { absolutePath: resultsCsv, source: /** @type {'results'} */ ('results') };
  }
  const fixtureCsv = path.join(roots.fixturesDir, 'summary', 'bitrate-vs-n.csv');
  if (fs.existsSync(fixtureCsv)) {
    return { absolutePath: fixtureCsv, source: /** @type {'fixture'} */ ('fixture') };
  }
  return null;
}
