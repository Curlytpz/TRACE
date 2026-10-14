export type ThemePreference = 'system' | 'light' | 'dark';

const storageKey = 'trace-theme';

export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch { return 'system'; }
}

export function resolveTheme(preference: ThemePreference, systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches) {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

export function applyTheme(preference: ThemePreference, persist = true) {
  const effectiveTheme = resolveTheme(preference);
  document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
  document.documentElement.dataset.theme = effectiveTheme;
  if (persist) {
    try { localStorage.setItem(storageKey, preference); } catch { /* Browser storage may be unavailable. */ }
  }
  return effectiveTheme;
}
