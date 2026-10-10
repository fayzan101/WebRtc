import { normalizeSample } from './schema.js';

/**
 * @param {number} ms
 */
export function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Collect schema samples from each participant page for `durationSec`.
 *
 * @param {object} opts
 * @param {Array<{ peerId: string, page: { evaluate: Function }, browserPid: number }>} opts.pages
 * @param {number} opts.durationSec
 * @param {number} opts.sampleIntervalMs
 * @param {(pids: number[]) => Promise<{ byPid: Record<number, number>, sfuCpuPercent: number|null }>} opts.sampleCpu
 * @param {number} [opts.sfuPid]
 * @param {(ms: number) => Promise<void>} [opts.sleep]
 * @param {() => number} [opts.now]
 */
export async function collectStats(opts) {
  const {
    pages,
    durationSec,
    sampleIntervalMs,
    sampleCpu,
    sfuPid = 0,
    sleep = defaultSleep,
    now = () => Date.now(),
  } = opts;

  if (!pages?.length) throw new Error('collectStats requires at least one page');
  if (durationSec <= 0) throw new Error('durationSec must be > 0');
  if (sampleIntervalMs < 200) throw new Error('sampleIntervalMs must be >= 200');

  /** @type {Map<string, object[]>} */
  const samplesByPeer = new Map(pages.map((p) => [p.peerId, []]));
  /** @type {{ ts: number, cpuPercent: number }[]} */
  const sfuSamples = [];

  const joinTimes = await Promise.all(
    pages.map(async (p) => {
      try {
        const ms = await p.page.evaluate(() => {
          const fn = window.__getJoinTimeMs;
          return typeof fn === 'function' ? fn() : null;
        });
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
      } catch {
        return null;
      }
    }),
  );
  const joinTimeMs = joinTimes.filter((v) => v != null).reduce((a, b) => Math.max(a, b), 0) || null;

  const endAt = now() + durationSec * 1000;
  let first = true;

  while (now() < endAt) {
    if (!first) {
      const remaining = endAt - now();
      if (remaining <= 0) break;
      await sleep(Math.min(sampleIntervalMs, remaining));
      if (now() >= endAt && samplesByPeer.get(pages[0].peerId)?.length) break;
    }
    first = false;

    const pids = pages.map((p) => p.browserPid).filter((pid) => pid > 0);
    const cpu = await sampleCpu(pids);
    const ts = now();

    await Promise.all(
      pages.map(async (p) => {
        let raw;
        try {
          raw = await p.page.evaluate(async () => {
            const fn = window.__webrtcStats;
            if (typeof fn !== 'function') throw new Error('__webrtcStats missing');
            return fn();
          });
        } catch (err) {
          throw new Error(`stats failed for ${p.peerId}: ${err instanceof Error ? err.message : err}`);
        }
        const cpuPercent = cpu.byPid[p.browserPid] ?? 0;
        samplesByPeer.get(p.peerId).push(normalizeSample({ ...raw, ts }, cpuPercent));
      }),
    );

    if (sfuPid > 0) {
      sfuSamples.push({
        ts,
        cpuPercent: cpu.sfuCpuPercent ?? 0,
      });
    }
  }

  return {
    joinTimeMs,
    participants: pages.map((p) => ({
      peerId: p.peerId,
      samples: samplesByPeer.get(p.peerId) ?? [],
    })),
    sfuSamples,
  };
}
