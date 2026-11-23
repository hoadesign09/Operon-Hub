import { normalizeLocale } from '@/lib/portable/i18n-engine';

export const SUPPORTED_LOCALES = ['vi', 'en'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'vi';

export const LOCALE_COOKIE_NAME = 'operon_locale';
export const LOCALE_STORAGE_KEY = 'operon_locale';
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export const LOCALE_LABELS: Record<AppLocale, { short: string; native: string }> = {
  vi: { short: 'VI', native: 'Tiếng Việt' },
  en: { short: 'EN', native: 'English' },
};

export function resolveAppLocale(rawLocale: string | null | undefined): AppLocale {
  return normalizeLocale(rawLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE);
}
