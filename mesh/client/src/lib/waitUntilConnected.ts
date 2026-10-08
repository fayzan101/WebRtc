import type { CallStatus } from './types';

export type WaitUntilConnectedDeps = {
  getStatus: () => CallStatus;
  getRemoteCount: () => number;
  /** Current cumulative inbound bytes (from getStats / PC snapshots). */
  getBytesReceived: () => Promise<number>;
  now?: () => number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  timeoutMs?: number;
  intervalMs?: number;
};

export type WaitUntilConnectedFn = (nMinus1: number) => Promise<void>;

/**
 * Poll until `remoteCount >= nMinus1` and inbound bytes have increased at least once
 * (or `nMinus1 === 0`, which only requires `connected`).
 */
export function createWaitUntilConnected(
  deps: WaitUntilConnectedDeps,
): WaitUntilConnectedFn {
  const now = deps.now ?? Date.now;
  const setIntervalFn = deps.setIntervalFn ?? setInterval;
  const clearIntervalFn = deps.clearIntervalFn ?? clearInterval;
  const timeoutMs = deps.timeoutMs ?? 60_000;
  const intervalMs = deps.intervalMs ?? 250;

  return (nMinus1: number) =>
    new Promise<void>((resolve, reject) => {
      if (!Number.isInteger(nMinus1) || nMinus1 < 0) {
        reject(
          new Error(
            `nMinus1 must be a non-negative integer, got ${String(nMinus1)}`,
          ),
        );
        return;
      }

      const started = now();
      let baseline: number | null = null;
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearIntervalFn(iv);
        fn();
      };

      const tick = async () => {
        if (settled) return;

        if (now() - started > timeoutMs) {
          finish(() =>
            reject(new Error(`timeout waiting for ${nMinus1} remotes`)),
          );
          return;
        }

        const status = deps.getStatus();
        if (status === 'failed') {
          finish(() =>
            reject(new Error('call failed while waiting for remotes')),
          );
          return;
        }

        if (status !== 'connected') return;

        if (nMinus1 === 0) {
          finish(() => resolve());
          return;
        }

        if (deps.getRemoteCount() < nMinus1) return;

        let bytes = 0;
        try {
          bytes = await deps.getBytesReceived();
        } catch (err) {
          finish(() =>
            reject(err instanceof Error ? err : new Error(String(err))),
          );
          return;
        }

        if (baseline === null) {
          baseline = bytes;
          // Already receiving when wait started counts as "increased at least once"
          // relative to a cold start (0). Require a further bump only if baseline > 0
          // and we want strict growth — for lab automation, bytes > 0 is enough once
          // remotes are present.
          if (bytes > 0) {
            finish(() => resolve());
          }
          return;
        }

        if (bytes > baseline) {
          finish(() => resolve());
        }
      };

      const iv = setIntervalFn(() => {
        void tick();
      }, intervalMs);

      void tick();
    });
}
