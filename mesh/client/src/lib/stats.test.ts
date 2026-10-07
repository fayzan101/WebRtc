import { describe, expect, it } from 'vitest';
import {
  bitrateBps,
  emptySnapshot,
  lossRatio,
  sampleFromSnapshots,
} from './stats';

describe('bitrateBps', () => {
  it('computes bits per second from byte deltas', () => {
    // 1000 bytes over 1s => 8000 bps
    expect(bitrateBps(2000, 1000, 2000, 1000)).toBe(8000);
  });

  it('returns 0 for non-positive dt or negative deltas clamped', () => {
    expect(bitrateBps(100, 100, 1000, 1000)).toBe(0);
    expect(bitrateBps(50, 100, 2000, 1000)).toBe(0);
  });
});

describe('lossRatio', () => {
  it('computes loss fraction', () => {
    expect(lossRatio(5, 95)).toBeCloseTo(0.05);
  });

  it('returns 0 when no packets', () => {
    expect(lossRatio(0, 0)).toBe(0);
  });

  it('clamps negative inputs', () => {
    expect(lossRatio(-1, 10)).toBe(0);
  });
});

describe('sampleFromSnapshots', () => {
  it('builds a schema-compatible sample', () => {
    const prev = emptySnapshot(1000);
    const next = {
      ...emptySnapshot(3000),
      bytesSent: 2000,
      bytesReceived: 4000,
      packetsReceived: 100,
      packetsLost: 5,
      rttSeconds: 0.02,
      jitterSeconds: 0.004,
    };
    const sample = sampleFromSnapshots(prev, next, 2, 2);
    expect(sample.remoteCount).toBe(2);
    expect(sample.pcCount).toBe(2);
    expect(sample.uplinkBitrateBps).toBe(8000);
    expect(sample.downlinkBitrateBps).toBe(16000);
    expect(sample.rttMs).toBeCloseTo(20);
    expect(sample.jitterMs).toBeCloseTo(4);
    expect(sample.lossRatio).toBeCloseTo(5 / 105);
  });
});
