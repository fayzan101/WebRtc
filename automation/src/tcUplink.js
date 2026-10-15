import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCRIPT = path.resolve(__dirname, '../../scripts/tc-uplink.sh');

/**
 * Map schema cap labels to `tc` rate strings.
 * @param {string} cap
 */
export function capToTcRate(cap) {
  if (cap === '1Mbps') return '1mbit';
  if (cap === '5Mbps') return '5mbit';
  if (cap === 'uncapped') return null;
  throw new Error(`Unsupported cap for tc: ${cap}`);
}

/**
 * @param {string} [scriptPath]
 */
export function resolveTcScript(scriptPath = process.env.TC_UPLINK_SCRIPT || DEFAULT_SCRIPT) {
  return path.resolve(scriptPath);
}

/**
 * @param {{ command: string, args?: string[], cwd?: string, env?: NodeJS.ProcessEnv }} opts
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function defaultRunCommand({ command, args = [], cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env ?? process.env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr?.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * Shell helper around scripts/tc-uplink.sh (Linux / WSL / Git Bash).
 * @param {object} [opts]
 */
export function createTcController(opts = {}) {
  const scriptPath = resolveTcScript(opts.scriptPath);
  const runCommand = opts.runCommand ?? defaultRunCommand;
  const shell = opts.shell ?? process.env.TC_SHELL ?? 'bash';
  const existsSync = opts.existsSync ?? fs.existsSync;
  const platform = opts.platform ?? process.platform;

  async function run(subcommand, iface, rate) {
    if (!existsSync(scriptPath)) {
      throw new Error(`tc script not found: ${scriptPath}`);
    }
    if (platform === 'win32' && !process.env.TC_SHELL && shell === 'bash') {
      // Allow Git Bash / WSL bash if on PATH; otherwise fail clearly.
    }
    const args = [scriptPath, subcommand, iface];
    if (rate) args.push(rate);
    const result = await runCommand({ command: shell, args });
    if (result.code !== 0) {
      throw new Error(
        `tc-uplink.sh ${subcommand} failed (exit ${result.code}): ${result.stderr || result.stdout}`,
      );
    }
    return result;
  }

  return {
    scriptPath,
    /**
     * @param {string} iface
     * @param {string} rate tc rate e.g. 1mbit
     */
    async apply(iface, rate) {
      if (!iface?.trim()) throw new Error('tc iface is required');
      if (!rate?.trim()) throw new Error('tc rate is required');
      return run('apply', iface.trim(), rate.trim());
    },
    /** @param {string} iface */
    async clear(iface) {
      if (!iface?.trim()) throw new Error('tc iface is required');
      return run('clear', iface.trim());
    },
    /** @param {string} iface */
    async show(iface) {
      if (!iface?.trim()) throw new Error('tc iface is required');
      return run('show', iface.trim());
    },
  };
}

/**
 * Apply cap when --tc-iface is set; no-op for uncapped / missing iface.
 * @param {{ cap: string, tcIface?: string, createController?: Function }} opts
 */
export async function applyCapIfNeeded(opts) {
  const { cap, tcIface, createController = createTcController } = opts;
  if (!tcIface) {
    if (cap !== 'uncapped') {
      return {
        applied: false,
        note:
          `uplinkCap=${cap} recorded without --tc-iface; ` +
          'shape on Linux/WSL with --tc-iface <iface> for real caps',
      };
    }
    return { applied: false, note: '' };
  }
  const rate = capToTcRate(cap);
  if (!rate) return { applied: false, note: '' };

  const tc = createController();
  await tc.apply(tcIface, rate);
  return {
    applied: true,
    note: `tc applied on ${tcIface} rate=${rate} (single-host shapes whole NIC)`,
    rate,
    iface: tcIface,
  };
}

/**
 * Always best-effort clear when iface was used.
 * @param {{ tcIface?: string, createController?: Function }} opts
 */
export async function clearCapIfNeeded(opts) {
  const { tcIface, createController = createTcController } = opts;
  if (!tcIface) return { cleared: false };
  const tc = createController();
  await tc.clear(tcIface);
  return { cleared: true };
}
