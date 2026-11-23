'use client';

import { useEffect, useState } from 'react';
import {
  IconCalendarHeart,
  IconClipboardCheck,
  IconClockHour8,
  IconDownload,
  IconEdit,
  IconFileSpreadsheet,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUsersGroup,
} from '@tabler/icons-react';
import { AttendanceImportModal } from '@/components/hrm/AttendanceImportModal';
import { AttendanceSummariesPanel } from '@/components/hrm/AttendanceSummariesPanel';
import { HolidayFormModal, type HolidayRecord } from '@/components/hrm/HolidayFormModal';
import {
  ManualAttendanceModal,
  type AttendanceLogRecord,
} from '@/components/hrm/ManualAttendanceModal';
import {
  ShiftAssignmentModal,
  type SimpleEmployeeOption,
} from '@/components/hrm/ShiftAssignmentModal';
import {
  WorkShiftFormModal,
  type BranchOption,
  type WorkShiftRecord,
} from '@/components/hrm/WorkShiftFormModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatDateVN } from '@/lib/portable/date-utils';

type ActiveTab = 'logs' | 'summaries' | 'shifts' | 'assignments' | 'holidays';

interface ShiftAssignmentRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string;
  departmentName: string;
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  workDays: number[];
  note: string | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PRESENT: { label: 'Đúng giờ', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LATE: { label: 'Đi muộn', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ABSENT: { label: 'Vắng mặt', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  LEAVE: { label: 'Nghỉ phép', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  HOLIDAY: { label: 'Ngày lễ', className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const SOURCE_LABELS: Record<string, string> = {
  WEB: 'Web ESS',
  IMPORT: 'Import Excel',
  MANUAL: 'HR chỉnh tay',
};

const DAY_LABELS: Record<number, string> = {
  0: 'CN',
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
};

function getMonthDefaultRange(): { fromDate: string; toDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { fromDate: `${y}-${m}-01`, toDate: `${y}-${m}-${d}` };
}

export default function HrmAttendancePage() {
  const { user, selectedBranchId } = usePortalAuth();
  const perms = new Set(user?.permissions ?? []);
  const canManage = Boolean(user?.isSuperAdmin || perms.has('hrm.attendance.manage'));
  const canLock = Boolean(user?.isSuperAdmin || perms.has('hrm.attendance.lock'));
  const canImport = Boolean(user?.isSuperAdmin || perms.has('hrm.attendance.import'));
  const canExport = Boolean(user?.isSuperAdmin || perms.has('hrm.attendance.export'));

  const defaultRange = getMonthDefaultRange();
  const [activeTab, setActiveTab] = useState<ActiveTab>('logs');

  // Shared lookup options
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<SimpleEmployeeOption[]>([]);
  const [shifts, setShifts] = useState<WorkShiftRecord[]>([]);

  // Tab 1: Logs state
  const [logs, setLogs] = useState<AttendanceLogRecord[]>([]);
  const [logsMeta, setLogsMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [logSearchInput, setLogSearchInput] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logsPage, setLogsPage] = useState(1);

  // Tab 2: Shifts state
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftsError, setShiftsError] = useState<string | null>(null);

  // Tab 3: Assignments state
  const [assignments, setAssignments] = useState<ShiftAssignmentRecord[]>([]);
  const [assignmentsMeta, setAssignmentsMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [assignShiftFilter, setAssignShiftFilter] = useState('');
  const [assignSearchInput, setAssignSearchInput] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignPage, setAssignPage] = useState(1);

  // Tab 4: Holidays state
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());

  // Modals & reload ticks
  const [reloadTick, setReloadTick] = useState(0);
  const [shiftModalState, setShiftModalState] = useState<{
    open: boolean;
    data: WorkShiftRecord | null;
  }>({ open: false, data: null });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [holidayModalState, setHolidayModalState] = useState<{
    open: boolean;
    data: HolidayRecord | null;
  }>({ open: false, data: null });
  const [manualModalState, setManualModalState] = useState<{
    open: boolean;
    data: AttendanceLogRecord | null;
  }>({ open: false, data: null });
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'shift' | 'assignment' | 'holiday';
    id: number;
    label: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Debounce search inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setLogSearch(logSearchInput.trim());
      setLogsPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [logSearchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAssignSearch(assignSearchInput.trim());
      setAssignPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [assignSearchInput]);

  // Load branches, employees & shifts lookup
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/v1/core/branches?limit=100', { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/v1/hrm/employees?limit=100', { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/v1/hrm/attendance/shifts', { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([branchJson, empJson, shiftJson]) => {
      if (controller.signal.aborted) {
        return;
      }
      if (branchJson?.success && Array.isArray(branchJson.data?.items)) {
        setBranches(branchJson.data.items as BranchOption[]);
      }
      if (empJson?.success && Array.isArray(empJson.data?.items)) {
        const mapped = (
          empJson.data.items as Array<{
            id: number;
            employeeCode: string;
            fullName: string;
            departmentName?: string;
          }>
        ).map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          departmentName: e.departmentName ?? '',
        }));
        setEmployees(mapped);
      }
      if (shiftJson?.success && Array.isArray(shiftJson.data?.items)) {
        setShifts(shiftJson.data.items as WorkShiftRecord[]);
      }
    });
    return () => controller.abort();
  }, [reloadTick]);

  // Fetch Attendance Logs
  useEffect(() => {
    if (activeTab !== 'logs') {
      return;
    }
    const controller = new AbortController();
    const qs = new URLSearchParams({
      page: String(logsPage),
      limit: '20',
    });
    if (fromDate) qs.set('fromDate', fromDate);
    if (toDate) qs.set('toDate', toDate);
    if (selectedBranchId) qs.set('branchId', String(selectedBranchId));
    if (statusFilter) qs.set('status', statusFilter);
    if (sourceFilter) qs.set('source', sourceFilter);
    if (logSearch) qs.set('search', logSearch);

    fetch(`/api/v1/hrm/attendance/logs?${qs.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { items: AttendanceLogRecord[] };
          meta?: PaginationMeta;
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? 'Không thể tải danh sách chấm công.');
        }
        setLogs(json.data?.items ?? []);
        if (json.meta) setLogsMeta(json.meta);
        setLogsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setLogsError(err instanceof Error ? err.message : 'Lỗi tải danh sách chấm công.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLogsLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, fromDate, toDate, selectedBranchId, statusFilter, sourceFilter, logSearch, logsPage, reloadTick]);

  // Fetch Work Shifts tab
  useEffect(() => {
    if (activeTab !== 'shifts') {
      return;
    }
    const controller = new AbortController();
    const qs = new URLSearchParams();
    if (selectedBranchId) qs.set('branchId', String(selectedBranchId));

    fetch(`/api/v1/hrm/attendance/shifts?${qs.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { items: WorkShiftRecord[] };
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? 'Không thể tải danh sách ca làm việc.');
        }
        setShifts(json.data?.items ?? []);
        setShiftsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setShiftsError(err instanceof Error ? err.message : 'Lỗi tải ca làm việc.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setShiftsLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, selectedBranchId, reloadTick]);

  // Fetch Shift Assignments tab
  useEffect(() => {
    if (activeTab !== 'assignments') {
      return;
    }
    const controller = new AbortController();
    const qs = new URLSearchParams({ page: String(assignPage), limit: '20' });
    if (selectedBranchId) qs.set('branchId', String(selectedBranchId));
    if (assignShiftFilter) qs.set('shiftId', assignShiftFilter);
    if (assignSearch) qs.set('search', assignSearch);

    fetch(`/api/v1/hrm/attendance/shift-assignments?${qs.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { items: ShiftAssignmentRecord[] };
          meta?: PaginationMeta;
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? 'Không thể tải danh sách phân ca.');
        }
        setAssignments(json.data?.items ?? []);
        if (json.meta) setAssignmentsMeta(json.meta);
        setAssignmentsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAssignmentsError(err instanceof Error ? err.message : 'Lỗi tải danh sách phân ca.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setAssignmentsLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, selectedBranchId, assignShiftFilter, assignSearch, assignPage, reloadTick]);

  // Fetch Holidays tab
  useEffect(() => {
    if (activeTab !== 'holidays') {
      return;
    }
    const controller = new AbortController();
    const qs = new URLSearchParams({ year: String(holidayYear) });
    if (selectedBranchId) qs.set('branchId', String(selectedBranchId));

    fetch(`/api/v1/hrm/attendance/holidays?${qs.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { items: HolidayRecord[] };
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? 'Không thể tải lịch ngày lễ.');
        }
        setHolidays(json.data?.items ?? []);
        setHolidaysError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setHolidaysError(err instanceof Error ? err.message : 'Lỗi tải lịch ngày lễ.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setHolidaysLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, holidayYear, selectedBranchId, reloadTick]);

  function switchTab(next: ActiveTab) {
    setActiveTab(next);
    if (next === 'logs') setLogsLoading(true);
    if (next === 'shifts') setShiftsLoading(true);
    if (next === 'assignments') setAssignmentsLoading(true);
    if (next === 'holidays') setHolidaysLoading(true);
  }

  function triggerRefresh(message?: string) {
    if (activeTab === 'logs') setLogsLoading(true);
    if (activeTab === 'shifts') setShiftsLoading(true);
    if (activeTab === 'assignments') setAssignmentsLoading(true);
    if (activeTab === 'holidays') setHolidaysLoading(true);
    if (message) {
      setToastMsg(message);
      setTimeout(() => setToastMsg(null), 3500);
    }
    setReloadTick((t) => t + 1);
  }

  function buildExportUrl(): string {
    const qs = new URLSearchParams();
    if (fromDate) qs.set('fromDate', fromDate);
    if (toDate) qs.set('toDate', toDate);
    if (selectedBranchId) qs.set('branchId', String(selectedBranchId));
    if (statusFilter) qs.set('status', statusFilter);
    if (sourceFilter) qs.set('source', sourceFilter);
    if (logSearch) qs.set('search', logSearch);
    return `/api/v1/hrm/attendance/export?${qs.toString()}`;
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setIsDeleting(true);

    const urlMap = {
      shift: `/api/v1/hrm/attendance/shifts/${confirmDelete.id}`,
      assignment: `/api/v1/hrm/attendance/shift-assignments/${confirmDelete.id}`,
      holiday: `/api/v1/hrm/attendance/holidays/${confirmDelete.id}`,
    };

    try {
      const res = await fetch(urlMap[confirmDelete.kind], { method: 'DELETE' });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setToastMsg(json.error?.message ?? 'Xóa dữ liệu thất bại.');
        setIsDeleting(false);
        setConfirmDelete(null);
        return;
      }

      setIsDeleting(false);
      setConfirmDelete(null);
      triggerRefresh('Đã xóa dữ liệu thành công.');
    } catch {
      setToastMsg('Lỗi kết nối máy chủ khi xóa dữ liệu.');
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản trị Chấm công, Ca làm & Ngày lễ</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi nhật ký chấm công hàng ngày, Import/Export Excel, quản trị ca làm việc và lịch ngày lễ Việt Nam.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'logs' && (
            <>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setManualModalState({ open: true, data: null })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <IconPlus size={16} />
                  <span>Chấm công tay</span>
                </button>
              )}
              {canImport && (
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <IconFileSpreadsheet size={16} />
                  <span>Import Excel</span>
                </button>
              )}
              {canExport && (
                <a
                  href={buildExportUrl()}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <IconDownload size={16} />
                  <span>Xuất Excel</span>
                </a>
              )}
            </>
          )}
          {activeTab === 'shifts' && canManage && (
            <button
              type="button"
              onClick={() => setShiftModalState({ open: true, data: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>Tạo ca làm việc</span>
            </button>
          )}
          {activeTab === 'assignments' && canManage && (
            <button
              type="button"
              onClick={() => setAssignModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>Phân ca nhân viên</span>
            </button>
          )}
          {activeTab === 'holidays' && canManage && (
            <button
              type="button"
              onClick={() => setHolidayModalState({ open: true, data: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>Thêm ngày lễ</span>
            </button>
          )}
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-800">
          {toastMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { key: 'logs', label: 'Nhật ký chấm công', icon: IconClockHour8 },
            { key: 'summaries', label: 'Bảng công tháng', icon: IconClipboardCheck },
            { key: 'shifts', label: 'Ca làm việc', icon: IconClockHour8 },
            { key: 'assignments', label: 'Phân ca nhân viên', icon: IconUsersGroup },
            { key: 'holidays', label: 'Lịch ngày lễ VN', icon: IconCalendarHeart },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ATTENDANCE LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Từ ngày</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setLogsPage(1);
                  setLogsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Đến ngày</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setLogsPage(1);
                  setLogsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Trạng thái</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setLogsPage(1);
                  setLogsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PRESENT">Đúng giờ</option>
                <option value="LATE">Đi muộn</option>
                <option value="ABSENT">Vắng mặt</option>
                <option value="LEAVE">Nghỉ phép</option>
                <option value="HOLIDAY">Ngày lễ</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Nguồn dữ liệu</label>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setLogsPage(1);
                  setLogsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              >
                <option value="">Tất cả nguồn</option>
                <option value="WEB">Web ESS</option>
                <option value="IMPORT">Import Excel</option>
                <option value="MANUAL">HR chỉnh tay</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Tìm nhân viên</label>
              <div className="relative">
                <IconSearch size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={logSearchInput}
                  onChange={(e) => setLogSearchInput(e.target.value)}
                  placeholder="Mã NV hoặc họ tên..."
                  className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {logsLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : logsError ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-rose-700">{logsError}</p>
                <button
                  type="button"
                  onClick={() => triggerRefresh()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  <IconRefresh size={15} />
                  <span>Thử lại</span>
                </button>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Không có dữ liệu chấm công trong khoảng thời gian đã chọn.
                </p>
                {canImport && (
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white"
                  >
                    <IconFileSpreadsheet size={15} />
                    <span>Import Excel ngay</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Ngày</th>
                        <th className="px-4 py-3 font-semibold">Nhân viên</th>
                        <th className="px-4 py-3 font-semibold">Phòng ban</th>
                        <th className="px-4 py-3 font-semibold">Ca</th>
                        <th className="px-4 py-3 text-center font-semibold">Vào / Ra</th>
                        <th className="px-4 py-3 text-right font-semibold">Muộn / Sớm</th>
                        <th className="px-4 py-3 text-right font-semibold">Giờ công</th>
                        <th className="px-4 py-3 text-center font-semibold">Nguồn</th>
                        <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                        {canManage && <th className="px-4 py-3 text-right font-semibold">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((row) => {
                        const badge = STATUS_BADGE[row.status] ?? {
                          label: row.status,
                          className: 'bg-slate-100 text-slate-700 border-slate-200',
                        };
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {formatDateVN(row.workDate)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{row.employeeName}</div>
                              <div className="text-[11px] text-slate-500">{row.employeeCode}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{row.departmentName}</td>
                            <td className="px-4 py-3 text-slate-600">{row.shiftCode ?? '-'}</td>
                            <td className="px-4 py-3 text-center font-mono font-semibold">
                              <span className="text-emerald-700">{row.checkInTime ?? '--:--'}</span>
                              <span className="mx-1 text-slate-300">/</span>
                              <span className="text-blue-700">{row.checkOutTime ?? '--:--'}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={row.lateMinutes > 0 ? 'font-semibold text-amber-600' : 'text-slate-400'}>
                                {row.lateMinutes}p
                              </span>
                              <span className="mx-1 text-slate-300">/</span>
                              <span className={row.earlyLeaveMinutes > 0 ? 'font-semibold text-rose-600' : 'text-slate-400'}>
                                {row.earlyLeaveMinutes}p
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                              {row.workedHours.toFixed(2)}h
                            </td>
                            <td className="px-4 py-3 text-center text-slate-500">
                              {SOURCE_LABELS[row.source] ?? row.source}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 font-medium ${badge.className}`}>
                                {badge.label}
                              </span>
                            </td>
                            {canManage && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setManualModalState({ open: true, data: row })}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  <IconEdit size={14} />
                                  <span>Sửa</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {logsMeta.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                    <span>
                      Trang {logsMeta.page}/{logsMeta.totalPages} ({logsMeta.total} bản ghi)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={logsPage <= 1}
                        onClick={() => {
                          setLogsPage((p) => p - 1);
                          setLogsLoading(true);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        disabled={logsPage >= logsMeta.totalPages}
                        onClick={() => {
                          setLogsPage((p) => p + 1);
                          setLogsLoading(true);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MONTHLY ATTENDANCE SUMMARIES */}
      {activeTab === 'summaries' && (
        <AttendanceSummariesPanel
          selectedBranchId={selectedBranchId}
          canManage={canManage}
          canLock={canLock}
          canExport={canExport}
        />
      )}

      {/* TAB 3: WORK SHIFTS */}
      {activeTab === 'shifts' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {shiftsLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : shiftsError ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-rose-700">{shiftsError}</p>
              <button
                type="button"
                onClick={() => triggerRefresh()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white"
              >
                <IconRefresh size={15} />
                <span>Thử lại</span>
              </button>
            </div>
          ) : shifts.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Chưa có ca làm việc nào được cấu hình.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Mã / Tên ca</th>
                    <th className="px-4 py-3 font-semibold">Phạm vi</th>
                    <th className="px-4 py-3 text-center font-semibold">Giờ làm việc</th>
                    <th className="px-4 py-3 text-center font-semibold">Nghỉ trưa</th>
                    <th className="px-4 py-3 text-right font-semibold">Giờ công</th>
                    <th className="px-4 py-3 text-center font-semibold">Dung sai (M/S)</th>
                    <th className="px-4 py-3 text-right font-semibold">Đang phân ca</th>
                    <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                    {canManage && <th className="px-4 py-3 text-right font-semibold">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{shift.code}</span>
                          {shift.isDefault && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600">{shift.name}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {shift.branchName ?? 'Toàn công ty'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-slate-800">
                        {shift.startTime} – {shift.endTime}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {shift.breakStartTime && shift.breakEndTime
                          ? `${shift.breakStartTime} – ${shift.breakEndTime}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">
                        {shift.workingHours.toFixed(2)}h
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {shift.lateGraceMinutes}p / {shift.earlyLeaveGraceMinutes}p
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {shift.assignedEmployeeCount} NV
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            shift.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {shift.isActive ? 'Hoạt động' : 'Ngừng dùng'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShiftModalState({ open: true, data: shift })}
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                              title="Chỉnh sửa"
                            >
                              <IconEdit size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  kind: 'shift',
                                  id: shift.id,
                                  label: `ca làm việc ${shift.code} - ${shift.name}`,
                                })
                              }
                              className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                              title="Xóa mềm"
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
      )}

      {/* TAB 3: SHIFT ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Lọc theo ca</label>
              <select
                value={assignShiftFilter}
                onChange={(e) => {
                  setAssignShiftFilter(e.target.value);
                  setAssignPage(1);
                  setAssignmentsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              >
                <option value="">Tất cả ca làm việc</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Tìm nhân viên</label>
              <input
                type="text"
                value={assignSearchInput}
                onChange={(e) => setAssignSearchInput(e.target.value)}
                placeholder="Nhập mã NV hoặc họ tên..."
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {assignmentsLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : assignmentsError ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-rose-700">{assignmentsError}</p>
                <button
                  type="button"
                  onClick={() => triggerRefresh()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  <IconRefresh size={15} />
                  <span>Thử lại</span>
                </button>
              </div>
            ) : assignments.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Chưa có bản ghi phân ca nào phù hợp.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Nhân viên</th>
                        <th className="px-4 py-3 font-semibold">Phòng ban</th>
                        <th className="px-4 py-3 font-semibold">Ca áp dụng</th>
                        <th className="px-4 py-3 text-center font-semibold">Hiệu lực</th>
                        <th className="px-4 py-3 font-semibold">Ngày làm trong tuần</th>
                        <th className="px-4 py-3 font-semibold">Ghi chú</th>
                        {canManage && <th className="px-4 py-3 text-right font-semibold">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignments.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.employeeName}</div>
                            <div className="text-[11px] text-slate-500">{item.employeeCode}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.departmentName}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-semibold text-blue-700">{item.shiftCode}</span>
                            <span className="ml-1.5 text-slate-600">
                              ({item.startTime}–{item.endTime})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">
                            {formatDateVN(item.effectiveFrom)} →{' '}
                            {item.effectiveTo ? formatDateVN(item.effectiveTo) : 'Hiện tại'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {item.workDays.map((d) => (
                                <span
                                  key={d}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                                >
                                  {DAY_LABELS[d] ?? d}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{item.note ?? '-'}</td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDelete({
                                    kind: 'assignment',
                                    id: item.id,
                                    label: `phân ca ${item.shiftCode} của ${item.employeeCode}`,
                                  })
                                }
                                className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                                title="Gỡ phân ca"
                              >
                                <IconTrash size={15} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {assignmentsMeta.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                    <span>
                      Trang {assignmentsMeta.page}/{assignmentsMeta.totalPages} ({assignmentsMeta.total} bản ghi)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={assignPage <= 1}
                        onClick={() => {
                          setAssignPage((p) => p - 1);
                          setAssignmentsLoading(true);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        disabled={assignPage >= assignmentsMeta.totalPages}
                        onClick={() => {
                          setAssignPage((p) => p + 1);
                          setAssignmentsLoading(true);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: HOLIDAYS */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">
              Danh mục ngày nghỉ lễ áp dụng tính công, đơn nghỉ phép và hệ số OT 300%.
            </div>
            <select
              value={holidayYear}
              onChange={(e) => {
                setHolidayYear(Number(e.target.value));
                setHolidaysLoading(true);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              {[2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {holidaysLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : holidaysError ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-rose-700">{holidaysError}</p>
                <button
                  type="button"
                  onClick={() => triggerRefresh()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  <IconRefresh size={15} />
                  <span>Thử lại</span>
                </button>
              </div>
            ) : holidays.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Chưa có ngày lễ nào trong năm {holidayYear}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Ngày lễ</th>
                      <th className="px-4 py-3 font-semibold">Tên ngày lễ</th>
                      <th className="px-4 py-3 font-semibold">Phạm vi áp dụng</th>
                      <th className="px-4 py-3 text-center font-semibold">Hưởng lương</th>
                      <th className="px-4 py-3 font-semibold">Ghi chú</th>
                      {canManage && <th className="px-4 py-3 text-right font-semibold">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {holidays.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                          {formatDateVN(item.holidayDate)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.branchName ?? 'Toàn công ty'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              item.isPaid
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.isPaid ? 'Có lương' : 'Không lương'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{item.note ?? '-'}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setHolidayModalState({ open: true, data: item })}
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                                title="Chỉnh sửa"
                              >
                                <IconEdit size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDelete({
                                    kind: 'holiday',
                                    id: item.id,
                                    label: `ngày lễ "${item.name}" (${formatDateVN(item.holidayDate)})`,
                                  })
                                }
                                className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                                title="Xóa mềm"
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
        </div>
      )}

      {/* Modals */}
      {shiftModalState.open && (
        <WorkShiftFormModal
          key={shiftModalState.data?.id ?? 'new-shift'}
          initialData={shiftModalState.data}
          branches={branches}
          onClose={() => setShiftModalState({ open: false, data: null })}
          onSuccess={() => {
            setShiftModalState({ open: false, data: null });
            triggerRefresh('Đã lưu ca làm việc thành công.');
          }}
        />
      )}

      {assignModalOpen && (
        <ShiftAssignmentModal
          shifts={shifts}
          employees={employees}
          onClose={() => setAssignModalOpen(false)}
          onSuccess={() => {
            setAssignModalOpen(false);
            triggerRefresh('Đã phân ca làm việc cho nhân viên thành công.');
          }}
        />
      )}

      {holidayModalState.open && (
        <HolidayFormModal
          key={holidayModalState.data?.id ?? 'new-holiday'}
          initialData={holidayModalState.data}
          branches={branches}
          defaultYear={holidayYear}
          onClose={() => setHolidayModalState({ open: false, data: null })}
          onSuccess={() => {
            setHolidayModalState({ open: false, data: null });
            triggerRefresh('Đã lưu ngày lễ thành công.');
          }}
        />
      )}

      {manualModalState.open && (
        <ManualAttendanceModal
          key={manualModalState.data?.id ?? 'new-manual'}
          initialData={manualModalState.data}
          employees={employees}
          shifts={shifts}
          onClose={() => setManualModalState({ open: false, data: null })}
          onSuccess={() => {
            setManualModalState({ open: false, data: null });
            triggerRefresh('Đã lưu điều chỉnh chấm công và ghi Audit Log.');
          }}
        />
      )}

      {importModalOpen && (
        <AttendanceImportModal
          onClose={() => setImportModalOpen(false)}
          onImported={() => triggerRefresh('Đã import dữ liệu chấm công từ Excel.')}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        title="Xác nhận xóa dữ liệu"
        description={
          confirmDelete
            ? `Bạn có chắc chắn muốn xóa ${confirmDelete.label}? Hành động này sẽ thực hiện xóa mềm và lưu vết lịch sử hệ thống.`
            : ''
        }
        confirmLabel="Xác nhận xóa"
        cancelLabel="Hủy"
        variant="danger"
        isProcessing={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
