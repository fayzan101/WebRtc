import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {number|string} trial
 */
export function formatTrial(trial) {
  const n = typeof trial === 'string' ? Number(trial) : trial;
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new Error(`trial must be integer 1..999 (got ${trial})`);
  }
  return String(n).padStart(3, '0');
}

/**
 * @param {{ n: number, cap: string, trial: string }} opts
 */
export function runFileName({ n, cap, trial }) {
  return `n${n}-${cap}-${trial}.json`;
}

/**
 * @param {string} outDir
 * @param {'mesh'|'sfu'} mode
 * @param {{ n: number, cap: string, trial: string }} meta
 */
export function resolveRunPath(outDir, mode, meta) {
  return path.join(outDir, mode, runFileName(meta));
}

/**
 * Next free trial index for n/cap under results/{mode}/.
 * @param {string} modeDir
 * @param {number} n
 * @param {string} cap
 * @param {{ readdirSync?: typeof fs.readdirSync }} [fsApi]
 */
export function nextTrialNumber(modeDir, n, cap, fsApi = fs) {
  const prefix = `n${n}-${cap}-`;
  let max = 0;
  let entries = [];
  try {
    entries = fsApi.readdirSync(modeDir);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'ENOENT') throw err;
    return 1;
  }
  for (const name of entries) {
    if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
    const raw = name.slice(prefix.length, -'.json'.length);
    const num = Number(raw);
    if (Number.isInteger(num) && num > max) max = num;
  }
  return max + 1;
}
