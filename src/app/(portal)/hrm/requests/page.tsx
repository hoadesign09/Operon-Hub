'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useI18n } from '@/shared/i18n/I18nContext';

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

const SESSION_SHORT: Record<LeaveSession, { vi: string; en: string }> = {
  FULL: { vi: 'Cả ngày', en: 'Full Day' },
  AM: { vi: 'Sáng', en: 'Morning' },
  PM: { vi: 'Chiều', en: 'Afternoon' },
};

const OT_RATE_BADGE: Record<OtRateType, { vi: string; en: string; className: string }> = {
  WEEKDAY_150: {
    vi: '150% (Thường)',
    en: '150% (Weekday)',
    className: 'bg-blue-50 text-blue-700',
  },
  WEEKEND_200: {
    vi: '200% (Cuối tuần)',
    en: '200% (Weekend)',
    className: 'bg-amber-50 text-amber-800',
  },
  HOLIDAY_300: {
    vi: '300% (Ngày lễ)',
    en: '300% (Holiday)',
    className: 'bg-rose-50 text-rose-700',
  },
};

const STATUS_BADGE: Record<RequestStatus, { vi: string; en: string; className: string }> = {
  DRAFT: { vi: 'Nháp', en: 'Draft', className: 'bg-slate-100 text-slate-700' },
  PENDING: { vi: 'Chờ duyệt', en: 'Pending', className: 'bg-amber-100 text-amber-800' },
  APPROVED: { vi: 'Đã duyệt', en: 'Approved', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { vi: 'Từ chối', en: 'Rejected', className: 'bg-rose-100 text-rose-700' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled', className: 'bg-slate-200 text-slate-600' },
};

export default function HrmRequestsPage() {
  const { user, selectedBranchId } = usePortalAuth();
  const { locale, tr } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);
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
        throw new Error(
          json.error?.message ??
            trRef.current('Không tải được danh mục loại phép.', 'Failed to load leave types.'),
        );
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
            throw new Error(
              json.error?.message ??
                trRef.current(
                  'Không tải được danh sách đơn nghỉ phép.',
                  'Failed to load leave requests.',
                ),
            );
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
            throw new Error(
              json.error?.message ??
                trRef.current(
                  'Không tải được danh sách đơn tăng ca.',
                  'Failed to load overtime requests.',
                ),
            );
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
            throw new Error(
              json.error?.message ??
                trRef.current(
                  'Không tải được danh sách đơn công tác.',
                  'Failed to load business trip requests.',
                ),
            );
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
            throw new Error(
              json.error?.message ??
                trRef.current('Không tải được quỹ phép năm.', 'Failed to load leave balances.'),
            );
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
        setErrorMsg(
          err instanceof Error
            ? err.message
            : trRef.current(
                'Lỗi tải dữ liệu quản trị đơn từ.',
                'Failed to load request management data.',
              ),
        );
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
          text:
            errJson?.error?.message ??
            tr('Không thể xuất file Excel.', 'Failed to export Excel file.'),
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
      setBannerMsg({
        type: 'success',
        text: tr(
          'Đã xuất dữ liệu ra Excel (.xlsx) thành công.',
          'Data exported to Excel (.xlsx) successfully.',
        ),
      });
    } catch {
      setBannerMsg({
        type: 'error',
        text: tr('Lỗi kết nối khi xuất Excel.', 'Connection error while exporting Excel.'),
      });
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
          text:
            json.error?.message ??
            tr('Không thể xóa loại nghỉ phép.', 'Failed to delete leave type.'),
        });
      } else {
        setBannerMsg({
          type: 'success',
          text: tr(
            `Đã xóa loại nghỉ phép "${deletingType.name}".`,
            `Deleted leave type "${deletingType.name}".`,
          ),
        });
        triggerReload();
      }
    } catch {
      setBannerMsg({
        type: 'error',
        text: tr('Lỗi kết nối máy chủ.', 'Server connection error.'),
      });
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
        setAdjustError(
          json.error?.message ??
            tr('Không thể điều chỉnh quỹ phép.', 'Failed to adjust leave balance.'),
        );
        setIsSavingAdjust(false);
        return;
      }
      setAdjustingBalance(null);
      setBannerMsg({
        type: 'success',
        text: tr(
          `Đã điều chỉnh quỹ phép cho ${adjustingBalance.employeeName}.`,
          `Adjusted leave balance for ${adjustingBalance.employeeName}.`,
        ),
      });
      triggerReload();
    } catch {
      setAdjustError(tr('Lỗi kết nối máy chủ.', 'Server connection error.'));
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
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Quản trị Đơn từ & Quỹ phép', 'Leave & Requests')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Quản lý đơn Nghỉ phép, Tăng ca (OT), Công tác, quỹ phép năm và danh mục loại phép',
              'Manage leave requests, overtime (OT), business trips, leave balances, and leave types',
            )}
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
              <span>{tr('Xuất Excel', 'Export Excel')}</span>
            </button>
          )}

          {activeTab === 'BALANCES' && canManage && (
            <button
              type="button"
              onClick={() => setIsInitModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <IconCalendarPlus size={17} />
              <span>{tr('Khởi tạo quỹ phép năm', 'Initialize Annual Balances')}</span>
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
              <span>{tr('Thêm loại phép', 'Add Leave Type')}</span>
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
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* 5 Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            { key: 'LEAVES', label: tr('Đơn nghỉ phép', 'Leave Requests') },
            { key: 'OVERTIMES', label: tr('Đơn Tăng ca (OT)', 'Overtime') },
            { key: 'TRIPS', label: tr('Đơn Công tác', 'Business Trips') },
            { key: 'BALANCES', label: tr('Quỹ phép năm', 'Leave Balances') },
            { key: 'TYPES', label: tr('Danh mục Loại phép', 'Leave Types') },
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
              placeholder={tr(
                'Tìm theo mã đơn, mã NV, họ tên, địa điểm/lý do...',
                'Search by code, employee, destination, or reason...',
              )}
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={year}
            onChange={(e) => {
              setIsLoading(true);
              setYear(Number(e.target.value));
            }}
            aria-label={tr('Chọn năm', 'Select year')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {tr(`Năm ${y}`, `Year ${y}`)}
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
              aria-label={tr('Lọc loại phép', 'Filter by leave type')}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">{tr('Tất cả loại phép', 'All leave types')}</option>
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
              aria-label={tr('Lọc hệ số OT', 'Filter by OT rate')}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">{tr('Tất cả hệ số OT', 'All OT rates')}</option>
              <option value="WEEKDAY_150">{tr('Ngày thường (150%)', 'Weekday (150%)')}</option>
              <option value="WEEKEND_200">{tr('Cuối tuần (200%)', 'Weekend (200%)')}</option>
              <option value="HOLIDAY_300">{tr('Ngày lễ (300%)', 'Holiday (300%)')}</option>
            </select>
          )}

          {isExportableTab && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setIsLoading(true);
                setStatusFilter(e.target.value);
              }}
              aria-label={tr('Lọc trạng thái', 'Filter by status')}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">{tr('Tất cả trạng thái', 'All statuses')}</option>
              <option value="DRAFT">{tr('Nháp', 'Draft')}</option>
              <option value="PENDING">{tr('Chờ duyệt', 'Pending')}</option>
              <option value="APPROVED">{tr('Đã duyệt', 'Approved')}</option>
              <option value="REJECTED">{tr('Từ chối', 'Rejected')}</option>
              <option value="CANCELLED">{tr('Đã hủy', 'Cancelled')}</option>
            </select>
          )}

          <button
            type="button"
            onClick={triggerReload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <IconRefresh size={16} />
            <span>{tr('Tải lại', 'Reload')}</span>
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
              <span>{tr('Thử lại', 'Retry')}</span>
            </button>
          </div>
        ) : activeTab === 'LEAVES' ? (
          leaves.length === 0 ? (
            <div className="p-10 text-center">
              <IconCalendarOff size={36} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {tr(
                  'Không có đơn nghỉ phép nào khớp bộ lọc',
                  'No leave requests match the current filters',
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{tr('Mã đơn', 'Code')}</th>
                    <th className="px-4 py-3">{tr('Nhân viên', 'Employee')}</th>
                    <th className="px-4 py-3">{tr('Loại phép', 'Leave Type')}</th>
                    <th className="px-4 py-3">{tr('Thời gian', 'Duration')}</th>
                    <th className="px-4 py-3 text-right">{tr('Số ngày', 'Days')}</th>
                    <th className="px-4 py-3">{tr('Lý do', 'Reason')}</th>
                    <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-4 py-3 text-right">{tr('Duyệt', 'Approval')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map((item) => {
                    const badge = STATUS_BADGE[item.status];
                    const startSessionLabel = SESSION_SHORT[item.startSession];
                    const endSessionLabel = SESSION_SHORT[item.endSession];
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
                            {formatDateVN(item.startDate)} (
                            {locale === 'en' ? startSessionLabel.en : startSessionLabel.vi})
                          </div>
                          <div className="text-slate-500">
                            → {formatDateVN(item.endDate)} (
                            {locale === 'en' ? endSessionLabel.en : endSessionLabel.vi})
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
                            {locale === 'en' ? badge.en : badge.vi}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.approvalRequestId ? (
                            <Link
                              href="/approvals"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <span>{tr('Hộp thư', 'Inbox')}</span>
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
                {tr(
                  'Không có đơn tăng ca (OT) nào khớp bộ lọc',
                  'No overtime requests match the current filters',
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{tr('Mã đơn', 'Code')}</th>
                    <th className="px-4 py-3">{tr('Nhân viên', 'Employee')}</th>
                    <th className="px-4 py-3">{tr('Ngày & Giờ OT', 'OT Date & Time')}</th>
                    <th className="px-4 py-3 text-right">{tr('Tổng giờ', 'Total Hours')}</th>
                    <th className="px-4 py-3">{tr('Hệ số OT', 'OT Rate')}</th>
                    <th className="px-4 py-3">{tr('Lý do', 'Reason')}</th>
                    <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-4 py-3 text-right">{tr('Duyệt', 'Approval')}</th>
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
                            {locale === 'en' ? rateBadge.en : rateBadge.vi}
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
                            {locale === 'en' ? badge.en : badge.vi}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.approvalRequestId ? (
                            <Link
                              href="/approvals"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <span>{tr('Hộp thư', 'Inbox')}</span>
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
                {tr(
                  'Không có đơn công tác nào khớp bộ lọc',
                  'No business trip requests match the current filters',
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{tr('Mã đơn', 'Code')}</th>
                    <th className="px-4 py-3">{tr('Nhân viên', 'Employee')}</th>
                    <th className="px-4 py-3">{tr('Địa điểm', 'Destination')}</th>
                    <th className="px-4 py-3">{tr('Thời gian', 'Duration')}</th>
                    <th className="px-4 py-3 text-right">{tr('Dự kiến phí', 'Est. Cost')}</th>
                    <th className="px-4 py-3">{tr('Mục đích', 'Purpose')}</th>
                    <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-4 py-3 text-right">{tr('Duyệt', 'Approval')}</th>
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
                          <div className="text-slate-500">
                            {item.totalDays} {tr('ngày', 'days')}
                          </div>
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
                            {locale === 'en' ? badge.en : badge.vi}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.approvalRequestId ? (
                            <Link
                              href="/approvals"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <span>{tr('Hộp thư', 'Inbox')}</span>
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
                {tr(
                  `Chưa có bản ghi quỹ phép năm ${year}`,
                  `No leave balance records for ${year}`,
                )}
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsInitModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <IconCalendarPlus size={16} />
                  <span>
                    {tr(`Khởi tạo quỹ phép năm ${year}`, `Initialize ${year} Balances`)}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{tr('Nhân viên', 'Employee')}</th>
                    <th className="px-4 py-3">{tr('Loại phép', 'Leave Type')}</th>
                    <th className="px-4 py-3 text-right">{tr('Tiêu chuẩn', 'Entitled')}</th>
                    <th className="px-4 py-3 text-right">{tr('Chuyển năm trước', 'Carried Over')}</th>
                    <th className="px-4 py-3 text-right">{tr('Đã dùng', 'Used')}</th>
                    <th className="px-4 py-3 text-right">{tr('Chờ duyệt', 'Pending')}</th>
                    <th className="px-4 py-3 text-right">{tr('Còn lại', 'Remaining')}</th>
                    {canManage && (
                      <th className="px-4 py-3 text-right">{tr('Điều chỉnh', 'Adjust')}</th>
                    )}
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
                            <span>{tr('Sửa', 'Edit')}</span>
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
                  <th className="px-4 py-3">{tr('Mã', 'Code')}</th>
                  <th className="px-4 py-3">{tr('Tên loại phép', 'Leave Type Name')}</th>
                  <th className="px-4 py-3 text-center">{tr('Hưởng lương', 'Paid')}</th>
                  <th className="px-4 py-3 text-right">{tr('Ngày/năm', 'Days/Year')}</th>
                  <th className="px-4 py-3 text-right">
                    {tr('Kết chuyển tối đa', 'Max Carry-Over')}
                  </th>
                  <th className="px-4 py-3 text-center">{tr('Đính kèm', 'Attachment')}</th>
                  <th className="px-4 py-3 text-center">{tr('Trạng thái', 'Status')}</th>
                  {canManage && (
                    <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                  )}
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
                        {lt.isPaid ? tr('Có', 'Yes') : tr('Không', 'No')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {lt.defaultDaysPerYear > 0
                        ? tr(`${lt.defaultDaysPerYear} ngày`, `${lt.defaultDaysPerYear} days`)
                        : tr('Không giới hạn', 'Unlimited')}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {lt.allowCarryOver
                        ? tr(`${lt.maxCarryOverDays} ngày`, `${lt.maxCarryOverDays} days`)
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-600">
                      {lt.requiresAttachment
                        ? tr('Bắt buộc', 'Required')
                        : tr('Tùy chọn', 'Optional')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          lt.isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {lt.isActive ? tr('Đang áp dụng', 'Active') : tr('Ngưng', 'Inactive')}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            title={tr('Sửa', 'Edit')}
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
                            title={tr('Xóa mềm', 'Soft delete')}
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
            setBannerMsg({
              type: 'success',
              text: tr(
                'Đã lưu danh mục loại nghỉ phép thành công.',
                'Leave type saved successfully.',
              ),
            });
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
              text: tr(
                `Đã khởi tạo ${summary.createdCount} bản ghi quỹ phép năm ${summary.year} (bỏ qua ${summary.skippedCount} bản ghi đã tồn tại).`,
                `Initialized ${summary.createdCount} leave balance records for ${summary.year} (skipped ${summary.skippedCount} existing).`,
              ),
            });
            triggerReload();
          }}
        />
      )}

      {adjustingBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {tr('Điều chỉnh quỹ phép năm', 'Adjust Annual Leave Balance')}
              </h2>
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
                  {adjustingBalance.leaveTypeName} — {tr('Năm', 'Year')} {adjustingBalance.year} |{' '}
                  {tr('Đã dùng:', 'Used:')} <strong>{adjustingBalance.usedDays}</strong> |{' '}
                  {tr('Chờ duyệt:', 'Pending:')} <strong>{adjustingBalance.pendingDays}</strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Phép tiêu chuẩn', 'Entitled Days')}
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
                    {tr('Chuyển năm trước', 'Carried Over')}
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
                  {tr('Lý do điều chỉnh', 'Adjustment Reason')}
                </label>
                <input
                  type="text"
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder={tr(
                    'Ghi chú quyết định điều chỉnh phép...',
                    'Notes for this leave balance adjustment...',
                  )}
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
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdjust}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingAdjust && <IconLoader2 size={16} className="animate-spin" />}
                  <span>{tr('Lưu điều chỉnh', 'Save Adjustment')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingType)}
        title={tr('Xóa mềm loại nghỉ phép', 'Soft Delete Leave Type')}
        description={tr(
          `Bạn có chắc muốn xóa loại nghỉ phép "${deletingType?.name}" (${deletingType?.code})? Hệ thống sẽ chặn xóa nếu đang có đơn chờ duyệt hoặc đã duyệt.`,
          `Are you sure you want to delete leave type "${deletingType?.name}" (${deletingType?.code})? Deletion is blocked if there are pending or approved requests.`,
        )}
        confirmLabel={tr('Xóa loại phép', 'Delete Leave Type')}
        variant="danger"
        isProcessing={isDeletingType}
        onConfirm={() => void handleDeleteLeaveType()}
        onCancel={() => setDeletingType(null)}
      />
    </div>
  );
}
