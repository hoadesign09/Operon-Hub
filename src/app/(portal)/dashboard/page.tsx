'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBuilding,
  IconCalendarEvent,
  IconCalendarTime,
  IconCash,
  IconChecklist,
  IconClockCheck,
  IconClockHour8,
  IconDeviceLaptop,
  IconDevices,
  IconFileCertificate,
  IconPin,
  IconRefresh,
  IconShieldLock,
  IconSpeakerphone,
  IconUsers,
} from '@tabler/icons-react';
import { HrmDashboardCharts } from '@/components/hrm/HrmDashboardCharts';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { DashboardMyTasksWidget } from '@/components/projects/DashboardMyTasksWidget';
import { SystemStatusCard } from '@/components/system/SystemStatusCard';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import type { DashboardSummaryData } from '@/modules/hrm/dashboard/dashboard.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import {
  formatMonthSelectOption,
  formatPeriodLabel,
  type TranslationKey,
} from '@/shared/i18n/translator';

const ATTENDANCE_SELF_STYLES: Record<
  'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT',
  { key: TranslationKey; cls: string }
> = {
  NOT_CHECKED_IN: {
    key: 'dashboard.ess.status.NOT_CHECKED_IN',
    cls: 'bg-amber-400/20 text-amber-200 ring-amber-300/30',
  },
  CHECKED_IN: {
    key: 'dashboard.ess.status.CHECKED_IN',
    cls: 'bg-cyan-400/20 text-cyan-200 ring-cyan-300/30',
  },
  CHECKED_OUT: {
    key: 'dashboard.ess.status.CHECKED_OUT',
    cls: 'bg-emerald-400/20 text-emerald-200 ring-emerald-300/30',
  },
};

const ANNOUNCEMENT_CAT_STYLES: Record<string, { key: TranslationKey; cls: string }> = {
  GENERAL: { key: 'dashboard.announcement.cat.GENERAL', cls: 'bg-slate-100 text-slate-700' },
  HR_POLICY: { key: 'dashboard.announcement.cat.HR_POLICY', cls: 'bg-blue-50 text-blue-700' },
  EVENT: { key: 'dashboard.announcement.cat.EVENT', cls: 'bg-emerald-50 text-emerald-700' },
  URGENT: { key: 'dashboard.announcement.cat.URGENT', cls: 'bg-rose-100 text-rose-700' },
};

export default function DashboardPage() {
  const { user, selectedBranchId, hasPermission } = usePortalAuth();
  const { locale, t, ln } = useI18n();
  const canReadDashboard = hasPermission('hrm.dashboard.read');

  const [initialPeriod] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedYear, setSelectedYear] = useState<number>(initialPeriod.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialPeriod.month);

  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const currentBranch = user?.branches.find((b) => b.id === selectedBranchId) ?? null;

  useEffect(() => {
    if (!canReadDashboard) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const sp = new URLSearchParams({
          year: String(selectedYear),
          month: String(selectedMonth),
        });
        if (selectedBranchId) {
          sp.set('branchId', String(selectedBranchId));
        }
        const res = await fetch(`/api/v1/hrm/dashboard/summary?${sp.toString()}`, {
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: DashboardSummaryData;
          error?: { message?: string };
        } | null;

        if (!res.ok || !json?.success || !json.data) {
          throw new Error(json?.error?.message ?? 'LOAD_ERROR');
        }

        setData(json.data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(err instanceof Error ? err.message : 'NETWORK_ERROR');
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [canReadDashboard, reloadTick, selectedBranchId, selectedMonth, selectedYear]);

  const adminQuickLinks = [
    {
      title: t('dashboard.adminLinks.branchesTitle'),
      description: t('dashboard.adminLinks.branchesDesc'),
      href: '/settings/branches',
      permission: 'core.branches.read',
      icon: IconBuilding,
    },
    {
      title: t('dashboard.adminLinks.usersRolesTitle'),
      description: t('dashboard.adminLinks.usersRolesDesc'),
      href: '/settings/users-roles',
      permission: 'core.users.read',
      icon: IconUsers,
    },
    {
      title: t('dashboard.adminLinks.auditLogsTitle'),
      description: t('dashboard.adminLinks.auditLogsDesc'),
      href: '/settings/audit-logs',
      permission: 'core.audit_logs.read',
      icon: IconShieldLock,
    },
  ].filter((item) => hasPermission(item.permission));

  const periodLabel = formatPeriodLabel(locale, selectedMonth, selectedYear);
  const yearOptions = [initialPeriod.year - 1, initialPeriod.year, initialPeriod.year + 1];
  const resolvedError =
    errorMessage === 'LOAD_ERROR'
      ? t('dashboard.loadError')
      : errorMessage === 'NETWORK_ERROR'
        ? t('dashboard.networkError')
        : errorMessage;

  return (
    <div className="w-full space-y-6">
      {/* Precision Grid Classic Command Banner */}
      <section className="rounded border border-[#163D6B] bg-[#1D4E89] p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-white/75 uppercase">
              {t('dashboard.commandCenter', { period: periodLabel })}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-white">
              {t('dashboard.greeting', { name: user?.fullName ?? t('common.user') })}
            </h1>
            <p className="mt-1 text-xs text-white/80">
              {t('dashboard.displayBranch')}{' '}
              <span className="font-semibold text-white">
                {currentBranch
                  ? `${ln(currentBranch.name, currentBranch.nameEn)} (${currentBranch.code})`
                  : t('common.allBranches')}
              </span>
            </p>
          </div>

          {canReadDashboard && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t('dashboard.selectMonth')}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-8 rounded border border-white/25 bg-[#163D6B] px-2.5 text-xs font-semibold text-white outline-none focus:border-white"
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m} className="text-slate-900">
                    {formatMonthSelectOption(locale, m)}
                  </option>
                ))}
              </select>

              <select
                aria-label={t('dashboard.selectYear')}
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-8 rounded border border-white/25 bg-[#163D6B] px-2.5 text-xs font-semibold text-white outline-none focus:border-white"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="text-slate-900">
                    {t('dashboard.yearOption', { year: y })}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setReloadTick((v) => v + 1)}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-white/30 bg-white px-3 text-xs font-semibold text-[#1D4E89] transition hover:bg-slate-100"
              >
                <IconRefresh size={14} />
                <span>{t('common.refresh')}</span>
              </button>
            </div>
          )}
        </div>

        {/* ESS Quick Strip embedded inside Command Hero when employee profile is linked */}
        {data?.selfService && (
          <div className="relative z-10 mt-5 border-t border-white/10 pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-300">
                <strong className="text-white">{t('dashboard.ess.title')}</strong> —{' '}
                {data.selfService.employeeCode} •{' '}
                {ln(data.selfService.positionName, data.selfService.positionNameEn)} (
                {ln(data.selfService.departmentName, data.selfService.departmentNameEn)})
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
                  ATTENDANCE_SELF_STYLES[data.selfService.todayAttendanceStatus].cls
                }`}
              >
                {t('dashboard.ess.todayPrefix', {
                  status: t(ATTENDANCE_SELF_STYLES[data.selfService.todayAttendanceStatus].key),
                })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Link
                href="/my/requests"
                className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-xs transition hover:border-cyan-400/50 hover:bg-white/12"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{t('dashboard.ess.annualLeaveTitle')}</span>
                  <IconCalendarEvent size={16} className="text-cyan-300" />
                </div>
                <div className="mt-1.5 text-xl font-bold text-white tabular-nums">
                  {t('dashboard.ess.daysUnit', {
                    count: data.selfService.annualLeaveRemainingDays,
                  })}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {t('dashboard.ess.pendingRequests', {
                    count: data.selfService.myPendingRequestsCount,
                  })}
                </div>
              </Link>

              <Link
                href="/my/attendance"
                className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-xs transition hover:border-cyan-400/50 hover:bg-white/12"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{t('dashboard.ess.todayAttendanceTitle')}</span>
                  <IconClockCheck size={16} className="text-emerald-300" />
                </div>
                <div className="mt-1.5 text-base font-bold text-white tabular-nums">
                  {data.selfService.todayCheckInAt
                    ? t('dashboard.ess.checkedInAt', {
                        time: formatDateTimeVN(data.selfService.todayCheckInAt).slice(11),
                      })
                    : t('dashboard.ess.notCheckedIn')}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-cyan-300">
                  {t('dashboard.ess.openAttendance')}
                </div>
              </Link>

              <Link
                href="/my/assets"
                className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-xs transition hover:border-cyan-400/50 hover:bg-white/12"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{t('dashboard.ess.assignedAssetsTitle')}</span>
                  <IconDevices size={16} className="text-blue-300" />
                </div>
                <div className="mt-1.5 text-xl font-bold text-white tabular-nums">
                  {t('dashboard.ess.devicesUnit', {
                    count: data.selfService.assignedAssetsCount,
                  })}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {t('dashboard.ess.viewHandover')}
                </div>
              </Link>

              <Link
                href="/hrm/office/announcements"
                className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-xs transition hover:border-cyan-400/50 hover:bg-white/12"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{t('dashboard.ess.unreadNewsTitle')}</span>
                  <IconSpeakerphone size={16} className="text-amber-300" />
                </div>
                <div className="mt-1.5 text-xl font-bold text-amber-300 tabular-nums">
                  {t('dashboard.ess.bulletinsUnit', {
                    count: data.kpis.office.unreadAnnouncementsCount,
                  })}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {t('dashboard.ess.todayMeetings', {
                    count: data.kpis.office.todayBookingsCount,
                  })}
                </div>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Main Dashboard States */}
      {!canReadDashboard ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs">
          {t('dashboard.noPermission')}
        </div>
      ) : isLoading ? (
        <SkeletonDashboard />
      ) : resolvedError ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-rose-700">{resolvedError}</p>
          <button
            type="button"
            onClick={() => setReloadTick((v) => v + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>{t('common.retry')}</span>
          </button>
        </div>
      ) : data ? (
        <>
          {/* Role-Aware Bento KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.visibility.canViewWorkforce && data.kpis.workforce && (
              <Link
                href="/hrm/employees"
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-blue-400 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <IconUsers size={20} />
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    {t('dashboard.kpi.newHiresBadge', {
                      count: data.kpis.workforce.newHiresThisMonth,
                    })}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpis.workforce.activeEmployees}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    {t('dashboard.kpi.activeEmployees')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {t('dashboard.kpi.probationPeriod', {
                      count: data.kpis.workforce.probationCount,
                      period: periodLabel,
                    })}
                  </div>
                </div>
              </Link>
            )}

            {data.visibility.canViewContracts && data.kpis.expiringContractsCount !== null && (
              <Link
                href="/hrm/contracts"
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-amber-400 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <IconFileCertificate size={20} />
                  </span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                    {t('dashboard.kpi.within30Days')}
                  </span>
                </div>
                <div className="mt-4">
                  <div
                    className={`text-3xl font-bold tracking-tight tabular-nums ${
                      data.kpis.expiringContractsCount > 0 ? 'text-amber-600' : 'text-slate-900'
                    }`}
                  >
                    {data.kpis.expiringContractsCount}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    {t('dashboard.kpi.expiringContracts')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {t('dashboard.kpi.expiringContractsDesc')}
                  </div>
                </div>
              </Link>
            )}

            {data.visibility.canViewApprovals && (
              <Link
                href="/approvals"
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-blue-400 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                    <IconChecklist size={20} />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      data.kpis.pendingApprovalsCount > 0
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {data.kpis.pendingApprovalsCount > 0
                      ? t('dashboard.kpi.needsApproval')
                      : t('dashboard.kpi.allClear')}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpis.pendingApprovalsCount}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    {t('dashboard.kpi.pendingApprovals')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {t('dashboard.kpi.pendingApprovalsDesc')}
                  </div>
                </div>
              </Link>
            )}

            {data.visibility.canViewAttendance && (
              <Link
                href="/hrm/attendance"
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-emerald-400 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <IconClockHour8 size={20} />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {periodLabel}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpis.attendance.lateRatePercent}%
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    {t('dashboard.kpi.lateRate')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {t('dashboard.kpi.attendanceSummary', {
                      present: data.kpis.attendance.presentCount,
                      late: data.kpis.attendance.lateCount,
                      total: data.kpis.attendance.totalLogs,
                    })}
                  </div>
                </div>
              </Link>
            )}

            {data.visibility.canViewPayroll && (
              <Link
                href="/hrm/payroll"
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-emerald-400 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <IconCash size={20} />
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    {data.kpis.latestPayroll?.code ?? t('dashboard.kpi.payrollPeriodFallback')}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpis.latestPayroll
                      ? formatVND(data.kpis.latestPayroll.totalNet)
                      : t('dashboard.kpi.noPayrollYet')}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    {t('dashboard.kpi.payrollNetTitle')}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">
                    {data.kpis.latestPayroll
                      ? t('dashboard.kpi.payrollGrossSummary', {
                          gross: formatVND(data.kpis.latestPayroll.totalGross),
                          count: data.kpis.latestPayroll.totalEmployees,
                        })
                      : t('dashboard.kpi.payrollCreateHint')}
                  </div>
                </div>
              </Link>
            )}

            {data.visibility.canViewAssets && data.kpis.assets && (
              <Link
                href="/hrm/office/assets"
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-blue-400 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <IconDeviceLaptop size={20} />
                  </span>
                  {data.kpis.assets.offboardingAlertsCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                      <IconAlertTriangle size={12} />
                      {t('dashboard.kpi.unrecoveredAssets', {
                        count: data.kpis.assets.offboardingAlertsCount,
                      })}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      {t('dashboard.kpi.availableAssetsBadge', {
                        count: data.kpis.assets.available,
                      })}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpis.assets.assigned}{' '}
                    <span className="text-sm font-normal text-slate-400">
                      / {data.kpis.assets.total}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    {t('dashboard.kpi.assignedAssets')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {t('dashboard.kpi.availableAssetsDesc', {
                      count: data.kpis.assets.available,
                    })}
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Interactive Recharts Section */}
          <HrmDashboardCharts
            visibility={data.visibility}
            charts={data.charts}
            periodLabel={periodLabel}
          />

          {/* 3 Bento Action Widgets */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {data.visibility.canViewContracts && (
              <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
                <div className="mb-3.5 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    {t('dashboard.widget.expiringContractsTitle')}
                  </h2>
                  <Link
                    href="/hrm/contracts"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    {t('common.viewAll')}
                  </Link>
                </div>
                {data.widgets.expiringContracts.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    {t('dashboard.widget.expiringContractsEmpty')}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {data.widgets.expiringContracts.map((c) => (
                      <Link
                        key={c.id}
                        href={`/hrm/employees/${c.employeeId}`}
                        className="block rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 transition hover:border-amber-300 hover:bg-amber-50/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-slate-900">
                            {c.employeeName} ({c.employeeCode})
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                              c.daysRemaining < 0
                                ? 'bg-rose-100 text-rose-700'
                                : c.daysRemaining <= 15
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {c.daysRemaining < 0
                              ? t('dashboard.widget.overdueDays', {
                                  days: Math.abs(c.daysRemaining),
                                })
                              : t('dashboard.widget.remainingDays', { days: c.daysRemaining })}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {c.contractNo} •{' '}
                          {t('dashboard.widget.expiresOn', { date: formatDateVN(c.endDate) })}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <IconCalendarTime size={17} className="text-blue-600" />
                  <span>{t('dashboard.widget.upcomingMeetingsTitle')}</span>
                </h2>
                <Link
                  href="/hrm/office/meeting-rooms"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {t('dashboard.widget.bookRoom')}
                </Link>
              </div>
              {data.widgets.upcomingMeetings.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  {t('dashboard.widget.upcomingMeetingsEmpty')}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.widgets.upcomingMeetings.map((m) => (
                    <Link
                      key={m.id}
                      href="/hrm/office/meeting-rooms"
                      className="block rounded-xl border-l-[3px] border-l-blue-600 bg-slate-50 px-3.5 py-2.5 transition hover:bg-blue-50/50"
                    >
                      <div className="truncate text-xs font-bold text-slate-900" title={m.title}>
                        {m.title}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-blue-700 tabular-nums">
                        {formatDateTimeVN(m.startTime)} • [{m.roomCode}] {ln(m.roomName, m.roomNameEn)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {t('dashboard.widget.bookedBy', { name: m.bookedByEmployeeName })}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <IconSpeakerphone size={17} className="text-amber-500" />
                  <span>{t('dashboard.widget.latestAnnouncementsTitle')}</span>
                </h2>
                <Link
                  href="/hrm/office/announcements"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {t('dashboard.widget.viewAnnouncements')}
                </Link>
              </div>
              {data.widgets.latestAnnouncements.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  {t('dashboard.widget.latestAnnouncementsEmpty')}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.widgets.latestAnnouncements.map((ann) => {
                    const cat =
                      ANNOUNCEMENT_CAT_STYLES[ann.category] ?? ANNOUNCEMENT_CAT_STYLES.GENERAL;
                    return (
                      <Link
                        key={ann.id}
                        href="/hrm/office/announcements"
                        className="block rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 transition hover:border-blue-300 hover:bg-blue-50/40"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ann.isPinned && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              <IconPin size={10} />
                              {t('common.pinBadge')}
                            </span>
                          )}
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cat.cls}`}>
                            {t(cat.key)}
                          </span>
                          {!ann.isReadByMe && (
                            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {t('common.newBadge')}
                            </span>
                          )}
                        </div>
                        <div
                          className="mt-1 line-clamp-2 text-xs font-bold text-slate-900"
                          title={ann.title}
                        >
                          {ann.title}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {ann.branchName ? ln(ann.branchName, ann.branchNameEn) : t('common.companyWide')}
                          {ann.publishedAt ? ` • ${formatDateVN(ann.publishedAt)}` : ''}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* My Project Tasks Widget (Phase 2) */}
      <DashboardMyTasksWidget />

      {/* Core Admin Quick Links */}
      {adminQuickLinks.length > 0 && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <h2 className="mb-3.5 text-sm font-bold text-slate-900">
            {t('dashboard.adminLinks.title')}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {adminQuickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <div>
                    <div className="flex h-8 w-8 items-center justify-center rounded border border-[#BDD2EC] bg-[#E6EEF8] text-[#1D4E89]">
                      <Icon size={16} />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:underline">
                    <span>{t('common.openNow')}</span>
                    <IconArrowRight size={14} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <SystemStatusCard />
    </div>
  );
}
