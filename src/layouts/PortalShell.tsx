'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconApps,
  IconBuilding,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconCalendarStats,
  IconCalendarTime,
  IconCar,
  IconCash,
  IconChecklist,
  IconChevronDown,
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
import { ThemeToggle } from '@/components/portal/ThemeToggle';
import { QuickTimerWidget } from '@/components/projects/QuickTimerWidget';
import { SkeletonPortalShell } from '@/components/ui/Skeleton';
import { useI18n } from '@/shared/i18n/I18nContext';
import {
  buildDualRailGroups,
  getUserInitials,
  resolveActiveRailKey,
  resolvePageContextLabel,
  type PortalRailKey,
} from './portal-navigation';

function renderNavItemIcon(href: string) {
  if (href === '/dashboard') return <IconLayoutDashboard size={15} />;
  if (href === '/services') return <IconApps size={15} />;
  if (href.includes('services/it-requests')) return <IconHeadset size={15} />;
  if (href.includes('services/proposals')) return <IconFileDescription size={15} />;
  if (href.includes('services/payments')) return <IconCreditCard size={15} />;
  if (href.includes('services/car-booking')) return <IconCar size={15} />;
  if (href === '/projects/dashboard') return <IconLayoutDashboard size={15} />;
  if (href === '/projects') return <IconLayoutKanban size={15} />;
  if (href === '/projects/workload') return <IconUsers size={15} />;
  if (href === '/projects/timesheets') return <IconClockHour8 size={15} />;
  if (href === '/projects/templates') return <IconFileDescription size={15} />;
  if (href.includes('my/profile')) return <IconUserCircle size={15} />;
  if (href.includes('my/tasks')) return <IconListCheck size={15} />;
  if (href.includes('my/requests')) return <IconCalendarEvent size={15} />;
  if (href.includes('my/attendance')) return <IconClockCheck size={15} />;
  if (href.includes('my/payslips')) return <IconReceipt2 size={15} />;
  if (href.includes('my/assets')) return <IconDevices size={15} />;
  if (href.includes('hrm/attendance')) return <IconClockHour8 size={15} />;
  if (href.includes('hrm/payroll')) return <IconCash size={15} />;
  if (href.includes('hrm/office/assets')) return <IconDeviceLaptop size={15} />;
  if (href.includes('hrm/office/meeting-rooms')) return <IconCalendarTime size={15} />;
  if (href.includes('hrm/office/announcements')) return <IconSpeakerphone size={15} />;
  if (href.includes('hrm/requests')) return <IconCalendarStats size={15} />;
  if (href.includes('hrm/contracts')) return <IconFileCertificate size={15} />;
  if (href.includes('hrm/employees')) return <IconIdBadge2 size={15} />;
  if (href.includes('organization')) return <IconHierarchy2 size={15} />;
  if (href.includes('approvals')) return <IconChecklist size={15} />;
  if (href.includes('workflows')) return <IconGitBranch size={15} />;
  if (href.includes('branches')) return <IconBuilding size={15} />;
  if (href.includes('users-roles')) return <IconUsers size={15} />;
  return <IconShieldLock size={15} />;
}

function isNavItemActive(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    (href !== '/dashboard' &&
      href !== '/services' &&
      href !== '/projects' &&
      pathname.startsWith(`${href}/`)) ||
    (href === '/projects' &&
      pathname.startsWith('/projects/') &&
      !pathname.startsWith('/projects/dashboard') &&
      !pathname.startsWith('/projects/workload') &&
      !pathname.startsWith('/projects/timesheets') &&
      !pathname.startsWith('/projects/templates'))
  );
}

function PortalLoadingView() {
  return <SkeletonPortalShell />;
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
  const [collapsedGroups, setCollapsedGroups] = useState<Partial<Record<PortalRailKey, boolean>>>({
    crm: true,
  });

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
      <div className="portal-precision-grid flex min-h-screen items-center justify-center bg-[#EFF1F4] p-6">
        <div className="w-full max-w-md rounded border border-red-300 bg-white p-5 text-center">
          <p className="text-xs font-semibold text-red-700">{resolvedAuthError}</p>
          <button
            type="button"
            onClick={() => void refreshSession()}
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-[#1D4E89] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#163D6B]"
          >
            <IconRefresh size={14} />
            <span>{t('common.retry')}</span>
          </button>
        </div>
      </div>
    );
  }

  const navGroups = buildDualRailGroups(modules, locale, user.permissions, user.isSuperAdmin);
  const activeRailKey = resolveActiveRailKey(pathname);
  const pageContext = resolvePageContextLabel(pathname, navGroups, locale);
  const primaryRoleName =
    ln(user.roles[0]?.name, user.roles[0]?.nameEn) || t('common.user');
  const userInitials = getUserInitials(user.fullName);
  const isProfileActive = pathname === '/my/profile' || pathname.startsWith('/my/profile/');

  function toggleGroup(key: PortalRailKey) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
  }

  return (
    <div className="portal-precision-grid flex min-h-screen w-full bg-[#EFF1F4] text-slate-900">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Precision Grid (#5) Compact Tree-Style Single Left Sidebar (228px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[228px] shrink-0 flex-col border-r border-[#CFD6DF] bg-[#F8F9FB] text-slate-700 transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header (48px aligned with topbar) */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#CFD6DF] bg-white px-3.5">
          <Link
            href="/dashboard"
            onClick={() => setIsMobileMenuOpen(false)}
            title={t('app.homeTitle')}
            className="flex min-w-0 items-center gap-2.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#1D4E89] text-white">
              <IconBuildingSkyscraper size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold tracking-tight text-slate-900">
                Operon Hub
              </span>
              <span className="block truncate text-[10px] font-medium text-slate-500">
                {t('app.commandBrand')}
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label={t('common.closeMenu')}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Grouped Compact Tree Navigation */}
        <nav className="precision-scroll flex-1 overflow-y-auto px-2 py-2">
          {navGroups.map((group) => {
            const isGroupActive = group.key === activeRailKey;
            const isCollapsed = collapsedGroups[group.key] === true && !isGroupActive;

            return (
              <div key={group.key} className="mb-1.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[10px] font-bold tracking-wider text-slate-500 uppercase hover:bg-slate-200/60 hover:text-slate-800"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{group.title}</span>
                    {group.isComingSoon && (
                      <span className="rounded-xs border border-amber-300 bg-amber-50 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                        {t('nav.badge.soon')}
                      </span>
                    )}
                  </span>
                  {isCollapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
                </button>

                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.isComingSoon ? (
                      <div className="mx-1 rounded border border-[#CFD6DF] bg-white p-2.5 text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5 font-semibold text-[#1D4E89]">
                          <IconSparkles size={13} />
                          <span>{t('nav.crmComingSoon.badge')}</span>
                        </div>
                        <p className="mt-1 leading-relaxed text-slate-500">
                          {t('nav.crmComingSoon.desc')}
                        </p>
                      </div>
                    ) : (
                      group.items.map((item) => {
                        const isActive = isNavItemActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs transition ${
                              isActive
                                ? 'border-[#BDD2EC] bg-[#E6EEF8] font-semibold text-[#1D4E89]'
                                : 'border-transparent text-slate-700 hover:bg-slate-200/60 hover:text-slate-950'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={isActive ? 'text-[#1D4E89]' : 'text-slate-500'}>
                                {renderNavItemIcon(item.href)}
                              </span>
                              <span className="truncate">{item.label}</span>
                            </span>
                            {item.isComingSoon && (
                              <span className="shrink-0 rounded-xs border border-amber-300 bg-amber-50 px-1 py-0.2 text-[9px] font-bold text-amber-900 uppercase">
                                {t('nav.badge.soon')}
                              </span>
                            )}
                          </Link>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Compact Classic User Profile Footer */}
        <div className="shrink-0 border-t border-[#CFD6DF] bg-white p-2.5">
          <Link
            href="/my/profile"
            onClick={() => setIsMobileMenuOpen(false)}
            title={t('shell.avatarTooltip', { name: user.fullName, role: primaryRoleName })}
            aria-label={t('shell.avatarAria', { name: user.fullName })}
            className={`flex items-center gap-2.5 rounded border p-1.5 transition ${
              isProfileActive
                ? 'border-[#BDD2EC] bg-[#E6EEF8]'
                : 'border-transparent hover:border-[#CFD6DF] hover:bg-[#F8F9FB]'
            }`}
          >
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1D4E89] text-[11px] font-bold text-white">
              {userInitials}
              <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-900">
                {user.fullName}
              </span>
              <span className="block truncate text-[10px] text-slate-500">{primaryRoleName}</span>
            </span>
          </Link>
        </div>
      </aside>

      {/* Main Precision Grid Full-Width Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Dense 48px Utility Topbar */}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-[#CFD6DF] bg-white px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded border border-[#CFD6DF] bg-[#F8F9FB] p-1.5 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label={t('common.openMenu')}
            >
              <IconMenu2 size={16} />
            </button>
            <div className="min-w-0">
              <div className="hidden items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase sm:flex">
                <span>{pageContext.groupTitle}</span>
                <IconChevronRight size={11} />
                <span className="text-[#1D4E89]">{pageContext.itemLabel}</span>
              </div>
              <div className="truncate text-[13px] font-bold text-slate-900">
                {pageContext.itemLabel}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <label className="flex items-center text-xs text-slate-600">
              <select
                value={selectedBranchId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranchId(val ? Number(val) : null);
                }}
                className="h-8 max-w-[140px] rounded border border-[#BFC8D4] bg-white px-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[#1D4E89] sm:max-w-none sm:px-2.5"
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

            <ThemeToggle variant="light" />

            <LanguageSwitcher variant="light" />

            <NotificationBell />

            <div className="hidden h-4 w-px bg-[#CFD6DF] sm:block" />

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              title={t('shell.logoutTitle')}
              aria-label={t('common.logout')}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[#BFC8D4] bg-white px-2.5 text-xs font-semibold whitespace-nowrap text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
            >
              <IconLogout size={14} />
              <span className="hidden sm:inline">
                {isLoggingOut ? t('common.loggingOut') : t('common.logout')}
              </span>
            </button>
          </div>
        </header>

        <main className="w-full min-w-0 flex-1 p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
