import { textSizeSchema, themeSchema, type TextSize, type Theme } from '@pace/shared';

// Stored per browser until accounts exist (phase 2); then synced to UserPreferences.
// Keys must match public/preferences-init.js.
const KEYS = { theme: 'pace.theme', textSize: 'pace.textSize' } as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the setting still applies for this visit.
  }
}

export function getTheme(): Theme {
  return themeSchema.catch('system').parse(read(KEYS.theme));
}

export function getTextSize(): TextSize {
  return textSizeSchema.catch('medium').parse(read(KEYS.textSize));
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && darkQuery().matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  write(KEYS.theme, theme);
  applyTheme(theme);
}

export function setTextSize(size: TextSize) {
  write(KEYS.textSize, size);
  document.documentElement.dataset.textSize = size;
}

/** Keeps "system" in sync when the OS switches between light and dark. */
export function watchSystemTheme(): () => void {
  const query = darkQuery();
  const onChange = () => {
    if (getTheme() === 'system') applyTheme('system');
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
