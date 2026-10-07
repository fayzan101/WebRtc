export type ThemeId = 'obsidian-glass' | 'blue-steel';

const STORAGE_KEY = 'mesh-call-theme';

export function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'obsidian-glass' || raw === 'blue-steel') return raw;
  } catch {
    // private mode / blocked storage
  }
  return 'obsidian-glass';
}

export function persistTheme(theme: ThemeId) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function applyThemeToDocument(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme);
}
