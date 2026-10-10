const MODES = new Set(['mesh', 'sfu']);
const CAPS = new Set(['uncapped', '1Mbps', '5Mbps']);

/**
 * Parse `runOnce` CLI flags from an argv slice (no node/script path).
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }

  const mode = String(flags.mode ?? '');
  if (!MODES.has(mode)) {
    throw new Error(`--mode must be mesh|sfu (got ${mode || 'missing'})`);
  }

  const n = Number(flags.n);
  if (!Number.isInteger(n) || n < 2 || n > 6) {
    throw new Error(`--n must be an integer 2..6 (got ${flags.n ?? 'missing'})`);
  }

  const durationSec = Number(flags.duration ?? 90);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`--duration must be a positive number of seconds`);
  }

  const cap = String(flags.cap ?? 'uncapped');
  if (!CAPS.has(cap)) {
    throw new Error(`--cap must be uncapped|1Mbps|5Mbps (got ${cap})`);
  }

  const sampleIntervalMs = Number(flags.interval ?? 2000);
  if (!Number.isFinite(sampleIntervalMs) || sampleIntervalMs < 200) {
    throw new Error(`--interval must be >= 200 ms`);
  }

  const joinTimeoutMs = Number(flags.timeout ?? 60_000);
  if (!Number.isFinite(joinTimeoutMs) || joinTimeoutMs < 1000) {
    throw new Error(`--timeout must be >= 1000 ms`);
  }

  const outDir = String(flags.out ?? process.env.RESULTS_DIR ?? 'results');
  const roomId = String(flags.room ?? process.env.ROOM_ID ?? 'project23');
  const baseUrl = flags['base-url'] ? String(flags['base-url']) : undefined;
  const audioFile = flags['audio-file'] ? String(flags['audio-file']) : undefined;
  const trial = flags.trial != null ? String(flags.trial) : undefined;
  const headless = flags.headed !== true;

  return {
    mode,
    n,
    durationSec,
    cap,
    outDir,
    roomId,
    sampleIntervalMs,
    joinTimeoutMs,
    baseUrl,
    audioFile,
    trial,
    headless,
    help: flags.help === true,
  };
}

export function usageText() {
  return `Usage:
  node src/runOnce.js --mode mesh|sfu --n 2..6 [options]

Options:
  --duration <sec>       Sample window length (default 90)
  --cap <cap>            uncapped|1Mbps|5Mbps (default uncapped)
  --out <dir>            Results root (default results/ or RESULTS_DIR)
  --interval <ms>        Stats sample interval (default 2000)
  --timeout <ms>         Join wait timeout (default 60000)
  --room <id>            Room id (default project23)
  --base-url <url>       Override Vite client origin
  --trial <nnn>          Fixed trial suffix (default next free 001…)
  --audio-file <path>    Fake audio capture WAV for Chromium
  --headed               Show browser windows (default headless)
  --help                 Show this help
`;
}

export { MODES, CAPS };
