import { describe, expect, it } from 'vitest';
import { isPolitePeer, shouldCreateOffer } from './polite';

describe('polite peer rules', () => {
  it('treats lexicographically lower id as polite', () => {
    expect(isPolitePeer('p1', 'p2')).toBe(true);
    expect(isPolitePeer('p2', 'p1')).toBe(false);
    expect(isPolitePeer('alice', 'bob')).toBe(true);
  });

  it('makes the higher id create the offer', () => {
    expect(shouldCreateOffer('p2', 'p1')).toBe(true);
    expect(shouldCreateOffer('p1', 'p2')).toBe(false);
  });

  it('is antisymmetric for a pair', () => {
    expect(shouldCreateOffer('p1', 'p3')).toBe(!isPolitePeer('p1', 'p3'));
    expect(shouldCreateOffer('p3', 'p1')).toBe(!isPolitePeer('p3', 'p1'));
  });

  it('handles equal ids as not offerer / not polite-exclusive', () => {
    expect(isPolitePeer('p1', 'p1')).toBe(false);
    expect(shouldCreateOffer('p1', 'p1')).toBe(false);
  });
});
