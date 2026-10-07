import { describe, expect, it } from 'vitest';
import { readQueryDefaults } from './query';
import { formatBitrate } from './automation';
import { bitrateBps, lossRatio, sampleFromSnapshots, emptySnapshot } from './stats';
import { shouldShowSplash } from '../components/SplashScreen';

describe('readQueryDefaults', () => {
  it('parses room/peer aliases and flags', () => {
    expect(
      readQueryDefaults('?roomName=lab&identity=p3&autojoin=1&video=1'),
    ).toEqual({
      roomId: 'lab',
      peerId: 'p3',
      autojoin: true,
      video: true,
    });
  });

  it('defaults empty', () => {
    expect(readQueryDefaults('')).toEqual({
      roomId: '',
      peerId: '',
      autojoin: false,
      video: false,
    });
  });
});

describe('stats helpers', () => {
  it('computes bitrate and loss', () => {
    expect(bitrateBps(2000, 1000, 2000, 1000)).toBe(8000);
    expect(lossRatio(1, 99)).toBeCloseTo(0.01);
  });

  it('builds sample from snapshots', () => {
    const prev = emptySnapshot(0);
    const next = {
      ...emptySnapshot(1000),
      bytesSent: 1000,
      bytesReceived: 2000,
      packetsReceived: 50,
      packetsLost: 0,
      rttSeconds: 0.01,
      jitterSeconds: 0.002,
    };
    const sample = sampleFromSnapshots(prev, next, 3, 1);
    expect(sample.remoteCount).toBe(3);
    expect(sample.pcCount).toBe(1);
    expect(sample.uplinkBitrateBps).toBe(8000);
    expect(formatBitrate(sample.uplinkBitrateBps)).toBe('8.0 kbps');
  });
});

describe('splash gate', () => {
  it('skips splash on autojoin', () => {
    expect(shouldShowSplash('?autojoin=1')).toBe(false);
    expect(shouldShowSplash('')).toBe(true);
  });
});
