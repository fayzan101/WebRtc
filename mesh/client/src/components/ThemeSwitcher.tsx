import type { ThemeId } from '../lib/theme';

type Props = {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
};

/** Compact swatch control — no marketing theme names in the UI. */
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
        className={`theme-swatch swatch-a ${theme === 'obsidian-glass' ? 'active' : ''}`}
        aria-pressed={theme === 'obsidian-glass'}
        aria-label="Default dark theme"
        title="Default"
        onClick={() => onChange('obsidian-glass')}
      />
      <button
        type="button"
        id="theme-blue-steel"
        className={`theme-swatch swatch-b ${theme === 'blue-steel' ? 'active' : ''}`}
        aria-pressed={theme === 'blue-steel'}
        aria-label="Cool blue theme"
        title="Cool"
        onClick={() => onChange('blue-steel')}
      />
    </div>
  );
}
