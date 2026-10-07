import type { ThemeId } from '../lib/theme';

type Props = {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
};

export function ThemeSwitcher({ theme, onChange }: Props) {
  return (
    <div
      id="theme-switcher"
      className="theme-switcher"
      role="group"
      aria-label="Accent theme"
    >
      <button
        type="button"
        id="theme-obsidian-glass"
        className={`theme-chip ${theme === 'obsidian-glass' ? 'active' : ''}`}
        aria-pressed={theme === 'obsidian-glass'}
        onClick={() => onChange('obsidian-glass')}
      >
        <span className="theme-swatch swatch-a" aria-hidden />
        Obsidian Glass
      </button>
      <button
        type="button"
        id="theme-blue-steel"
        className={`theme-chip ${theme === 'blue-steel' ? 'active' : ''}`}
        aria-pressed={theme === 'blue-steel'}
        onClick={() => onChange('blue-steel')}
      >
        <span className="theme-swatch swatch-b" aria-hidden />
        Blue Steel
      </button>
    </div>
  );
}
