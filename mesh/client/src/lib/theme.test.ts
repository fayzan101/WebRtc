import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { persistTheme, readStoredTheme } from './theme';
import { shouldShowSplash } from '../components/SplashScreen';

function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
}

describe('theme persistence', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    try {
      localStorage.removeItem('mesh-call-theme');
    } catch {
      // ignore
    }
  });

  it('defaults to obsidian-glass', () => {
    expect(readStoredTheme()).toBe('obsidian-glass');
  });

  it('persists and reads blue-steel', () => {
    persistTheme('blue-steel');
    expect(readStoredTheme()).toBe('blue-steel');
  });
});

describe('splash autojoin gate', () => {
  it('skips splash when autojoin=1', () => {
    expect(shouldShowSplash('?autojoin=1&roomId=lab&peerId=p1')).toBe(false);
  });

  it('shows splash otherwise', () => {
    expect(shouldShowSplash('')).toBe(true);
    expect(shouldShowSplash('?stun=1')).toBe(true);
  });
});
