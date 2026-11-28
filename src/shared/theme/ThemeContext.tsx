'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  normalizeThemeMode,
  resolveThemeMode,
  toggleThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from '@/lib/portable/theme-mode';
import { APP_THEME_STORAGE_KEY, DEFAULT_APP_THEME_MODE } from './config';

export { APP_THEME_STORAGE_KEY, DEFAULT_APP_THEME_MODE };

const THEME_CHANGE_EVENT = 'operon-hub-theme-change';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  isMounted: boolean;
  setThemeMode: (nextMode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeHydration(): () => void {
  return () => {};
}

function getHydrationSnapshot(): boolean {
  return true;
}

function getHydrationServerSnapshot(): boolean {
  return false;
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getSystemServerSnapshot(): boolean {
  return false;
}

function subscribeSystemTheme(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function readStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_THEME_MODE;
  }
  try {
    return normalizeThemeMode(
      window.localStorage.getItem(APP_THEME_STORAGE_KEY),
      DEFAULT_APP_THEME_MODE,
    );
  } catch {
    return DEFAULT_APP_THEME_MODE;
  }
}

function getStoredThemeServerSnapshot(): ThemeMode {
  return DEFAULT_APP_THEME_MODE;
}

function subscribeStoredTheme(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === APP_THEME_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', handleStorage);
  };
}

function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.setAttribute('data-color-mode', resolved);
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const isMounted = useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getHydrationServerSnapshot,
  );
  const mode = useSyncExternalStore(
    subscribeStoredTheme,
    readStoredThemeMode,
    getStoredThemeServerSnapshot,
  );
  const prefersDark = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemPrefersDark,
    getSystemServerSnapshot,
  );

  const resolvedTheme = useMemo(
    () => resolveThemeMode(mode, prefersDark),
    [mode, prefersDark],
  );

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    const normalized = normalizeThemeMode(nextMode, DEFAULT_APP_THEME_MODE);
    try {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage quota/privacy errors
    }
    applyThemeToDocument(resolveThemeMode(normalized, getSystemPrefersDark()));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = toggleThemeMode(resolvedTheme);
    setThemeMode(next);
  }, [resolvedTheme, setThemeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      isMounted,
      setThemeMode,
      toggleTheme,
    }),
    [mode, resolvedTheme, isMounted, setThemeMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
