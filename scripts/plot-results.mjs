#!/usr/bin/env node
/**
 * Phase 8 — generate SVG figures from summary CSV.
 *
 * Usage:
 *   node scripts/plot-results.mjs [--csv path] [--out docs/figures] [--cap uncapped]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSummaryCsv, writeStandardPlots } from '../automation/src/plotResults.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  if (flags.help === true) return { help: true };

  const defaultCsvCandidates = [
    path.join(repoRoot, 'results', 'summary', 'bitrate-vs-n.csv'),
    path.join(repoRoot, 'dashboard', 'client', 'public', 'fixtures', 'summary', 'bitrate-vs-n.csv'),
  ];
  let csvPath = flags.csv ? path.resolve(repoRoot, String(flags.csv)) : null;
  if (!csvPath) {
    csvPath = defaultCsvCandidates.find((p) => fs.existsSync(p)) ?? defaultCsvCandidates[1];
  }
  const outDir = path.resolve(repoRoot, String(flags.out ?? path.join('docs', 'figures')));
  const cap = String(flags.cap ?? 'uncapped');
  return { help: false, csvPath, outDir, cap };
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(`Usage: node scripts/plot-results.mjs [--csv path] [--out docs/figures] [--cap uncapped]`);
    return { written: [] };
  }
  if (!fs.existsSync(opts.csvPath)) {
    throw new Error(`CSV not found: ${opts.csvPath}`);
  }
  const csv = fs.readFileSync(opts.csvPath, 'utf8');
  const rows = parseSummaryCsv(csv);
  const result = writeStandardPlots(rows, opts.outDir, { cap: opts.cap });
  console.log(`Read ${rows.length} row(s) from ${opts.csvPath}`);
  for (const w of result.written) {
    console.log(`  wrote ${w.path} (${w.bytes} bytes)`);
  }
  return result;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}
