#!/usr/bin/env node
/**
 * Phase 8 verification — plots, filled report, README runbook strings, automation tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { main as plotMain } from './plot-results.mjs';
import { main as fillMain } from './fill-report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const oks = [];

function ok(msg) {
  oks.push(msg);
  console.log(`OK  ${msg}`);
}
function fail(msg) {
  errors.push(msg);
  console.error(`FAIL ${msg}`);
}

function assertFileNonEmpty(rel, minBytes = 200) {
  const p = path.join(repoRoot, rel);
  if (!fs.existsSync(p)) {
    fail(`missing ${rel}`);
    return;
  }
  const n = fs.statSync(p).size;
  if (n < minBytes) fail(`${rel} too small (${n} bytes)`);
  else ok(`${rel} (${n} bytes)`);
}

function assertContains(rel, needles) {
  const p = path.join(repoRoot, rel);
  const text = fs.readFileSync(p, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`${rel} missing required string: ${n}`);
    else ok(`${rel} contains "${n}"`);
  }
}

console.log('=== Phase 8 verification ===\n');

// 1) Generate plots + report from fixtures
const fixtureCsv = path.join(
  'dashboard',
  'client',
  'public',
  'fixtures',
  'summary',
  'bitrate-vs-n.csv',
);
try {
  const plot = plotMain([
    '--csv',
    fixtureCsv,
    '--out',
    path.join('docs', 'figures'),
    '--cap',
    'uncapped',
  ]);
  if (!plot.written?.length) fail('plot produced zero files');
  else ok(`plot wrote ${plot.written.length} figure(s)`);
} catch (err) {
  fail(`plot: ${err instanceof Error ? err.message : err}`);
}

try {
  fillMain(['--csv', fixtureCsv, '--out', path.join('docs', 'REPORT.md')]);
  ok('fill-report wrote docs/REPORT.md');
} catch (err) {
  fail(`fill-report: ${err instanceof Error ? err.message : err}`);
}

// 2) Figure files are real SVGs
for (const name of [
  'uplink-vs-n.svg',
  'downlink-vs-n.svg',
  'cpu-vs-n.svg',
  'join-vs-n.svg',
  'loss-vs-n.svg',
]) {
  const rel = path.join('docs', 'figures', name);
  assertFileNonEmpty(rel, 400);
  const body = fs.existsSync(path.join(repoRoot, rel))
    ? fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    : '';
  if (body && !body.includes('<svg')) fail(`${rel} is not SVG`);
  else if (body) ok(`${rel} is SVG`);
}

// 3) Report contains fixture-derived numbers
assertContains(path.join('docs', 'REPORT.md'), [
  '201.44', // mesh N=6 uplink from fixtures
  '43.44', // sfu flat uplink
  'npm run matrix',
  'npm run summarize',
  'tc-uplink.sh',
]);

// 4) README runbook has exact commands
assertContains('README.md', [
  'npm run mesh',
  'npm run sfu',
  'npm run livekit',
  'npm run run-once',
  'npm run matrix',
  'npm run summarize',
  'tc-uplink.sh',
  'npm run plot',
  'npm run fill-report',
]);

// 5) Automation unit tests
const test = spawnSync('npm', ['run', 'test', '-w', '@webrtc/automation'], {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: true,
});
if (test.status !== 0) {
  fail('automation unit tests failed');
  console.error(test.stdout);
  console.error(test.stderr);
} else {
  ok('automation unit tests passed');
}

console.log(`\n=== ${errors.length ? 'FAILED' : 'PASSED'} (${oks.length} checks, ${errors.length} failures) ===`);
if (errors.length) {
  process.exitCode = 1;
}
