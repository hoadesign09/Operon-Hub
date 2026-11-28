/**
 * Pure theme mode utilities (light / dark / system) with zero-FOUC bootstrap script builder.
 *
 * Dependencies: None
 *
 * Input / Output:
 * - normalizeThemeMode(raw, fallback?) -> ThemeMode ('light' | 'dark' | 'system')
 * - resolveThemeMode(mode, prefersDark) -> ResolvedTheme ('light' | 'dark')
 * - toggleThemeMode(currentResolved) -> ResolvedTheme
 * - buildThemeInitScript(options?) -> string (inline <head> script)
 *
 * Example:
 * ```ts
 * const mode = normalizeThemeMode(localStorage.getItem('app-theme'));
 * const resolved = resolveThemeMode(mode, window.matchMedia('(prefers-color-scheme: dark)').matches);
 * ```
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME_STORAGE_KEY = 'app-theme-mode';
export const SUPPORTED_THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'] as const;

export interface ThemeInitScriptOptions {
  storageKey?: string;
  defaultMode?: ThemeMode;
  darkClassName?: string;
  attributeName?: string;
}

/**
 * Safely normalizes any unknown input into a valid ThemeMode.
 */
export function normalizeThemeMode(
  raw: unknown,
  fallback: ThemeMode = 'light',
): ThemeMode {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'light' || normalized === 'dark' || normalized === 'system') {
    return normalized;
  }
  return fallback;
}

/**
 * Resolves a ThemeMode into the effective light or dark palette.
 */
export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'dark') {
    return 'dark';
  }
  if (mode === 'light') {
    return 'light';
  }
  return prefersDark ? 'dark' : 'light';
}

/**
 * Flips the current resolved theme to the opposite palette.
 */
export function toggleThemeMode(currentResolved: ResolvedTheme): ResolvedTheme {
  return currentResolved === 'dark' ? 'light' : 'dark';
}

/**
 * Generates a compact inline script to apply the theme class on <html> before first paint (zero FOUC).
 */
export function buildThemeInitScript(options: ThemeInitScriptOptions = {}): string {
  const storageKey = JSON.stringify(options.storageKey ?? DEFAULT_THEME_STORAGE_KEY);
  const defaultMode = JSON.stringify(normalizeThemeMode(options.defaultMode, 'light'));
  const darkClassName = JSON.stringify(options.darkClassName ?? 'dark');
  const attributeName = JSON.stringify(options.attributeName ?? 'data-color-mode');

  return [
    '(function(){',
    'try{',
    `var k=${storageKey};`,
    `var d=${defaultMode};`,
    'var raw=window.localStorage.getItem(k);',
    'var m=(raw==="light"||raw==="dark"||raw==="system")?raw:d;',
    'var prefersDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;',
    'var r=m==="system"?(prefersDark?"dark":"light"):m;',
    'var el=document.documentElement;',
    `if(r==="dark"){el.classList.add(${darkClassName});}else{el.classList.remove(${darkClassName});}`,
    `el.setAttribute(${attributeName},r);`,
    'el.style.colorScheme=r;',
    '}catch(e){}',
    '})();',
  ].join('');
}
