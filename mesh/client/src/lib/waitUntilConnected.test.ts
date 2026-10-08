import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CallStatus } from './types';
import { createWaitUntilConnected } from './waitUntilConnected';

type TimerCb = () => void;

type Harness = {
  status: CallStatus;
  remotes: number;
  bytes: number;
  now: number;
  intervals: Array<{ id: number; fn: TimerCb; ms: number }>;
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
    setIntervalFn: ((fn: TimerCb, ms?: number) => {
      const id = h.nextId++;
      h.intervals.push({ id, fn, ms: ms ?? 0 });
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

describe('createWaitUntilConnected', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-integer / negative nMinus1', async () => {
    const { wait } = makeHarness();
    await expect(wait(-1)).rejects.toThrow(/non-negative integer/);
    await expect(wait(1.5)).rejects.toThrow(/non-negative integer/);
    await expect(wait(Number.NaN)).rejects.toThrow(/non-negative integer/);
  });

  it('resolves immediately for nMinus1=0 when already connected', async () => {
    const { h, wait, flush } = makeHarness({ status: 'connected' });
    const p = wait(0);
    await flush();
    await expect(p).resolves.toBeUndefined();
    expect(h.intervals).toHaveLength(0);
  });

  it('waits until connected before resolving nMinus1=0', async () => {
    const { h, wait, flush } = makeHarness({ status: 'joining' });
    const p = wait(0);
    let done = false;
    void p.then(() => {
      done = true;
    });
    await flush();
    expect(done).toBe(false);

    h.status = 'connected';
    await flush();
    await expect(p).resolves.toBeUndefined();
  });

  it('resolves when remotes ready and bytes already > 0', async () => {
    const { wait, flush } = makeHarness({
      status: 'connected',
      remotes: 2,
      bytes: 500,
    });
    const p = wait(2);
    await flush();
    await expect(p).resolves.toBeUndefined();
  });

  it('resolves after bytes increase from baseline 0', async () => {
    const { h, wait, flush } = makeHarness({
      status: 'connected',
      remotes: 1,
      bytes: 0,
    });
    const p = wait(1);
    await flush();
    h.bytes = 120;
    await flush();
    await expect(p).resolves.toBeUndefined();
  });

  it('does not resolve when remotes short even if bytes > 0', async () => {
    const { h, wait, flush } = makeHarness({
      status: 'connected',
      remotes: 1,
      bytes: 999,
    });
    const p = wait(2);
    let done = false;
    void p.then(() => {
      done = true;
    });
    await flush();
    expect(done).toBe(false);

    h.remotes = 2;
    await flush();
    await expect(p).resolves.toBeUndefined();
  });

  it('rejects when status becomes failed', async () => {
    const { h, wait, flush } = makeHarness({ status: 'joining' });
    const p = wait(1);
    h.status = 'failed';
    await flush();
    await expect(p).rejects.toThrow(/call failed/);
  });

  it('rejects on timeout', async () => {
    const { h, wait, flush } = makeHarness({
      status: 'connected',
      remotes: 0,
      bytes: 0,
    });
    const p = wait(1);
    h.now = 1500;
    await flush();
    await expect(p).rejects.toThrow(/timeout waiting for 1 remotes/);
  });

  it('rejects when getBytesReceived throws', async () => {
    const wait = createWaitUntilConnected({
      getStatus: () => 'connected',
      getRemoteCount: () => 1,
      getBytesReceived: async () => {
        throw new Error('stats boom');
      },
      now: () => 0,
      setIntervalFn: ((cb: TimerCb) => {
        cb();
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: ((() => undefined) as unknown) as typeof clearInterval,
      timeoutMs: 1000,
      intervalMs: 10,
    });
    await expect(wait(1)).rejects.toThrow(/stats boom/);
  });

  it('clears interval after settle (no double resolve)', async () => {
    const { h, wait, flush } = makeHarness({
      status: 'connected',
      remotes: 0,
      bytes: 0,
    });
    const p = wait(0);
    await flush();
    await expect(p).resolves.toBeUndefined();
    expect(h.intervals).toHaveLength(0);
    h.status = 'failed';
    await flush();
  });
});
