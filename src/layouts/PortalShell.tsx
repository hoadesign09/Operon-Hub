'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconApps,
  IconBriefcase,
  IconBuilding,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconCalendarStats,
  IconCalendarTime,
  IconCar,
  IconCash,
  IconChecklist,
  IconChevronRight,
  IconClockCheck,
  IconClockHour8,
  IconCreditCard,
  IconDeviceLaptop,
  IconDevices,
  IconFileCertificate,
  IconFileDescription,
  IconGitBranch,
  IconHeadset,
  IconHierarchy2,
  IconIdBadge2,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconListCheck,
  IconLogout,
  IconMenu2,
  IconReceipt2,
  IconRefresh,
  IconSettings,
  IconShieldLock,
  IconSpeakerphone,
  IconSparkles,
  IconUserCircle,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { LanguageSwitcher } from '@/components/portal/LanguageSwitcher';
import { NotificationBell } from '@/components/portal/NotificationBell';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { QuickTimerWidget } from '@/components/projects/QuickTimerWidget';
import { useI18n } from '@/shared/i18n/I18nContext';
import {
  buildDualRailGroups,
  getUserInitials,
  resolveActiveRailKey,
  resolvePageContextLabel,
  type PortalRailKey,
} from './portal-navigation';

function renderRailIcon(key: PortalRailKey) {
  switch (key) {
    case 'workspace':
      return <IconLayoutDashboard size={19} />;
    case 'services':
      return <IconApps size={19} />;
    case 'projects':
      return <IconLayoutKanban size={19} />;
    case 'hrm':
      return <IconUsers size={19} />;
    case 'admin':
      return <IconSettings size={19} />;
    case 'crm':
      return <IconBriefcase size={19} />;
  }
}

function renderNavItemIcon(href: string) {
  if (href === '/dashboard') return <IconLayoutDashboard size={17} />;
  if (href === '/services') return <IconApps size={17} />;
  if (href.includes('services/it-requests')) return <IconHeadset size={17} />;
  if (href.includes('services/proposals')) return <IconFileDescription size={17} />;
  if (href.includes('services/payments')) return <IconCreditCard size={17} />;
  if (href.includes('services/car-booking')) return <IconCar size={17} />;
  if (href === '/projects/dashboard') return <IconLayoutDashboard size={17} />;
  if (href === '/projects') return <IconLayoutKanban size={17} />;
  if (href === '/projects/workload') return <IconUsers size={17} />;
  if (href === '/projects/timesheets') return <IconClockHour8 size={17} />;
  if (href === '/projects/templates') return <IconFileDescription size={17} />;
  if (href.includes('my/profile')) return <IconUserCircle size={17} />;
  if (href.includes('my/tasks')) return <IconListCheck size={17} />;
  if (href.includes('my/requests')) return <IconCalendarEvent size={17} />;
  if (href.includes('my/attendance')) return <IconClockCheck size={17} />;
  if (href.includes('my/payslips')) return <IconReceipt2 size={17} />;
  if (href.includes('my/assets')) return <IconDevices size={17} />;
  if (href.includes('hrm/attendance')) return <IconClockHour8 size={17} />;
  if (href.includes('hrm/payroll')) return <IconCash size={17} />;
  if (href.includes('hrm/office/assets')) return <IconDeviceLaptop size={17} />;
  if (href.includes('hrm/office/meeting-rooms')) return <IconCalendarTime size={17} />;
  if (href.includes('hrm/office/announcements')) return <IconSpeakerphone size={17} />;
  if (href.includes('hrm/requests')) return <IconCalendarStats size={17} />;
  if (href.includes('hrm/contracts')) return <IconFileCertificate size={17} />;
  if (href.includes('hrm/employees')) return <IconIdBadge2 size={17} />;
  if (href.includes('organization')) return <IconHierarchy2 size={17} />;
  if (href.includes('approvals')) return <IconChecklist size={17} />;
  if (href.includes('workflows')) return <IconGitBranch size={17} />;
  if (href.includes('branches')) return <IconBuilding size={17} />;
  if (href.includes('users-roles')) return <IconUsers size={17} />;
  return <IconShieldLock size={17} />;
}

function PortalLoadingView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080E1A] p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-[#0F172A] p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-blue-600/40" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-700" />
            <div className="h-3 w-44 animate-pulse rounded bg-slate-800" />
          </div>
        </div>
        <div className="h-24 animate-pulse rounded-xl bg-slate-800/70" />
      </div>
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { locale, t, ln } = useI18n();
  const {
    user,
    modules,
    isLoading,
    error,
    selectedBranchId,
    setSelectedBranchId,
    refreshSession,
    logout,
  } = usePortalAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [manualRail, setManualRail] = useState<{
    pathname: string;
    railKey: PortalRailKey;
  } | null>(null);

  if (isLoading) {
    return <PortalLoadingView />;
  }

  if (error || !user) {
    const resolvedAuthError =
      error === '__SESSION_LOAD_ERROR__'
        ? t('common.sessionLoadError')
        : error === '__AUTH_SERVER_ERROR__'
          ? t('common.authServerError')
          : error ?? t('common.invalidSession');

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEF2F6] p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-700">{resolvedAuthError}</p>
          <button
            type="button"
            onClick={() => void refreshSession()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>{t('common.retry')}</span>
          </button>
        </div>
      </div>
    );
  }

  const railGroups = buildDualRailGroups(modules, locale);
  const routeRailKey = resolveActiveRailKey(pathname);
  const preferredRailKey =
    manualRail && manualRail.pathname === pathname ? manualRail.railKey : routeRailKey;
  const activeGroup =
    railGroups.find((group) => group.key === preferredRailKey) ?? railGroups[0];
  const pageContext = resolvePageContextLabel(pathname, railGroups, locale);
  const primaryRoleName =
    ln(user.roles[0]?.name, user.roles[0]?.nameEn) || t('common.user');
  const userInitials = getUserInitials(user.fullName);
  const isProfileActive = pathname === '/my/profile' || pathname.startsWith('/my/profile/');

  function handleSelectRail(railKey: PortalRailKey) {
    setManualRail({ pathname, railKey });
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
  }

  return (
    <div className="flex min-h-screen bg-[#EEF2F6] text-slate-900">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Dual-Rail Midnight Command Navigation */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 lg:shadow-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Rail 1: Deep Navy Module App Switcher (68px) + Compact User Avatar */}
        <div className="flex w-[68px] shrink-0 flex-col items-center justify-between border-r border-slate-800/80 bg-[#080E1A] py-4 text-slate-400">
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              title={t('app.homeTitle')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.03]"
            >
              <IconBuildingSkyscraper size={21} />
            </Link>

            <div className="h-px w-8 bg-slate-800" />

            <div className="flex flex-col items-center gap-2">
              {railGroups.map((group) => {
                const isSelected = activeGroup?.key === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => handleSelectRail(group.key)}
                    title={group.title}
                    className={`relative flex h-12 w-12 flex-col items-center justify-center rounded-xl transition ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/35'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    {renderRailIcon(group.key)}
                    <span className="mt-0.5 text-[9px] font-semibold tracking-wider uppercase">
                      {group.shortLabel}
                    </span>
                    {group.isComingSoon && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#080E1A]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact User Avatar -> Links directly to Personal Profile & Account Hub */}
          <Link
            href="/my/profile"
            onClick={() => setIsMobileMenuOpen(false)}
            title={t('shell.avatarTooltip', { name: user.fullName, role: primaryRoleName })}
            aria-label={t('shell.avatarAria', { name: user.fullName })}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-bold tracking-wide text-white shadow-md transition hover:scale-105 ${
              isProfileActive
                ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-[#080E1A]'
                : 'ring-2 ring-white/15 hover:ring-cyan-400/70'
            }`}
          >
            <span>{userInitials}</span>
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#080E1A]" />
          </Link>
        </div>

        {/* Rail 2: Clean Full-Height Dark Slate Sub-Menu Panel (236px) */}
        <aside className="flex w-[236px] shrink-0 flex-col border-r border-slate-800/90 bg-[#0F172A] text-slate-200">
          <div className="flex h-16 items-center justify-between border-b border-slate-800/90 px-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-widest text-cyan-400 uppercase">
                {t('app.commandBrand')}
              </div>
              <div className="truncate text-sm font-bold text-white" title={activeGroup?.title}>
                {activeGroup?.title ?? 'Operon Hub'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label={t('common.closeMenu')}
            >
              <IconX size={18} />
            </button>
          </div>

          <div className="border-b border-slate-800/60 px-4 py-2.5 text-[11px] text-slate-400">
            {activeGroup?.subtitle}
          </div>

          <nav className="midnight-scroll flex-1 space-y-1 overflow-y-auto p-3">
            {activeGroup?.isComingSoon ? (
              <div className="rounded-xl border border-cyan-500/20 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                  <IconSparkles size={16} />
                  <span>{t('nav.crmComingSoon.badge')}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {t('nav.crmComingSoon.desc')}
                </p>
              </div>
            ) : (
              activeGroup?.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' &&
                    item.href !== '/services' &&
                    item.href !== '/projects' &&
                    pathname.startsWith(`${item.href}/`)) ||
                  (item.href === '/projects' &&
                    pathname.startsWith('/projects/') &&
                    !pathname.startsWith('/projects/dashboard') &&
                    !pathname.startsWith('/projects/workload') &&
                    !pathname.startsWith('/projects/timesheets') &&
                    !pathname.startsWith('/projects/templates'));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                      isActive
                        ? 'bg-white/10 text-white shadow-xs ring-1 ring-white/15'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>
                        {renderNavItemIcon(item.href)}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.isComingSoon && (
                      <span className="shrink-0 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-300 uppercase">
                        {t('nav.badge.soon')}
                      </span>
                    )}
                  </Link>
                );
              })
            )}
          </nav>
        </aside>
      </div>

      {/* Main High-Contrast Light Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label={t('common.openMenu')}
            >
              <IconMenu2 size={19} />
            </button>
            <div className="min-w-0">
              <div className="hidden items-center gap-1.5 text-[11px] font-medium text-slate-400 sm:flex">
                <span>{pageContext.groupTitle}</span>
                <IconChevronRight size={12} />
                <span className="text-slate-600">{pageContext.itemLabel}</span>
              </div>
              <div className="truncate text-sm font-bold text-slate-900 sm:text-[15px]">
                {pageContext.itemLabel}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="hidden rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 xl:inline-flex">
              {t('common.scope')}: <strong className="ml-1 text-slate-900">{user.dataScope}</strong>
            </span>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span className="hidden md:inline">{t('common.branch')}:</span>
              <select
                value={selectedBranchId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranchId(val ? Number(val) : null);
                }}
                className="max-w-[140px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white sm:max-w-none sm:px-3"
              >
                {user.hasAllBranches && <option value="">{t('common.allBranches')}</option>}
                {user.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {ln(branch.name, branch.nameEn)} ({branch.code})
                  </option>
                ))}
              </select>
            </label>

            <QuickTimerWidget />

            <LanguageSwitcher variant="light" />

            <NotificationBell />

            <div className="hidden h-5 w-px bg-slate-200 sm:block" />

            {/* Standard Enterprise Top-Right Logout Action */}
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              title={t('shell.logoutTitle')}
              aria-label={t('common.logout')}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold whitespace-nowrap text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 sm:px-3"
            >
              <IconLogout size={16} />
              <span className="hidden sm:inline">
                {isLoggingOut ? t('common.loggingOut') : t('common.logout')}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
