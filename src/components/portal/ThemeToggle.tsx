'use client';

import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';
import type { ThemeMode } from '@/lib/portable/theme-mode';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useTheme } from '@/shared/theme/ThemeContext';

interface ThemeToggleProps {
  variant?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}

export function ThemeToggle({
  variant = 'light',
  compact = false,
  className = '',
}: ThemeToggleProps) {
  const { t } = useI18n();
  const { mode, isDark, isMounted, setThemeMode, toggleTheme } = useTheme();

  const activeMode: ThemeMode = isMounted ? mode : 'light';
  const effectiveDark = isMounted ? isDark : false;

  const containerCls =
    variant === 'dark'
      ? 'inline-flex h-8 items-center gap-0.5 rounded border border-white/20 bg-white/10 p-0.5'
      : 'inline-flex h-8 items-center gap-0.5 rounded border border-[#BFC8D4] bg-[#EFF1F4] p-0.5 dark:border-[#384454] dark:bg-[#12171F]';

  const singleBtnCls =
    variant === 'dark'
      ? 'inline-flex h-8 w-8 items-center justify-center rounded border border-white/20 bg-white/10 text-slate-100 transition hover:bg-white/20'
      : 'inline-flex h-8 w-8 items-center justify-center rounded border border-[#BFC8D4] bg-white text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:border-[#384454] dark:bg-[#161B22] dark:text-slate-200 dark:hover:bg-[#1C232E]';

  const options: ReadonlyArray<{
    value: ThemeMode;
    label: string;
    icon: typeof IconSun;
  }> = [
    { value: 'light', label: t('common.themeLight'), icon: IconSun },
    { value: 'dark', label: t('common.themeDark'), icon: IconMoon },
    { value: 'system', label: t('common.themeSystem'), icon: IconDeviceDesktop },
  ];

  const singleToggleLabel = effectiveDark
    ? t('common.switchToLight')
    : t('common.switchToDark');

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={singleToggleLabel}
        title={singleToggleLabel}
        className={`${singleBtnCls} ${className}`.trim()}
      >
        {effectiveDark ? <IconSun size={15} /> : <IconMoon size={15} />}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center ${className}`.trim()}>
      {/* Mobile single-click quick toggle to preserve 390px topbar width */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={singleToggleLabel}
        title={singleToggleLabel}
        className={`${singleBtnCls} sm:hidden`}
      >
        {effectiveDark ? <IconSun size={15} /> : <IconMoon size={15} />}
      </button>

      {/* Desktop Precision Grid 3-mode segmented switcher (Light / Dark / System) */}
      <div
        role="group"
        aria-label={t('common.switchThemeAria')}
        className={`hidden sm:inline-flex ${containerCls}`}
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeMode === opt.value;
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
              key={opt.value}
              type="button"
              onClick={() => setThemeMode(opt.value)}
              aria-pressed={isActive}
              aria-label={opt.label}
              title={opt.label}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-xs transition ${buttonCls}`}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
