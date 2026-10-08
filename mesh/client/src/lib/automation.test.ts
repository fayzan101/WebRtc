import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  formatBitrate,
  installAutomationApi,
  shouldAutojoin,
  uninstallAutomationApi,
} from './automation';
import type { StatsSample } from './types';

beforeAll(() => {
  // Vitest node env — expose a window global for installAutomationApi
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      configurable: true,
      writable: true,
    });
  }
});

const emptyStats = (): StatsSample => ({
  ts: 1,
  remoteCount: 0,
  uplinkBitrateBps: 0,
  downlinkBitrateBps: 0,
  rttMs: 0,
  jitterMs: 0,
  lossRatio: 0,
  bytesSent: 0,
  bytesReceived: 0,
  pcCount: 0,
});

describe('shouldAutojoin', () => {
  it('requires autojoin=1 plus room and peer', () => {
    expect(shouldAutojoin('?autojoin=1')).toBe(false);
    expect(shouldAutojoin('?autojoin=1&roomId=r')).toBe(false);
    expect(shouldAutojoin('?autojoin=1&peerId=p1')).toBe(false);
    expect(shouldAutojoin('?autojoin=1&roomId=r&peerId=p1')).toBe(true);
  });

  it('accepts roomName/identity aliases', () => {
    expect(
      shouldAutojoin('?autojoin=1&roomName=lab&identity=alice'),
    ).toBe(true);
  });

  it('rejects autojoin=0 / missing flag', () => {
    expect(shouldAutojoin('?autojoin=0&roomId=r&peerId=p1')).toBe(false);
    expect(shouldAutojoin('?roomId=r&peerId=p1')).toBe(false);
  });

  it('trims whitespace-only ids as missing', () => {
    expect(shouldAutojoin('?autojoin=1&roomId=%20%20&peerId=p1')).toBe(false);
  });
});

describe('formatBitrate', () => {
  it('formats edge values', () => {
    expect(formatBitrate(0)).toBe('0 kbps');
    expect(formatBitrate(-5)).toBe('0 kbps');
    expect(formatBitrate(Number.NaN)).toBe('0 kbps');
    expect(formatBitrate(500)).toBe('500 bps');
    expect(formatBitrate(12_500)).toBe('12.5 kbps');
    expect(formatBitrate(2_500_000)).toBe('2.50 Mbps');
  });
});

describe('installAutomationApi / uninstallAutomationApi', () => {
  afterEach(() => {
    uninstallAutomationApi();
  });

  it('exposes live __webrtcReady getter', () => {
    let ready = false;
    installAutomationApi({
      getReady: () => ready,
      getStats: async () => emptyStats(),
      getDebug: () => ({
        peerId: 'p1',
        roomId: 'r',
        remoteCount: 0,
        pcCount: 0,
        status: 'idle',
        mode: 'mesh',
      }),
      getJoinTimeMs: () => null,
      waitUntilConnected: async () => {},
      leave: async () => {},
    });

    expect(window.__webrtcReady).toBe(false);
    ready = true;
    expect(window.__webrtcReady).toBe(true);
  });

  it('wires stats / debug / join time / leave / wait', async () => {
    const leave = vi.fn(async () => {});
    const waitUntilConnected = vi.fn(async () => {});
    installAutomationApi({
      getReady: () => true,
      getStats: async () => ({ ...emptyStats(), uplinkBitrateBps: 1000 }),
      getDebug: () => ({
        peerId: 'p2',
        roomId: 'lab',
        remoteCount: 1,
        pcCount: 1,
        status: 'connected',
        mode: 'mesh',
      }),
      getJoinTimeMs: () => 42,
      waitUntilConnected,
      leave,
    });

    await expect(window.__webrtcStats?.()).resolves.toMatchObject({
      uplinkBitrateBps: 1000,
    });
    expect(window.__meshDebug?.()).toMatchObject({
      peerId: 'p2',
      mode: 'mesh',
    });
    expect(window.__getJoinTimeMs?.()).toBe(42);
    await window.__waitUntilConnected?.(1);
    expect(waitUntilConnected).toHaveBeenCalledWith(1);
    await window.__leave?.();
    expect(leave).toHaveBeenCalled();
  });

  it('uninstall removes all hooks', () => {
    installAutomationApi({
      getReady: () => true,
      getStats: async () => emptyStats(),
      getDebug: () => ({
        peerId: 'p1',
        roomId: 'r',
        remoteCount: 0,
        pcCount: 0,
        status: 'idle',
        mode: 'mesh',
      }),
      getJoinTimeMs: () => null,
      waitUntilConnected: async () => {},
      leave: async () => {},
    });
    uninstallAutomationApi();
    expect(window.__webrtcReady).toBeUndefined();
    expect(window.__webrtcStats).toBeUndefined();
    expect(window.__meshDebug).toBeUndefined();
    expect(window.__waitUntilConnected).toBeUndefined();
    expect(window.__leave).toBeUndefined();
    expect(window.__getJoinTimeMs).toBeUndefined();
  });
});
