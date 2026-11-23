import { createTranslator, type TranslationParams } from '@/lib/portable/i18n-engine';
import { DEFAULT_LOCALE, type AppLocale } from './config';
import { enDictionary } from './dictionaries/en';
import { viDictionary, type TranslationKey } from './dictionaries/vi';

const appTranslator = createTranslator<AppLocale, TranslationKey>(
  {
    vi: viDictionary,
    en: enDictionary,
  },
  { fallbackLocale: DEFAULT_LOCALE },
);

export function translateApp(
  locale: AppLocale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  return appTranslator.translate(locale, key, params);
}

const ENGLISH_SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatPeriodLabel(locale: AppLocale, month: number, year: number): string {
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month)));
  if (locale === 'en') {
    return `${ENGLISH_SHORT_MONTHS[safeMonth - 1]} ${year}`;
  }
  return `Tháng ${String(safeMonth).padStart(2, '0')}/${year}`;
}

export function formatMonthSelectOption(locale: AppLocale, month: number): string {
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month)));
  if (locale === 'en') {
    return ENGLISH_SHORT_MONTHS[safeMonth - 1];
  }
  return `Tháng ${safeMonth}`;
}

export type { TranslationKey };
