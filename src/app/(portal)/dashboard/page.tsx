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
import { SystemStatusCard } from '@/components/system/SystemStatusCard';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import type { DashboardSummaryData } from '@/modules/hrm/dashboard/dashboard.service';

const ATTENDANCE_SELF_LABELS: Record<
  'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT',
  { label: string; cls: string }
> = {
  NOT_CHECKED_IN: { label: 'Chưa chấm công', cls: 'bg-amber-400/20 text-amber-200 ring-amber-300/30' },
  CHECKED_IN: { label: 'Đang làm việc', cls: 'bg-cyan-400/20 text-cyan-200 ring-cyan-300/30' },
  CHECKED_OUT: { label: 'Đã Check-out', cls: 'bg-emerald-400/20 text-emerald-200 ring-emerald-300/30' },
};

const ANNOUNCEMENT_CAT_LABELS: Record<string, { label: string; cls: string }> = {
  GENERAL: { label: 'Chung', cls: 'bg-slate-100 text-slate-700' },
  HR_POLICY: { label: 'Chính sách', cls: 'bg-blue-50 text-blue-700' },
  EVENT: { label: 'Sự kiện', cls: 'bg-emerald-50 text-emerald-700' },
  URGENT: { label: 'Khẩn cấp', cls: 'bg-rose-100 text-rose-700' },
};

export default function DashboardPage() {
  const { user, selectedBranchId, hasPermission } = usePortalAuth();
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
          throw new Error(json?.error?.message ?? 'Không thể tải dữ liệu Dashboard vận hành.');
        }

        setData(json.data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(
          err instanceof Error ? err.message : 'Lỗi kết nối máy chủ khi tải Dashboard.',
        );
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [canReadDashboard, reloadTick, selectedBranchId, selectedMonth, selectedYear]);

  const adminQuickLinks = [
    {
      title: 'Quản lý Chi nhánh',
      description: 'Thiết lập trụ sở chính và các chi nhánh thành viên.',
      href: '/settings/branches',
      permission: 'core.branches.read',
      icon: IconBuilding,
    },
    {
      title: 'Người dùng & RBAC',
      description: 'Cấp tài khoản, gán vai trò và tinh chỉnh ma trận quyền.',
      href: '/settings/users-roles',
      permission: 'core.users.read',
      icon: IconUsers,
    },
    {
      title: 'Nhật ký Kiểm toán',
      description: 'Theo dõi lịch sử đăng nhập và mọi thay đổi nhạy cảm.',
      href: '/settings/audit-logs',
      permission: 'core.audit_logs.read',
      icon: IconShieldLock,
    },
  ].filter((item) => hasPermission(item.permission));

  const periodLabel = `Tháng ${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
  const yearOptions = [initialPeriod.year - 1, initialPeriod.year, initialPeriod.year + 1];

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Midnight Command Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#0C4A6E] p-6 text-white shadow-sm">
        <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-cyan-300 uppercase">
              Operon Command Center • {periodLabel}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">
              Xin chào, {user?.fullName ?? 'Người dùng'}
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Chi nhánh hiển thị:{' '}
              <span className="font-semibold text-white">
                {currentBranch ? `${currentBranch.name} (${currentBranch.code})` : 'Tất cả chi nhánh'}
              </span>
            </p>
          </div>

          {canReadDashboard && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Chọn tháng"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-xs outline-none focus:border-cyan-400"
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m} className="text-slate-900">
                    Tháng {m}
                  </option>
                ))}
              </select>

              <select
                aria-label="Chọn năm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-xs outline-none focus:border-cyan-400"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="text-slate-900">
                    Năm {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setReloadTick((v) => v + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                <IconRefresh size={15} />
                <span>Làm mới</span>
              </button>
            </div>
          )}
        </div>

        {/* ESS Quick Strip embedded inside Command Hero when employee profile is linked */}
        {data?.selfService && (
          <div className="relative z-10 mt-5 border-t border-white/10 pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-300">
                <strong className="text-white">Không gian Cá nhân (ESS)</strong> —{' '}
                {data.selfService.employeeCode} • {data.selfService.positionName} (
                {data.selfService.departmentName})
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
                  ATTENDANCE_SELF_LABELS[data.selfService.todayAttendanceStatus].cls
                }`}
              >
                Hôm nay: {ATTENDANCE_SELF_LABELS[data.selfService.todayAttendanceStatus].label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Link
                href="/my/requests"
                className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-xs transition hover:border-cyan-400/50 hover:bg-white/12"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Phép năm còn lại</span>
                  <IconCalendarEvent size={16} className="text-cyan-300" />
                </div>
                <div className="mt-1.5 text-xl font-bold text-white tabular-nums">
                  {data.selfService.annualLeaveRemainingDays} ngày
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {data.selfService.myPendingRequestsCount} đơn đang chờ duyệt
                </div>
              </Link>

              <Link
                href="/my/attendance"
                className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-xs transition hover:border-cyan-400/50 hover:bg-white/12"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Chấm công hôm nay</span>
                  <IconClockCheck size={16} className="text-emerald-300" />
                </div>
                <div className="mt-1.5 text-base font-bold text-white tabular-nums">
                  {data.selfService.todayCheckInAt
                    ? `Vào: ${formatDateTimeVN(data.selfService.todayCheckInAt).slice(11)}`
                    : 'Chưa Check-in'}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-cyan-300">Mở chấm công →</div>
              </Link>

              <Link
                href="/my/assets"
                className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-xs transition hover:border-cyan-400/50 hover:bg-white/12"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Tài sản đang giữ</span>
                  <IconDevices size={16} className="text-blue-300" />
                </div>
                <div className="mt-1.5 text-xl font-bold text-white tabular-nums">
                  {data.selfService.assignedAssetsCount} thiết bị
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">Xem biên bản bàn giao</div>
              </Link>

              <Link
                href="/hrm/office/announcements"
                className="rounded-xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-xs transition hover:border-cyan-400/50 hover:bg-white/12"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Thông báo chưa đọc</span>
                  <IconSpeakerphone size={16} className="text-amber-300" />
                </div>
                <div className="mt-1.5 text-xl font-bold text-amber-300 tabular-nums">
                  {data.kpis.office.unreadAnnouncementsCount} bản tin
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {data.kpis.office.todayBookingsCount} cuộc họp hôm nay
                </div>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Main Dashboard States */}
      {!canReadDashboard ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs">
          Tài khoản hiện tại chưa được cấp quyền xem tổng quan HRM (`hrm.dashboard.read`).
        </div>
      ) : isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/80" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-2xl bg-white/80" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/80" />
          </div>
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setReloadTick((v) => v + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>Thử lại</span>
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
                    +{data.kpis.workforce.newHiresThisMonth} mới
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpis.workforce.activeEmployees}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    Nhân sự đang làm việc
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Thử việc: <strong>{data.kpis.workforce.probationCount}</strong> • Kỳ {periodLabel}
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
                    ≤ 30 ngày
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
                    Hợp đồng sắp hết hạn
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Bao gồm hợp đồng quá hạn chưa gia hạn
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
                    {data.kpis.pendingApprovalsCount > 0 ? 'Cần duyệt' : 'Đã sạch'}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpis.pendingApprovalsCount}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    Đơn đang chờ tôi phê duyệt
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Hộp thư phê duyệt đa cấp (Nghỉ phép / OT / Công tác)
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
                  <div className="mt-1 text-xs font-semibold text-slate-700">Tỷ lệ đi muộn</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Đúng giờ: <strong>{data.kpis.attendance.presentCount}</strong> • Đi muộn:{' '}
                    <strong>{data.kpis.attendance.lateCount}</strong> ({data.kpis.attendance.totalLogs}{' '}
                    lượt)
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
                    {data.kpis.latestPayroll?.code ?? 'Kỳ lương'}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {data.kpis.latestPayroll
                      ? formatVND(data.kpis.latestPayroll.totalNet)
                      : 'Chưa có kỳ lương'}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    Quỹ lương Thực lĩnh (Kỳ gần nhất)
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">
                    {data.kpis.latestPayroll
                      ? `Gross: ${formatVND(data.kpis.latestPayroll.totalGross)} (${data.kpis.latestPayroll.totalEmployees} NV)`
                      : 'Tạo kỳ lương tại phân hệ Tính lương'}
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
                      {data.kpis.assets.offboardingAlertsCount} chưa thu hồi
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      Sẵn sàng: {data.kpis.assets.available}
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
                    Tài sản & Thiết bị đang cấp phát
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Kho sẵn sàng cấp phát: {data.kpis.assets.available} thiết bị
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
                  <h2 className="text-sm font-bold text-slate-900">Hợp đồng sắp hết hạn</h2>
                  <Link
                    href="/hrm/contracts"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Xem tất cả
                  </Link>
                </div>
                {data.widgets.expiringContracts.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Không có hợp đồng nào sắp hết hạn trong 30 ngày tới.
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
                              ? `Quá hạn ${Math.abs(c.daysRemaining)} ngày`
                              : `Còn ${c.daysRemaining} ngày`}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {c.contractNo} • Hết hạn: {formatDateVN(c.endDate)}
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
                  <span>Lịch phòng họp sắp tới</span>
                </h2>
                <Link
                  href="/hrm/office/meeting-rooms"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Đặt phòng
                </Link>
              </div>
              {data.widgets.upcomingMeetings.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Chưa có cuộc họp nào sắp diễn ra.
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
                        {formatDateTimeVN(m.startTime)} • [{m.roomCode}] {m.roomName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Người đặt: {m.bookedByEmployeeName}
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
                  <span>Bản tin Nội bộ mới nhất</span>
                </h2>
                <Link
                  href="/hrm/office/announcements"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Xem bản tin
                </Link>
              </div>
              {data.widgets.latestAnnouncements.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Chưa có thông báo nội bộ nào được xuất bản.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.widgets.latestAnnouncements.map((ann) => {
                    const cat =
                      ANNOUNCEMENT_CAT_LABELS[ann.category] ?? ANNOUNCEMENT_CAT_LABELS.GENERAL;
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
                              Ghim
                            </span>
                          )}
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cat.cls}`}>
                            {cat.label}
                          </span>
                          {!ann.isReadByMe && (
                            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              Mới
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
                          {ann.branchName ?? 'Toàn công ty'}
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

      {/* Core Admin Quick Links */}
      {adminQuickLinks.length > 0 && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <h2 className="mb-3.5 text-sm font-bold text-slate-900">Lối tắt Quản trị Nền tảng Core</h2>
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
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F172A] text-cyan-400">
                      <Icon size={18} />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:underline">
                    <span>Mở ngay</span>
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
