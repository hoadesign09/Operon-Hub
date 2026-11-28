'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconBuildingSkyscraper,
  IconChecklist,
  IconEye,
  IconEyeOff,
  IconLogin,
  IconShieldCheck,
  IconUsersGroup,
} from '@tabler/icons-react';
import { LanguageSwitcher } from '@/components/portal/LanguageSwitcher';
import { ThemeToggle } from '@/components/portal/ThemeToggle';
import { useI18n } from '@/shared/i18n/I18nContext';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !json?.success) {
        setErrorMessage(json?.error?.message ?? t('login.failedError'));
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setErrorMessage(t('login.networkError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="portal-precision-grid grid min-h-screen grid-cols-1 bg-[#EFF1F4] lg:grid-cols-12">
      {/* Left Panel — Precision Grid Classic Steel Identity (Zero flashy gradients/blur orbs) */}
      <section className="hidden flex-col justify-between border-r border-[#CFD6DF] bg-[#1D4E89] p-10 text-white lg:col-span-6 lg:flex xl:col-span-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-white/25 bg-white/10 text-white">
            <IconBuildingSkyscraper size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest text-white/75 uppercase">
              {t('app.commandBrand')}
            </p>
            <p className="text-lg font-bold tracking-tight text-white">Operon Hub</p>
          </div>
        </div>

        <div className="max-w-xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-xs border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
            {t('login.badge')}
          </div>
          <h1 className="text-3xl font-bold leading-snug tracking-tight text-white">
            {t('login.heroTitle')}
          </h1>
          <p className="text-sm leading-relaxed text-white/80">{t('login.heroDesc')}</p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              {
                icon: IconUsersGroup,
                title: t('login.feature.hrmTitle'),
                desc: t('login.feature.hrmDesc'),
              },
              {
                icon: IconChecklist,
                title: t('login.feature.approvalTitle'),
                desc: t('login.feature.approvalDesc'),
              },
              {
                icon: IconShieldCheck,
                title: t('login.feature.rbacTitle'),
                desc: t('login.feature.rbacDesc'),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded border border-white/20 bg-[#163D6B] p-3.5"
                >
                  <Icon size={18} className="text-white/90" />
                  <p className="mt-2 text-xs font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/75">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/15 pt-4 text-xs text-white/70">
          {t('login.footer')}
        </div>
      </section>

      {/* Right Panel — Crisp Bordered Precision Grid Login Card */}
      <section className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-8 lg:col-span-6 xl:col-span-5">
        <div className="absolute top-4 right-4 flex items-center gap-2 sm:top-6 sm:right-6">
          <ThemeToggle variant="light" />
          <LanguageSwitcher variant="light" />
        </div>

        <div className="w-full max-w-md rounded border border-[#CFD6DF] bg-white">
          <div className="border-b border-[#DCE2EA] bg-[#F8F9FB] px-6 py-4">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#1D4E89] text-white">
                <IconBuildingSkyscraper size={18} />
              </div>
              <span className="text-sm font-bold text-slate-900">Operon Hub</span>
            </div>
            <span className="mt-2 block text-[10px] font-bold tracking-widest text-[#1D4E89] uppercase lg:mt-0">
              {t('login.eyebrow')}
            </span>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
              {t('login.welcome')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{t('login.subtitle')}</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded border border-red-300 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-800"
              >
                <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="mb-1 block text-[11px] font-semibold text-slate-700"
              >
                {t('login.emailLabel')}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@operonhub.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-[#BFC8D4] bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[#1D4E89]"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1 block text-[11px] font-semibold text-slate-700"
              >
                {t('login.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-[#BFC8D4] bg-white py-2 pr-9 pl-3 text-xs text-slate-900 outline-none transition focus:border-[#1D4E89]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded bg-[#1D4E89] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#163D6B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconLogin size={16} />
              <span>{isSubmitting ? t('login.submitting') : t('login.submit')}</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
