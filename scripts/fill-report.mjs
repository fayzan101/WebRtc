#!/usr/bin/env node
/**
 * Phase 8 — fill docs/REPORT.md from summary CSV (+ optional failure-points.md).
 *
 * Usage:
 *   node scripts/fill-report.mjs [--csv path] [--fail path] [--out docs/REPORT.md]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSummaryCsv } from '../automation/src/plotResults.js';
import { buildFilledReport } from '../automation/src/reportFill.js';

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
  const failPath = path.resolve(
    repoRoot,
    String(flags.fail ?? path.join('results', 'summary', 'failure-points.md')),
  );
  const outPath = path.resolve(repoRoot, String(flags.out ?? path.join('docs', 'REPORT.md')));
  return { help: false, csvPath, failPath, outPath };
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(
      'Usage: node scripts/fill-report.mjs [--csv path] [--fail path] [--out docs/REPORT.md]',
    );
    return { outPath: null };
  }
  if (!fs.existsSync(opts.csvPath)) {
    throw new Error(`CSV not found: ${opts.csvPath}`);
  }
  const rows = parseSummaryCsv(fs.readFileSync(opts.csvPath, 'utf8'));
  const failureMd = fs.existsSync(opts.failPath) ? fs.readFileSync(opts.failPath, 'utf8') : '';
  const md = buildFilledReport({
    rows,
    failureMd,
    figureRelDir: 'figures',
    sourceNote: `Generated from ${path.relative(repoRoot, opts.csvPath).replace(/\\/g, '/')}`,
  });
  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  fs.writeFileSync(opts.outPath, md, 'utf8');
  console.log(`Wrote ${opts.outPath} (${rows.length} summary rows)`);
  return { outPath: opts.outPath, rows };
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
