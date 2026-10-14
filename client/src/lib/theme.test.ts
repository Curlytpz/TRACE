import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getThemePreference, resolveTheme } from './theme';

describe('theme preference', () => {
  const storage = new Map<string, string>();
  const classList = { toggle: vi.fn() };
  const dataset: Record<string, string> = {};

  beforeEach(() => {
    storage.clear();
    classList.toggle.mockClear();
    delete dataset.theme;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal('document', { documentElement: { classList, dataset } });
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses the operating-system preference when System is selected', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');

    expect(applyTheme('system')).toBe('dark');
    expect(classList.toggle).toHaveBeenCalledWith('dark', true);
    expect(dataset.theme).toBe('dark');
    expect(storage.get('trace-theme')).toBe('system');
  });

  it('keeps a saved System preference distinct from its effective appearance', () => {
    storage.set('trace-theme', 'system');

    expect(getThemePreference()).toBe('system');
    expect(applyTheme('system', false)).toBe('dark');
    expect(storage.get('trace-theme')).toBe('system');
  });
});
