'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconCalendarOff,
  IconCalendarPlus,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { InitializeBalancesModal } from '@/components/hrm/InitializeBalancesModal';
import {
  LeaveTypeFormModal,
  type LeaveTypeFormItem,
} from '@/components/hrm/LeaveTypeFormModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';

type ActiveTab = 'LEAVES' | 'OVERTIMES' | 'TRIPS' | 'BALANCES' | 'TYPES';
type LeaveSession = 'FULL' | 'AM' | 'PM';
type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type OtRateType = 'WEEKDAY_150' | 'WEEKEND_200' | 'HOLIDAY_300';

interface HrLeaveRequest {
  id: number;
  requestCode: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  startSession: LeaveSession;
  endSession: LeaveSession;
  totalDays: number;
  reason: string;
  status: RequestStatus;
  approvalRequestId: number | null;
}

interface HrOvertimeRequest {
  id: number;
  requestCode: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  otRateType: OtRateType;
  reason: string;
  status: RequestStatus;
  approvalRequestId: number | null;
}

interface HrBusinessTripRequest {
  id: number;
  requestCode: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  estimatedCost: number;
  purpose: string;
  status: RequestStatus;
  approvalRequestId: number | null;
}

interface HrLeaveBalance {
  id: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  entitledDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  note: string | null;
}

const SESSION_SHORT: Record<LeaveSession, string> = {
  FULL: 'Cả ngày',
  AM: 'Sáng',
  PM: 'Chiều',
};

const OT_RATE_BADGE: Record<OtRateType, { label: string; className: string }> = {
  WEEKDAY_150: { label: '150% (Thường)', className: 'bg-blue-50 text-blue-700' },
  WEEKEND_200: { label: '200% (Cuối tuần)', className: 'bg-amber-50 text-amber-800' },
  HOLIDAY_300: { label: '300% (Ngày lễ)', className: 'bg-rose-50 text-rose-700' },
};

const STATUS_BADGE: Record<RequestStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-slate-100 text-slate-700' },
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Từ chối', className: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-slate-200 text-slate-600' },
};

export default function HrmRequestsPage() {
  const { user, selectedBranchId } = usePortalAuth();
  const canManage = Boolean(
    user?.isSuperAdmin || user?.permissions.includes('hrm.requests.manage'),
  );
  const canExport = Boolean(
    user?.isSuperAdmin || user?.permissions.includes('hrm.requests.export'),
  );

  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<ActiveTab>('LEAVES');
  const [year, setYear] = useState<number>(currentYear);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('');
  const [otRateFilter, setOtRateFilter] = useState<string>('');
  const [reloadTick, setReloadTick] = useState<number>(0);

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeFormItem[]>([]);
  const [leaves, setLeaves] = useState<HrLeaveRequest[]>([]);
  const [overtimes, setOvertimes] = useState<HrOvertimeRequest[]>([]);
  const [trips, setTrips] = useState<HrBusinessTripRequest[]>([]);
  const [balances, setBalances] = useState<HrLeaveBalance[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Modals
  const [isTypeModalOpen, setIsTypeModalOpen] = useState<boolean>(false);
  const [editingType, setEditingType] = useState<LeaveTypeFormItem | null>(null);
  const [deletingType, setDeletingType] = useState<LeaveTypeFormItem | null>(null);
  const [isDeletingType, setIsDeletingType] = useState<boolean>(false);
  const [isInitModalOpen, setIsInitModalOpen] = useState<boolean>(false);

  // Adjust balance modal
  const [adjustingBalance, setAdjustingBalance] = useState<HrLeaveBalance | null>(null);
  const [adjEntitled, setAdjEntitled] = useState<string>('12');
  const [adjCarried, setAdjCarried] = useState<string>('0');
  const [adjNote, setAdjNote] = useState<string>('');
  const [isSavingAdjust, setIsSavingAdjust] = useState<boolean>(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    const loadTypesPromise = fetch('/api/v1/hrm/requests/leave-types', {
      signal: controller.signal,
    }).then(async (res) => {
      const json = (await res.json()) as {
        success: boolean;
        data?: { items: LeaveTypeFormItem[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Không tải được danh mục loại phép.');
      }
      return json.data?.items ?? [];
    });

    const buildParams = () => {
      const sp = new URLSearchParams({ year: String(year), limit: '50' });
      if (selectedBranchId) sp.set('branchId', String(selectedBranchId));
      if (debouncedSearch) sp.set('search', debouncedSearch);
      return sp;
    };

    const loadMainPromise = (() => {
      if (activeTab === 'LEAVES') {
        const sp = buildParams();
        if (statusFilter) sp.set('status', statusFilter);
        if (leaveTypeFilter) sp.set('leaveTypeId', leaveTypeFilter);
        return fetch(`/api/v1/hrm/requests/leaves?${sp.toString()}`, {
          signal: controller.signal,
        }).then(async (res) => {
          const json = (await res.json()) as {
            success: boolean;
            data?: { items: HrLeaveRequest[] };
            error?: { message?: string };
          };
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message ?? 'Không tải được danh sách đơn nghỉ phép.');
          }
          setLeaves(json.data?.items ?? []);
        });
      }

      if (activeTab === 'OVERTIMES') {
        const sp = buildParams();
        if (statusFilter) sp.set('status', statusFilter);
        if (otRateFilter) sp.set('otRateType', otRateFilter);
        return fetch(`/api/v1/hrm/requests/overtimes?${sp.toString()}`, {
          signal: controller.signal,
        }).then(async (res) => {
          const json = (await res.json()) as {
            success: boolean;
            data?: { items: HrOvertimeRequest[] };
            error?: { message?: string };
          };
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message ?? 'Không tải được danh sách đơn tăng ca.');
          }
          setOvertimes(json.data?.items ?? []);
        });
      }

      if (activeTab === 'TRIPS') {
        const sp = buildParams();
        if (statusFilter) sp.set('status', statusFilter);
        return fetch(`/api/v1/hrm/requests/business-trips?${sp.toString()}`, {
          signal: controller.signal,
        }).then(async (res) => {
          const json = (await res.json()) as {
            success: boolean;
            data?: { items: HrBusinessTripRequest[] };
            error?: { message?: string };
          };
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message ?? 'Không tải được danh sách đơn công tác.');
          }
          setTrips(json.data?.items ?? []);
        });
      }

      if (activeTab === 'BALANCES') {
        const sp = buildParams();
        if (leaveTypeFilter) sp.set('leaveTypeId', leaveTypeFilter);
        return fetch(`/api/v1/hrm/requests/leave-balances?${sp.toString()}`, {
          signal: controller.signal,
        }).then(async (res) => {
          const json = (await res.json()) as {
            success: boolean;
            data?: { items: HrLeaveBalance[] };
            error?: { message?: string };
          };
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message ?? 'Không tải được quỹ phép năm.');
          }
          setBalances(json.data?.items ?? []);
        });
      }

      return Promise.resolve();
    })();

    Promise.all([loadTypesPromise, loadMainPromise])
      .then(([typesItems]) => {
        setLeaveTypes(typesItems);
        setErrorMsg(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Lỗi tải dữ liệu quản trị đơn từ.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    activeTab,
    year,
    selectedBranchId,
    statusFilter,
    leaveTypeFilter,
    otRateFilter,
    debouncedSearch,
    reloadTick,
  ]);

  function triggerReload() {
    setIsLoading(true);
    setReloadTick((t) => t + 1);
  }

  async function handleExportExcel() {
    setIsExporting(true);
    setBannerMsg(null);
    try {
      const sp = new URLSearchParams({ year: String(year) });
      if (selectedBranchId) sp.set('branchId', String(selectedBranchId));
      if (statusFilter) sp.set('status', statusFilter);
      if (debouncedSearch) sp.set('search', debouncedSearch);

      let url = '';
      let fallbackFilename = `export-${year}.xlsx`;
      if (activeTab === 'LEAVES') {
        if (leaveTypeFilter) sp.set('leaveTypeId', leaveTypeFilter);
        url = `/api/v1/hrm/requests/leaves/export?${sp.toString()}`;
        fallbackFilename = `don-nghi-phep-${year}.xlsx`;
      } else if (activeTab === 'OVERTIMES') {
        if (otRateFilter) sp.set('otRateType', otRateFilter);
        url = `/api/v1/hrm/requests/overtimes/export?${sp.toString()}`;
        fallbackFilename = `don-tang-ca-${year}.xlsx`;
      } else {
        url = `/api/v1/hrm/requests/business-trips/export?${sp.toString()}`;
        fallbackFilename = `don-cong-tac-${year}.xlsx`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setBannerMsg({
          type: 'error',
          text: errJson?.error?.message ?? 'Không thể xuất file Excel.',
        });
        return;
      }

      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = fallbackFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      setBannerMsg({ type: 'success', text: 'Đã xuất dữ liệu ra Excel (.xlsx) thành công.' });
    } catch {
      setBannerMsg({ type: 'error', text: 'Lỗi kết nối khi xuất Excel.' });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteLeaveType() {
    if (!deletingType) return;
    setIsDeletingType(true);
    try {
      const res = await fetch(`/api/v1/hrm/requests/leave-types/${deletingType.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        setBannerMsg({
          type: 'error',
          text: json.error?.message ?? 'Không thể xóa loại nghỉ phép.',
        });
      } else {
        setBannerMsg({
          type: 'success',
          text: `Đã xóa loại nghỉ phép "${deletingType.name}".`,
        });
        triggerReload();
      }
    } catch {
      setBannerMsg({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
    } finally {
      setIsDeletingType(false);
      setDeletingType(null);
    }
  }

  async function handleSaveBalanceAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingBalance) return;
    setIsSavingAdjust(true);
    setAdjustError(null);
    try {
      const res = await fetch(`/api/v1/hrm/requests/leave-balances/${adjustingBalance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entitledDays: Number(adjEntitled),
          carriedOverDays: Number(adjCarried),
          note: adjNote.trim() || null,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        setAdjustError(json.error?.message ?? 'Không thể điều chỉnh quỹ phép.');
        setIsSavingAdjust(false);
        return;
      }
      setAdjustingBalance(null);
      setBannerMsg({
        type: 'success',
        text: `Đã điều chỉnh quỹ phép cho ${adjustingBalance.employeeName}.`,
      });
      triggerReload();
    } catch {
      setAdjustError('Lỗi kết nối máy chủ.');
    } finally {
      setIsSavingAdjust(false);
    }
  }

  const isExportableTab =
    activeTab === 'LEAVES' || activeTab === 'OVERTIMES' || activeTab === 'TRIPS';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản trị Đơn từ & Quỹ phép</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý đơn Nghỉ phép, Tăng ca (OT), Công tác, quỹ phép năm và danh mục loại phép
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isExportableTab && canExport && (
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleExportExcel()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {isExporting ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconDownload size={16} />
              )}
              <span>Xuất Excel</span>
            </button>
          )}

          {activeTab === 'BALANCES' && canManage && (
            <button
              type="button"
              onClick={() => setIsInitModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <IconCalendarPlus size={17} />
              <span>Khởi tạo quỹ phép năm</span>
            </button>
          )}

          {activeTab === 'TYPES' && canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingType(null);
                setIsTypeModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={17} />
              <span>Thêm loại phép</span>
            </button>
          )}
        </div>
      </div>

      {bannerMsg && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            bannerMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="rounded p-1 hover:bg-black/5"
            aria-label="Đóng"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* 5 Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            { key: 'LEAVES', label: 'Đơn nghỉ phép' },
            { key: 'OVERTIMES', label: 'Đơn Tăng ca (OT)' },
            { key: 'TRIPS', label: 'Đơn Công tác' },
            { key: 'BALANCES', label: 'Quỹ phép năm' },
            { key: 'TYPES', label: 'Danh mục Loại phép' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setIsLoading(true);
              setActiveTab(tab.key);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab !== 'TYPES' && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="relative min-w-[220px] flex-1">
            <IconSearch
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo mã đơn, mã NV, họ tên, địa điểm/lý do..."
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={year}
            onChange={(e) => {
              setIsLoading(true);
              setYear(Number(e.target.value));
            }}
            aria-label="Chọn năm"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>

          {(activeTab === 'LEAVES' || activeTab === 'BALANCES') && (
            <select
              value={leaveTypeFilter}
              onChange={(e) => {
                setIsLoading(true);
                setLeaveTypeFilter(e.target.value);
              }}
              aria-label="Lọc loại phép"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">Tất cả loại phép</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code})
                </option>
              ))}
            </select>
          )}

          {activeTab === 'OVERTIMES' && (
            <select
              value={otRateFilter}
              onChange={(e) => {
                setIsLoading(true);
                setOtRateFilter(e.target.value);
              }}
              aria-label="Lọc hệ số OT"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">Tất cả hệ số OT</option>
              <option value="WEEKDAY_150">Ngày thường (150%)</option>
              <option value="WEEKEND_200">Cuối tuần (200%)</option>
              <option value="HOLIDAY_300">Ngày lễ (300%)</option>
            </select>
          )}

          {isExportableTab && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setIsLoading(true);
                setStatusFilter(e.target.value);
              }}
              aria-label="Lọc trạng thái"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          )}

          <button
            type="button"
            onClick={triggerReload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <IconRefresh size={16} />
            <span>Tải lại</span>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center">
            <IconAlertCircle size={32} className="mx-auto text-rose-500" />
            <p className="mt-2 text-sm font-medium text-rose-700">{errorMsg}</p>
            <button
              type="button"
              onClick={triggerReload}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <IconRefresh size={16} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : activeTab === 'LEAVES' ? (
          leaves.length === 0 ? (
            <div className="p-10 text-center">
              <IconCalendarOff size={36} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Không có đơn nghỉ phép nào khớp bộ lọc
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mã đơn</th>
                    <th className="px-4 py-3">Nhân viên</th>
                    <th className="px-4 py-3">Loại phép</th>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3 text-right">Số ngày</th>
                    <th className="px-4 py-3">Lý do</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map((item) => {
                    const badge = STATUS_BADGE[item.status];
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                          {item.requestCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{item.employeeName}</div>
                          <div className="text-xs text-slate-500">
                            {item.employeeCode} • {item.departmentName ?? '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-800">{item.leaveTypeName}</td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          <div>
                            {formatDateVN(item.startDate)} ({SESSION_SHORT[item.startSession]})
                          </div>
                          <div className="text-slate-500">
                            → {formatDateVN(item.endDate)} ({SESSION_SHORT[item.endSession]})
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {item.totalDays}
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate text-xs text-slate-600" title={item.reason}>
                            {item.reason}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.approvalRequestId ? (
                            <Link
                              href="/approvals"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <span>Hộp thư</span>
                              <IconExternalLink size={13} />
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'OVERTIMES' ? (
          overtimes.length === 0 ? (
            <div className="p-10 text-center">
              <IconCalendarOff size={36} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Không có đơn tăng ca (OT) nào khớp bộ lọc
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mã đơn</th>
                    <th className="px-4 py-3">Nhân viên</th>
                    <th className="px-4 py-3">Ngày & Giờ OT</th>
                    <th className="px-4 py-3 text-right">Tổng giờ</th>
                    <th className="px-4 py-3">Hệ số OT</th>
                    <th className="px-4 py-3">Lý do</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overtimes.map((item) => {
                    const badge = STATUS_BADGE[item.status];
                    const rateBadge = OT_RATE_BADGE[item.otRateType];
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                          {item.requestCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{item.employeeName}</div>
                          <div className="text-xs text-slate-500">
                            {item.employeeCode} • {item.departmentName ?? '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          <div className="font-semibold text-slate-900">
                            {formatDateVN(item.workDate)}
                          </div>
                          <div className="text-slate-500">
                            {item.startTime} – {item.endTime}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {item.totalHours}h
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${rateBadge.className}`}
                          >
                            {rateBadge.label}
                          </span>
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate text-xs text-slate-600" title={item.reason}>
                            {item.reason}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.approvalRequestId ? (
                            <Link
                              href="/approvals"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <span>Hộp thư</span>
                              <IconExternalLink size={13} />
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'TRIPS' ? (
          trips.length === 0 ? (
            <div className="p-10 text-center">
              <IconCalendarOff size={36} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Không có đơn công tác nào khớp bộ lọc
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mã đơn</th>
                    <th className="px-4 py-3">Nhân viên</th>
                    <th className="px-4 py-3">Địa điểm</th>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3 text-right">Dự kiến phí</th>
                    <th className="px-4 py-3">Mục đích</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trips.map((item) => {
                    const badge = STATUS_BADGE[item.status];
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                          {item.requestCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{item.employeeName}</div>
                          <div className="text-xs text-slate-500">
                            {item.employeeCode} • {item.departmentName ?? '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{item.destination}</td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          <div>
                            {formatDateVN(item.startDate)} → {formatDateVN(item.endDate)}
                          </div>
                          <div className="text-slate-500">{item.totalDays} ngày</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatVND(item.estimatedCost)}
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate text-xs text-slate-600" title={item.purpose}>
                            {item.purpose}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.approvalRequestId ? (
                            <Link
                              href="/approvals"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <span>Hộp thư</span>
                              <IconExternalLink size={13} />
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'BALANCES' ? (
          balances.length === 0 ? (
            <div className="p-10 text-center">
              <IconCalendarOff size={36} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Chưa có bản ghi quỹ phép năm {year}
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsInitModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <IconCalendarPlus size={16} />
                  <span>Khởi tạo quỹ phép năm {year}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nhân viên</th>
                    <th className="px-4 py-3">Loại phép</th>
                    <th className="px-4 py-3 text-right">Tiêu chuẩn</th>
                    <th className="px-4 py-3 text-right">Chuyển năm trước</th>
                    <th className="px-4 py-3 text-right">Đã dùng</th>
                    <th className="px-4 py-3 text-right">Chờ duyệt</th>
                    <th className="px-4 py-3 text-right">Còn lại</th>
                    {canManage && <th className="px-4 py-3 text-right">Điều chỉnh</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balances.map((bal) => (
                    <tr key={bal.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{bal.employeeName}</div>
                        <div className="text-xs text-slate-500">
                          {bal.employeeCode} • {bal.departmentName ?? '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{bal.leaveTypeName}</span>
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {bal.leaveTypeCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{bal.entitledDays}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {bal.carriedOverDays}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {bal.usedDays}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-700">
                        {bal.pendingDays}
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold text-blue-700">
                        {bal.remainingDays}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingBalance(bal);
                              setAdjEntitled(String(bal.entitledDays));
                              setAdjCarried(String(bal.carriedOverDays));
                              setAdjNote(bal.note ?? '');
                              setAdjustError(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <IconAdjustmentsHorizontal size={14} />
                            <span>Sửa</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Tên loại phép</th>
                  <th className="px-4 py-3 text-center">Hưởng lương</th>
                  <th className="px-4 py-3 text-right">Ngày/năm</th>
                  <th className="px-4 py-3 text-right">Kết chuyển tối đa</th>
                  <th className="px-4 py-3 text-center">Đính kèm</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  {canManage && <th className="px-4 py-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">
                      {lt.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{lt.name}</div>
                      {lt.description && (
                        <div className="text-xs text-slate-500">{lt.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          lt.isPaid
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {lt.isPaid ? 'Có' : 'Không'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {lt.defaultDaysPerYear > 0 ? `${lt.defaultDaysPerYear} ngày` : 'Không giới hạn'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {lt.allowCarryOver ? `${lt.maxCarryOverDays} ngày` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-600">
                      {lt.requiresAttachment ? 'Bắt buộc' : 'Tùy chọn'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          lt.isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {lt.isActive ? 'Đang áp dụng' : 'Ngưng'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            title="Sửa"
                            onClick={() => {
                              setEditingType(lt);
                              setIsTypeModalOpen(true);
                            }}
                            className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            type="button"
                            title="Xóa mềm"
                            onClick={() => setDeletingType(lt)}
                            className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {isTypeModalOpen && (
        <LeaveTypeFormModal
          key={editingType?.id ?? 'new-type'}
          editingItem={editingType}
          onClose={() => {
            setIsTypeModalOpen(false);
            setEditingType(null);
          }}
          onSaved={() => {
            setIsTypeModalOpen(false);
            setEditingType(null);
            setBannerMsg({ type: 'success', text: 'Đã lưu danh mục loại nghỉ phép thành công.' });
            triggerReload();
          }}
        />
      )}

      {isInitModalOpen && (
        <InitializeBalancesModal
          defaultYear={year}
          selectedBranchId={selectedBranchId}
          onClose={() => setIsInitModalOpen(false)}
          onCompleted={(summary) => {
            setIsInitModalOpen(false);
            setYear(summary.year);
            setBannerMsg({
              type: 'success',
              text: `Đã khởi tạo ${summary.createdCount} bản ghi quỹ phép năm ${summary.year} (bỏ qua ${summary.skippedCount} bản ghi đã tồn tại).`,
            });
            triggerReload();
          }}
        />
      )}

      {adjustingBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Điều chỉnh quỹ phép năm</h2>
              <button
                type="button"
                onClick={() => setAdjustingBalance(null)}
                disabled={isSavingAdjust}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={(e) => void handleSaveBalanceAdjustment(e)} className="space-y-4 p-6">
              {adjustError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  {adjustError}
                </div>
              )}
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-900">
                  {adjustingBalance.employeeName} ({adjustingBalance.employeeCode})
                </div>
                <div className="mt-1">
                  {adjustingBalance.leaveTypeName} — Năm {adjustingBalance.year} | Đã dùng:{' '}
                  <strong>{adjustingBalance.usedDays}</strong> | Chờ duyệt:{' '}
                  <strong>{adjustingBalance.pendingDays}</strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Phép tiêu chuẩn
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={adjEntitled}
                    onChange={(e) => setAdjEntitled(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Chuyển năm trước
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={adjCarried}
                    onChange={(e) => setAdjCarried(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Lý do điều chỉnh
                </label>
                <input
                  type="text"
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder="Ghi chú quyết định điều chỉnh phép..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setAdjustingBalance(null)}
                  disabled={isSavingAdjust}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdjust}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingAdjust && <IconLoader2 size={16} className="animate-spin" />}
                  <span>Lưu điều chỉnh</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingType)}
        title="Xóa mềm loại nghỉ phép"
        description={`Bạn có chắc muốn xóa loại nghỉ phép "${deletingType?.name}" (${deletingType?.code})? Hệ thống sẽ chặn xóa nếu đang có đơn chờ duyệt hoặc đã duyệt.`}
        confirmLabel="Xóa loại phép"
        variant="danger"
        isProcessing={isDeletingType}
        onConfirm={() => void handleDeleteLeaveType()}
        onCancel={() => setDeletingType(null)}
      />
    </div>
  );
}
