import { describe, expect, it } from 'vitest';
import { iceServersFromSearch, readQueryDefaults } from './mesh';
import { formatBitrate } from './automation';

describe('readQueryDefaults', () => {
  it('parses automation query params', () => {
    expect(readQueryDefaults('?roomId=lab&peerId=p3&autojoin=1&video=1&stun=1')).toEqual({
      roomId: 'lab',
      peerId: 'p3',
      autojoin: true,
      video: true,
      stun: true,
    });
  });

  it('defaults flags to false and ids empty', () => {
    expect(readQueryDefaults('')).toEqual({
      roomId: '',
      peerId: '',
      autojoin: false,
      video: false,
      stun: false,
    });
  });
});

describe('iceServersFromSearch', () => {
  it('returns STUN when stun=1', () => {
    const servers = iceServersFromSearch('?stun=1');
    expect(servers).toHaveLength(1);
    expect(servers[0]?.urls).toContain('stun:');
  });

  it('returns empty ICE servers on LAN default', () => {
    expect(iceServersFromSearch('')).toEqual([]);
  });
});

describe('formatBitrate', () => {
  it('formats bps / kbps / Mbps', () => {
    expect(formatBitrate(0)).toBe('0 kbps');
    expect(formatBitrate(500)).toBe('500 bps');
    expect(formatBitrate(12_500)).toBe('12.5 kbps');
    expect(formatBitrate(2_500_000)).toBe('2.50 Mbps');
  });
});
