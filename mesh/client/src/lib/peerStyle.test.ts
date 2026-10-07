import { describe, expect, it } from 'vitest';
import { formatBytes, peerHue } from './peerStyle';

describe('peerStyle', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4 MB');
  });

  it('hashes peer ids to stable hues', () => {
    expect(peerHue('p1')).toBe(peerHue('p1'));
    expect(peerHue('p1')).not.toBe(peerHue('p2'));
  });
});
