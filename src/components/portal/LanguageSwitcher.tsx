'use client';

import { IconWorld } from '@tabler/icons-react';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@/shared/i18n/config';
import { useI18n } from '@/shared/i18n/I18nContext';

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark';
  showIcon?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  variant = 'light',
  showIcon = true,
  className = '',
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  const containerCls =
    variant === 'dark'
      ? 'inline-flex h-9 items-center gap-1 rounded-xl border border-white/15 bg-white/8 p-1 backdrop-blur-xs'
      : 'inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1';
      
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
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
            : isActive
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900';

        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={isActive}
            title={meta.native}
            className={`rounded-lg px-2 py-1 text-[11px] font-bold tracking-wide transition ${buttonCls}`}
          >
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}
