#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STEADY_STATE_SKIP_MS,
  summarizeResultsDir,
} from './summarize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

/**
 * @param {string[]} argv
 */
export function parseSummarizeArgs(argv) {
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

  const resultsDir = path.resolve(
    repoRoot,
    String(flags.results ?? process.env.RESULTS_DIR ?? 'results'),
  );
  const outPath = path.resolve(
    repoRoot,
    String(flags.out ?? path.join('results', 'summary', 'bitrate-vs-n.csv')),
  );
  const skipMs = Number(flags['skip-ms'] ?? STEADY_STATE_SKIP_MS);
  if (!Number.isFinite(skipMs) || skipMs < 0) {
    throw new Error('--skip-ms must be >= 0');
  }

  return { help: false, resultsDir, outPath, skipMs };
}

export function summarizeUsage() {
  return `Usage:
  node scripts/summarize-results.mjs [options]
  npm run summarize -- [options]

Options:
  --results <dir>   Results root containing mesh/ and sfu/ (default results/)
  --out <file>      CSV output path (default results/summary/bitrate-vs-n.csv)
  --skip-ms <ms>    Ramp-up samples to drop (default 10000)
  --help            Show help
`;
}

/**
 * @param {ReturnType<typeof parseSummarizeArgs>} options
 * @param {object} [deps]
 */
export function runSummarizeCli(options, deps = {}) {
  const {
    summarize = summarizeResultsDir,
    writeFileSync = fs.writeFileSync,
    mkdirSync = fs.mkdirSync,
    log = console.log,
    warn = console.warn,
  } = deps;

  const { rows, csv, markdown, warnings } = summarize(options.resultsDir, {
    skipMs: options.skipMs,
  });

  mkdirSync(path.dirname(options.outPath), { recursive: true });
  writeFileSync(options.outPath, csv, 'utf8');

  log(`Wrote ${rows.length} row(s) → ${options.outPath}`);
  log('');
  log(markdown);

  if (warnings.length) {
    warn('\nSanity warnings:');
    for (const w of warnings) warn(`- ${w}`);
  } else if (rows.length) {
    log('\nSanity checks: OK (mesh uplink rises / SFU roughly flat for uncapped).');
  }

  return { rows, csv, warnings, outPath: options.outPath };
}

export async function main(argv) {
  let options;
  try {
    options = parseSummarizeArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error(summarizeUsage());
    process.exitCode = 1;
    return;
  }
  if (options.help) {
    console.log(summarizeUsage());
    return;
  }
  runSummarizeCli(options);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  await main(process.argv.slice(2));
}
