import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CallStatus } from './types';
import { createWaitUntilConnected } from './waitUntilConnected';

type Harness = {
  status: CallStatus;
  remotes: number;
  bytes: number;
  now: number;
  intervals: Array<{ id: number; fn: () => void; ms: number }>;
  nextId: number;
};

function makeHarness(initial?: Partial<Harness>) {
  const h: Harness = {
    status: 'idle',
    remotes: 0,
    bytes: 0,
    now: 0,
    intervals: [],
    nextId: 1,
    ...initial,
  };

  const wait = createWaitUntilConnected({
    getStatus: () => h.status,
    getRemoteCount: () => h.remotes,
    getBytesReceived: async () => h.bytes,
    now: () => h.now,
    setIntervalFn: ((fn: () => void, ms?: number) => {
      const id = h.nextId++;
      h.intervals.push({ id, fn: () => void fn(), ms: ms ?? 0 });
      return id as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval,
    clearIntervalFn: ((id: ReturnType<typeof setInterval>) => {
      h.intervals = h.intervals.filter((x) => x.id !== (id as unknown as number));
    }) as typeof clearInterval,
    timeoutMs: 1000,
    intervalMs: 100,
  });

  const flush = async () => {
    const copy = [...h.intervals];
    for (const iv of copy) iv.fn();
    await Promise.resolve();
    await Promise.resolve();
  };

  return { h, wait, flush };
}

describe('createWaitUntilConnected (sfu)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid nMinus1', async () => {
    const { wait } = makeHarness();
    await expect(wait(-1)).rejects.toThrow(/non-negative integer/);
  });

  it('resolves nMinus1=0 when connected', async () => {
    const { wait, flush } = makeHarness({ status: 'connected' });
    const p = wait(0);
    await flush();
    await expect(p).resolves.toBeUndefined();
  });

  it('resolves after remotes + byte growth', async () => {
    const { h, wait, flush } = makeHarness({
      status: 'connected',
      remotes: 2,
      bytes: 0,
    });
    const p = wait(2);
    await flush();
    h.bytes = 10;
    await flush();
    await expect(p).resolves.toBeUndefined();
  });

  it('rejects on failed / timeout', async () => {
    const failed = makeHarness({ status: 'joining' });
    const pFail = failed.wait(1);
    failed.h.status = 'failed';
    await failed.flush();
    await expect(pFail).rejects.toThrow(/call failed/);

    const timed = makeHarness({ status: 'connected', remotes: 0 });
    const pTime = timed.wait(1);
    timed.h.now = 2000;
    await timed.flush();
    await expect(pTime).rejects.toThrow(/timeout/);
  });
});
