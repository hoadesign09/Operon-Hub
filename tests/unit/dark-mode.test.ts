import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildThemeInitScript,
  normalizeThemeMode,
  resolveThemeMode,
  SUPPORTED_THEME_MODES,
  toggleThemeMode,
} from '@/lib/portable/theme-mode';
import { enDictionary } from '@/shared/i18n/dictionaries/en';
import { viDictionary } from '@/shared/i18n/dictionaries/vi';
import { APP_THEME_STORAGE_KEY, DEFAULT_APP_THEME_MODE } from '@/shared/theme/config';

const ROOT_DIR = process.cwd();

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

describe('Dark Mode (Precision Grid) — Portable Engine, Tokens & Integration', () => {
  it('normalizes, resolves, and toggles theme modes deterministically', () => {
    expect(SUPPORTED_THEME_MODES).toEqual(['light', 'dark', 'system']);
    expect(normalizeThemeMode('dark')).toBe('dark');
    expect(normalizeThemeMode('  SYSTEM ')).toBe('system');
    expect(normalizeThemeMode('invalid', 'light')).toBe('light');
    expect(normalizeThemeMode(null, 'dark')).toBe('dark');

    expect(resolveThemeMode('light', true)).toBe('light');
    expect(resolveThemeMode('dark', false)).toBe('dark');
    expect(resolveThemeMode('system', true)).toBe('dark');
    expect(resolveThemeMode('system', false)).toBe('light');

    expect(toggleThemeMode('light')).toBe('dark');
    expect(toggleThemeMode('dark')).toBe('light');
  });

  it('builds a valid anti-FOUC bootstrap script targeting the app storage key', () => {
    const script = buildThemeInitScript({
      storageKey: APP_THEME_STORAGE_KEY,
      defaultMode: DEFAULT_APP_THEME_MODE,
    });

    expect(script).toContain(JSON.stringify(APP_THEME_STORAGE_KEY));
    expect(script).toContain('prefers-color-scheme: dark');
    expect(script).toContain('classList.add("dark")');
    expect(script).toContain('data-color-mode');
    expect(script).toContain('colorScheme');
  });

  it('defines Tailwind v4 dark custom-variant, dark tokens, dark skeleton shimmer & print light reset', () => {
    const css = readProjectFile('src/app/globals.css');

    expect(css).toContain('@custom-variant dark (&:where(.dark, .dark *));');
    expect(css).toContain('html.dark {');
    expect(css).toContain('--pg-canvas: #0d1117;');
    expect(css).toContain('--pg-surface: #161b22;');
    expect(css).toContain('--pg-primary-text: #6ea8fe;');
    expect(css).toContain('html.dark .pg-skeleton');
    expect(css).toContain('html.dark .portal-precision-grid');
    expect(css).toContain('@media print');
  });

  it('wires anti-FOUC script, suppressHydrationWarning, ThemeProvider & ThemeToggle in layout, shell, and login', () => {
    const layoutSrc = readProjectFile('src/app/layout.tsx');
    const shellSrc = readProjectFile('src/layouts/PortalShell.tsx');
    const loginSrc = readProjectFile('src/app/login/page.tsx');

    expect(layoutSrc).toContain('suppressHydrationWarning');
    expect(layoutSrc).toContain('buildThemeInitScript');
    expect(layoutSrc).toContain('<ThemeProvider>');
    expect(shellSrc).toContain('<ThemeToggle');
    expect(loginSrc).toContain('<ThemeToggle');
  });

  it('provides complete bilingual VI/EN i18n keys for dark mode controls', () => {
    const themeKeys = [
      'common.theme',
      'common.switchThemeAria',
      'common.themeLight',
      'common.themeDark',
      'common.themeSystem',
      'common.switchToDark',
      'common.switchToLight',
    ] as const;

    for (const key of themeKeys) {
      expect(viDictionary[key]).toBeTruthy();
      expect(enDictionary[key]).toBeTruthy();
    }
  });
});
