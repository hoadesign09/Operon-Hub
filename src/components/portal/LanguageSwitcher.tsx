'use client';

import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@/shared/i18n/config';
import { useI18n } from '@/shared/i18n/I18nContext';

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark';
  showIcon?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  variant = 'light',
  className = '',
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  const containerCls =
    variant === 'dark'
      ? 'inline-flex h-8 items-center gap-0.5 rounded border border-white/20 bg-white/10 p-0.5'
      : 'inline-flex h-8 items-center gap-0.5 rounded border border-[#BFC8D4] bg-[#EFF1F4] p-0.5 dark:border-[#384454] dark:bg-[#12171F]';

  return (
    <div
      role="group"
      aria-label={t('common.switchLanguageAria')}
      className={`${containerCls} ${className}`.trim()}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const isActive = locale === code;
        const meta = LOCALE_LABELS[code];
        const buttonCls =
          variant === 'dark'
            ? isActive
              ? 'bg-white text-[#1D4E89]'
              : 'text-slate-200 hover:bg-white/10 hover:text-white'
            : isActive
              ? 'border border-[#CFD6DF] bg-white text-[#1D4E89] dark:border-[#384454] dark:bg-[#1F2937] dark:text-[#6EA8FE]'
              : 'border border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100';

        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={isActive}
            title={meta.native}
            className={`rounded-xs px-2 py-0.5 text-[11px] font-bold tracking-wide transition ${buttonCls}`}
          >
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}
