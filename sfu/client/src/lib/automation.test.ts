import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  formatBitrate,
  installAutomationApi,
  shouldAutojoin,
  uninstallAutomationApi,
} from './automation';
import type { StatsSample } from './types';

beforeAll(() => {
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

describe('shouldAutojoin (sfu)', () => {
  it('requires autojoin + room + identity aliases', () => {
    expect(shouldAutojoin('?autojoin=1&roomId=r&peerId=p1')).toBe(true);
    expect(shouldAutojoin('?autojoin=1&roomName=r&identity=p1')).toBe(true);
    expect(shouldAutojoin('?autojoin=1&roomId=r')).toBe(false);
  });
});

describe('formatBitrate (sfu)', () => {
  it('handles zero and Mbps', () => {
    expect(formatBitrate(0)).toBe('0 kbps');
    expect(formatBitrate(3_000_000)).toBe('3.00 Mbps');
  });
});

describe('installAutomationApi (sfu)', () => {
  afterEach(() => {
    uninstallAutomationApi();
  });

  it('exposes live ready + sfu debug mode', async () => {
    let ready = false;
    const leave = vi.fn(async () => {});
    installAutomationApi({
      getReady: () => ready,
      getStats: async () => emptyStats(),
      getDebug: () => ({
        identity: 'p1',
        roomName: 'lab',
        remoteCount: 0,
        status: 'idle',
        mode: 'sfu',
      }),
      getJoinTimeMs: () => 7,
      waitUntilConnected: async () => {},
      leave,
    });

    expect(window.__webrtcReady).toBe(false);
    ready = true;
    expect(window.__webrtcReady).toBe(true);
    expect(window.__sfuDebug?.().mode).toBe('sfu');
    expect(window.__getJoinTimeMs?.()).toBe(7);
    await window.__leave?.();
    expect(leave).toHaveBeenCalled();

    uninstallAutomationApi();
    expect(window.__sfuDebug).toBeUndefined();
    expect(window.__webrtcReady).toBeUndefined();
  });
});
