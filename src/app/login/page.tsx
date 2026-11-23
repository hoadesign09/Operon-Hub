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
    <main className="grid min-h-screen grid-cols-1 bg-[#EEF2F6] lg:grid-cols-12">
      {/* Left Brand Panel — Midnight Command Identity */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#0C4A6E] p-12 text-white lg:col-span-6 lg:flex xl:col-span-7">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30">
            <IconBuildingSkyscraper size={24} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-cyan-300 uppercase">
              {t('app.commandBrand')}
            </p>
            <p className="text-lg font-bold tracking-tight text-white">Operon Hub</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-semibold text-cyan-300">
            {t('login.badge')}
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
            {t('login.heroTitle')}
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">{t('login.heroDesc')}</p>

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
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs"
                >
                  <Icon size={20} className="text-cyan-300" />
                  <p className="mt-2.5 text-xs font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400">{t('login.footer')}</div>
      </section>

      {/* Right Login Form Panel */}
      <section className="relative flex flex-col items-center justify-center px-4 py-12 sm:px-8 lg:col-span-6 xl:col-span-5">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <LanguageSwitcher variant="light" />
        </div>

        <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20 lg:hidden">
              <IconBuildingSkyscraper size={24} />
            </div>
            <span className="mt-3 text-[11px] font-bold tracking-widest text-blue-600 uppercase lg:mt-0">
              {t('login.eyebrow')}
            </span>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
              {t('login.welcome')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-7 space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
              >
                <IconAlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
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
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 py-2.5 pr-10 pl-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F172A] via-blue-700 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconLogin size={18} />
              <span>{isSubmitting ? t('login.submitting') : t('login.submit')}</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
