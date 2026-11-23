'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TranslationParams } from '@/lib/portable/i18n-engine';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  resolveAppLocale,
  type AppLocale,
} from './config';
import { translateApp, type TranslationKey } from './translator';

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (nextLocale: AppLocale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  tr: (vi: string, en: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function persistClientLocale(locale: AppLocale): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    document.documentElement.lang = locale;
    document.title = translateApp(locale, 'app.title');
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage quota or privacy mode restrictions
    }
  }
}

export function I18nProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  initialLocale?: AppLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(() => resolveAppLocale(initialLocale));

  const setLocale = useCallback((nextLocale: AppLocale) => {
    const normalized = resolveAppLocale(nextLocale);
    setLocaleState(normalized);
    persistClientLocale(normalized);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: AppLocale = prev === 'vi' ? 'en' : 'vi';
      persistClientLocale(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key !== LOCALE_STORAGE_KEY || !event.newValue) {
        return;
      }
      const synced = resolveAppLocale(event.newValue);
      setLocaleState(synced);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = synced;
        document.title = translateApp(synced, 'app.title');
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translateApp(locale, key, params),
    [locale],
  );

  const tr = useCallback(
    (vi: string, en: string) => (locale === 'en' ? en : vi),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
      tr,
    }),
    [locale, setLocale, toggleLocale, t, tr],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider.');
  }
  return ctx;
}
