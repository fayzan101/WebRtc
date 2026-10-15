#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { executeRun } from './runOnce.js';
import { parseArgs as parseRunOnceArgs } from './parseArgs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(repoRoot, '.env') });

const DEFAULT_MODES = ['mesh', 'sfu'];
const DEFAULT_NS = [2, 3, 4, 5, 6];

/**
 * @param {string[]} argv
 */
export function parseMatrixArgs(argv) {
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

  if (flags.help === true) {
    return { help: true };
  }

  const modes = String(flags.modes ?? 'mesh,sfu')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const m of modes) {
    if (m !== 'mesh' && m !== 'sfu') throw new Error(`Invalid mode in --modes: ${m}`);
  }

  const ns = String(flags.n ?? '2,3,4,5,6')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((v) => Number.isInteger(v));
  for (const n of ns) {
    if (n < 2 || n > 6) throw new Error(`--n values must be 2..6 (got ${n})`);
  }
  if (!ns.length) throw new Error('--n must list at least one participant count');

  const trials = Number(flags.trials ?? 1);
  if (!Number.isInteger(trials) || trials < 1 || trials > 99) {
    throw new Error('--trials must be integer 1..99');
  }

  const cooldownSec = Number(flags.cooldown ?? 15);
  if (!Number.isFinite(cooldownSec) || cooldownSec < 0) {
    throw new Error('--cooldown must be >= 0 seconds');
  }

  const durationSec = Number(flags.duration ?? 90);
  const cap = String(flags.cap ?? 'uncapped');
  if (!['uncapped', '1Mbps', '5Mbps'].includes(cap)) {
    throw new Error(`--cap must be uncapped|1Mbps|5Mbps (got ${cap})`);
  }

  const outDir = String(flags.out ?? process.env.RESULTS_DIR ?? 'results');
  const sampleIntervalMs = Number(flags.interval ?? 2000);
  const joinTimeoutMs = Number(flags.timeout ?? 60_000);
  const roomPrefix = String(flags.room ?? 'project23');
  const dryRun = flags['dry-run'] === true;
  const headless = flags.headed !== true;
  const baseUrlMesh = flags['base-url-mesh'] ? String(flags['base-url-mesh']) : undefined;
  const baseUrlSfu = flags['base-url-sfu'] ? String(flags['base-url-sfu']) : undefined;
  const tcIface = flags['tc-iface'] ? String(flags['tc-iface']) : undefined;
  const cappedPeer = String(flags['capped-peer'] ?? 'p1');
  if (!/^p\d+$/.test(cappedPeer)) {
    throw new Error(`--capped-peer must look like p1 (got ${cappedPeer})`);
  }

  return {
    help: false,
    modes: modes.length ? modes : DEFAULT_MODES,
    ns: ns.length ? ns : DEFAULT_NS,
    trials,
    cooldownSec,
    durationSec,
    cap,
    outDir,
    sampleIntervalMs,
    joinTimeoutMs,
    roomPrefix,
    dryRun,
    headless,
    baseUrlMesh,
    baseUrlSfu,
    tcIface,
    cappedPeer,
  };
}

export function matrixUsage() {
  return `Usage:
  node src/runMatrix.js [options]

Options:
  --modes mesh,sfu       Modes to run (default mesh,sfu)
  --n 2,3,4,5,6          Participant counts (default 2..6)
  --trials <k>           Trials per (mode,N) (default 1)
  --cap <cap>            uncapped|1Mbps|5Mbps (default uncapped)
  --duration <sec>       Per-run sample window (default 90)
  --cooldown <sec>       Sleep between runs (default 15)
  --out <dir>            Results root (default results/)
  --interval <ms>        Stats interval (default 2000)
  --timeout <ms>         Join timeout (default 60000)
  --room <prefix>        Room id prefix (default project23)
  --base-url-mesh <url>  Override mesh client origin
  --base-url-sfu <url>   Override SFU client origin
  --tc-iface <iface>     Linux/WSL iface for tc-uplink.sh (optional)
  --capped-peer <id>     Peer id treated as capped (default p1)
  --dry-run              Print planned grid only
  --headed               Show browsers
  --help                 Show help

Note: --cap 1Mbps|5Mbps alone labels results; pass --tc-iface on Linux/WSL to shape uplink.
`;
}

/**
 * Build ordered run plan: mode × N × trial.
 * @param {ReturnType<typeof parseMatrixArgs>} options
 */
export function buildMatrixPlan(options) {
  /** @type {Array<{ mode: string, n: number, trialIndex: number, roomId: string }>} */
  const plan = [];
  for (const mode of options.modes) {
    for (const n of options.ns) {
      for (let t = 1; t <= options.trials; t += 1) {
        plan.push({
          mode,
          n,
          trialIndex: t,
          roomId: `${options.roomPrefix}-${mode}-n${n}-t${String(t).padStart(3, '0')}`,
        });
      }
    }
  }
  return plan;
}

/**
 * @param {ReturnType<typeof parseMatrixArgs>} options
 * @param {object} [deps]
 */
export async function executeMatrix(options, deps = {}) {
  const {
    runOnce = executeRun,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    writeFileSync = fs.writeFileSync,
    mkdirSync = fs.mkdirSync,
    log = console.log,
    error = console.error,
  } = deps;

  const plan = buildMatrixPlan(options);
  /** @type {Array<object>} */
  const results = [];

  log(
    JSON.stringify(
      {
        msg: 'matrix start',
        runs: plan.length,
        modes: options.modes,
        ns: options.ns,
        trials: options.trials,
        cap: options.cap,
        tcIface: options.tcIface ?? null,
        cappedPeer: options.cappedPeer,
        dryRun: options.dryRun,
      },
      null,
      2,
    ),
  );

  if (options.dryRun) {
    log('| # | mode | N | trial | roomId |');
    log('| --- | --- | --- | --- | --- |');
    plan.forEach((p, i) => {
      log(`| ${i + 1} | ${p.mode} | ${p.n} | ${p.trialIndex} | ${p.roomId} |`);
    });
    return { plan, results: [], ok: 0, failed: 0, dryRun: true };
  }

  mkdirSync(path.join(options.outDir, 'summary'), { recursive: true });

  for (let i = 0; i < plan.length; i += 1) {
    const step = plan[i];
    const label = `${step.mode} N=${step.n} trial=${step.trialIndex}`;
    log(`\n==> [${i + 1}/${plan.length}] ${label}`);

    const baseUrl =
      step.mode === 'mesh' ? options.baseUrlMesh : options.baseUrlSfu;

    /** @type {ReturnType<typeof parseRunOnceArgs>} */
    const runOpts = {
      mode: /** @type {'mesh'|'sfu'} */ (step.mode),
      n: step.n,
      durationSec: options.durationSec,
      cap: options.cap,
      outDir: options.outDir,
      roomId: step.roomId,
      sampleIntervalMs: options.sampleIntervalMs,
      joinTimeoutMs: options.joinTimeoutMs,
      baseUrl,
      audioFile: undefined,
      trial: String(step.trialIndex),
      headless: options.headless,
      tcIface: options.tcIface,
      cappedPeer: options.cappedPeer,
      help: false,
    };

    try {
      const outcome = await runOnce(runOpts);
      results.push({
        status: 'ok',
        ...step,
        outPath: outcome.outPath,
        runId: outcome.doc?.runId,
      });
      log(`ok ${outcome.outPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`FAIL ${label}: ${message}`);
      results.push({
        status: 'error',
        ...step,
        error: message,
      });
    }

    if (i < plan.length - 1 && options.cooldownSec > 0) {
      log(`cooldown ${options.cooldownSec}s…`);
      await sleep(options.cooldownSec * 1000);
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.filter((r) => r.status === 'error').length;
  const summaryPath = path.join(options.outDir, 'summary', 'matrix-last.json');
  writeFileSync(
    summaryPath,
    `${JSON.stringify({ finishedAt: new Date().toISOString(), ok, failed, results }, null, 2)}\n`,
    'utf8',
  );

  log('\n| mode | N | trial | status | path/error |');
  log('| --- | --- | --- | --- | --- |');
  for (const r of results) {
    const detail = r.status === 'ok' ? r.outPath : r.error;
    log(`| ${r.mode} | ${r.n} | ${r.trialIndex} | ${r.status} | ${detail} |`);
  }
  log(`\nmatrix done: ok=${ok} failed=${failed} summary=${summaryPath}`);

  return { plan, results, ok, failed, dryRun: false, summaryPath };
}

async function main(argv) {
  let options;
  try {
    options = parseMatrixArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error(matrixUsage());
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(matrixUsage());
    return;
  }

  const outcome = await executeMatrix(options);
  if (!outcome.dryRun && outcome.failed > 0) {
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  await main(process.argv.slice(2));
}

export { main };
