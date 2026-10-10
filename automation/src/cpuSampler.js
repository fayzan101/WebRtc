/**
 * CPU sampler over browser (and optional LiveKit) PIDs via pidusage.
 * @param {{ pidusage?: (pids: number|number[]) => Promise<any>, extraPids?: number[] }} [opts]
 */
export function createCpuSampler(opts = {}) {
  const extraPids = (opts.extraPids ?? []).filter((p) => Number.isInteger(p) && p > 0);
  let pidusage = opts.pidusage;

  async function loadPidusage() {
    if (pidusage) return pidusage;
    const mod = await import('pidusage');
    pidusage = mod.default ?? mod;
    return pidusage;
  }

  /**
   * @param {number[]} browserPids
   * @returns {Promise<{ byPid: Record<number, number>, sfuCpuPercent: number|null }>}
   */
  async function sample(browserPids) {
    const usage = await loadPidusage();
    const pids = [...new Set([...browserPids, ...extraPids].filter((p) => Number.isInteger(p) && p > 0))];
    /** @type {Record<number, number>} */
    const byPid = {};
    let sfuCpuPercent = null;

    if (!pids.length) {
      return { byPid, sfuCpuPercent };
    }

    let stats;
    try {
      stats = await usage(pids.length === 1 ? pids[0] : pids);
    } catch {
      return { byPid, sfuCpuPercent };
    }

    // pidusage returns a single object for one pid, or map for array
    if (pids.length === 1) {
      byPid[pids[0]] = Number(stats?.cpu) || 0;
    } else {
      for (const pid of pids) {
        byPid[pid] = Number(stats?.[pid]?.cpu) || 0;
      }
    }

    if (extraPids.length) {
      const sfuPid = extraPids[0];
      sfuCpuPercent = byPid[sfuPid] ?? null;
    }

    return { byPid, sfuCpuPercent };
  }

  return { sample, extraPids };
}

/**
 * Resolve optional LiveKit / SFU PID from env.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveSfuPid(env = process.env) {
  const raw = env.LIVEKIT_PID ?? env.SFU_PID;
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}
