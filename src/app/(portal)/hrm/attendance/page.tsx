'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useI18n } from '@/shared/i18n/I18nContext';

type ActiveTab = 'logs' | 'summaries' | 'shifts' | 'assignments' | 'holidays';

interface ShiftAssignmentRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string;
  branchNameEn?: string | null;
  departmentName: string;
  departmentNameEn?: string | null;
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  shiftNameEn?: string | null;
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

const STATUS_BADGE: Record<string, { vi: string; en: string; className: string }> = {
  PRESENT: { vi: 'Đúng giờ', en: 'On Time', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LATE: { vi: 'Đi muộn', en: 'Late', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ABSENT: { vi: 'Vắng mặt', en: 'Absent', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  LEAVE: { vi: 'Nghỉ phép', en: 'On Leave', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  HOLIDAY: { vi: 'Ngày lễ', en: 'Holiday', className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const SOURCE_LABELS: Record<string, { vi: string; en: string }> = {
  WEB: { vi: 'Web ESS', en: 'Web ESS' },
  IMPORT: { vi: 'Import Excel', en: 'Excel Import' },
  MANUAL: { vi: 'HR chỉnh tay', en: 'HR Manual' },
};

const DAY_LABELS: Record<number, { vi: string; en: string }> = {
  0: { vi: 'CN', en: 'Sun' },
  1: { vi: 'T2', en: 'Mon' },
  2: { vi: 'T3', en: 'Tue' },
  3: { vi: 'T4', en: 'Wed' },
  4: { vi: 'T5', en: 'Thu' },
  5: { vi: 'T6', en: 'Fri' },
  6: { vi: 'T7', en: 'Sat' },
};

function getMonthDefaultRange(): { fromDate: string; toDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { fromDate: `${y}-${m}-01`, toDate: `${y}-${m}-${d}` };
}

export default function HrmAttendancePage() {
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

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
            departmentNameEn?: string | null;
          }>
        ).map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          departmentName: e.departmentName ?? '',
          departmentNameEn: e.departmentNameEn ?? null,
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
          throw new Error(
            json.error?.message ??
              trRef.current(
                'Không thể tải danh sách chấm công.',
                'Failed to load attendance logs.',
              ),
          );
        }
        setLogs(json.data?.items ?? []);
        if (json.meta) setLogsMeta(json.meta);
        setLogsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setLogsError(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải danh sách chấm công.', 'Error loading attendance logs.'),
        );
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
          throw new Error(
            json.error?.message ??
              trRef.current('Không thể tải danh sách ca làm việc.', 'Failed to load work shifts.'),
          );
        }
        setShifts(json.data?.items ?? []);
        setShiftsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setShiftsError(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải ca làm việc.', 'Error loading work shifts.'),
        );
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
          throw new Error(
            json.error?.message ??
              trRef.current(
                'Không thể tải danh sách phân ca.',
                'Failed to load shift assignments.',
              ),
          );
        }
        setAssignments(json.data?.items ?? []);
        if (json.meta) setAssignmentsMeta(json.meta);
        setAssignmentsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAssignmentsError(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải danh sách phân ca.', 'Error loading shift assignments.'),
        );
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
          throw new Error(
            json.error?.message ??
              trRef.current('Không thể tải lịch ngày lễ.', 'Failed to load holiday calendar.'),
          );
        }
        setHolidays(json.data?.items ?? []);
        setHolidaysError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setHolidaysError(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải lịch ngày lễ.', 'Error loading holiday calendar.'),
        );
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
        setToastMsg(json.error?.message ?? tr('Xóa dữ liệu thất bại.', 'Failed to delete record.'));
        setIsDeleting(false);
        setConfirmDelete(null);
        return;
      }

      setIsDeleting(false);
      setConfirmDelete(null);
      triggerRefresh(tr('Đã xóa dữ liệu thành công.', 'Deleted successfully.'));
    } catch {
      setToastMsg(
        tr('Lỗi kết nối máy chủ khi xóa dữ liệu.', 'Server connection error while deleting record.'),
      );
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Quản trị Chấm công, Ca làm & Ngày lễ', 'Attendance, Shifts & Holidays')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Theo dõi nhật ký chấm công hàng ngày, Import/Export Excel, quản trị ca làm việc và lịch ngày lễ Việt Nam.',
              'Track daily attendance logs, import/export Excel, manage work shifts, and maintain public holidays.',
            )}
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
                  <span>{tr('Chấm công tay', 'Manual Entry')}</span>
                </button>
              )}
              {canImport && (
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <IconFileSpreadsheet size={16} />
                  <span>{tr('Import Excel', 'Import Excel')}</span>
                </button>
              )}
              {canExport && (
                <a
                  href={buildExportUrl()}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <IconDownload size={16} />
                  <span>{tr('Xuất Excel', 'Export Excel')}</span>
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
              <span>{tr('Tạo ca làm việc', 'Add Work Shift')}</span>
            </button>
          )}
          {activeTab === 'assignments' && canManage && (
            <button
              type="button"
              onClick={() => setAssignModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>{tr('Phân ca nhân viên', 'Assign Shift')}</span>
            </button>
          )}
          {activeTab === 'holidays' && canManage && (
            <button
              type="button"
              onClick={() => setHolidayModalState({ open: true, data: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>{tr('Thêm ngày lễ', 'Add Holiday')}</span>
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
            { key: 'logs', label: tr('Nhật ký chấm công', 'Attendance Logs'), icon: IconClockHour8 },
            { key: 'summaries', label: tr('Bảng công tháng', 'Monthly Summary'), icon: IconClipboardCheck },
            { key: 'shifts', label: tr('Ca làm việc', 'Work Shifts'), icon: IconClockHour8 },
            { key: 'assignments', label: tr('Phân ca nhân viên', 'Shift Assignments'), icon: IconUsersGroup },
            { key: 'holidays', label: tr('Lịch ngày lễ VN', 'Holidays'), icon: IconCalendarHeart },
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
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                {tr('Từ ngày', 'From Date')}
              </label>
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
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                {tr('Đến ngày', 'To Date')}
              </label>
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
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                {tr('Trạng thái', 'Status')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setLogsPage(1);
                  setLogsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('Tất cả trạng thái', 'All Statuses')}</option>
                <option value="PRESENT">{tr('Đúng giờ', 'On Time')}</option>
                <option value="LATE">{tr('Đi muộn', 'Late')}</option>
                <option value="ABSENT">{tr('Vắng mặt', 'Absent')}</option>
                <option value="LEAVE">{tr('Nghỉ phép', 'On Leave')}</option>
                <option value="HOLIDAY">{tr('Ngày lễ', 'Holiday')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                {tr('Nguồn dữ liệu', 'Source')}
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setLogsPage(1);
                  setLogsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('Tất cả nguồn', 'All Sources')}</option>
                <option value="WEB">Web ESS</option>
                <option value="IMPORT">{tr('Import Excel', 'Excel Import')}</option>
                <option value="MANUAL">{tr('HR chỉnh tay', 'HR Manual')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                {tr('Tìm nhân viên', 'Search Employee')}
              </label>
              <div className="relative">
                <IconSearch size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={logSearchInput}
                  onChange={(e) => setLogSearchInput(e.target.value)}
                  placeholder={tr('Mã NV hoặc họ tên...', 'Employee code or name...')}
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
                  <span>{tr('Thử lại', 'Retry')}</span>
                </button>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {tr(
                    'Không có dữ liệu chấm công trong khoảng thời gian đã chọn.',
                    'No attendance records found for the selected period.',
                  )}
                </p>
                {canImport && (
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white"
                  >
                    <IconFileSpreadsheet size={15} />
                    <span>{tr('Import Excel ngay', 'Import Excel Now')}</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{tr('Ngày', 'Date')}</th>
                        <th className="px-4 py-3 font-semibold">{tr('Nhân viên', 'Employee')}</th>
                        <th className="px-4 py-3 font-semibold">{tr('Phòng ban', 'Department')}</th>
                        <th className="px-4 py-3 font-semibold">{tr('Ca', 'Shift')}</th>
                        <th className="px-4 py-3 text-center font-semibold">{tr('Vào / Ra', 'In / Out')}</th>
                        <th className="px-4 py-3 text-right font-semibold">{tr('Muộn / Sớm', 'Late / Early')}</th>
                        <th className="px-4 py-3 text-right font-semibold">{tr('Giờ công', 'Hours')}</th>
                        <th className="px-4 py-3 text-center font-semibold">{tr('Nguồn', 'Source')}</th>
                        <th className="px-4 py-3 text-center font-semibold">{tr('Trạng thái', 'Status')}</th>
                        {canManage && <th className="px-4 py-3 text-right font-semibold">{tr('Thao tác', 'Actions')}</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((row) => {
                        const badge = STATUS_BADGE[row.status] ?? {
                          vi: row.status,
                          en: row.status,
                          className: 'bg-slate-100 text-slate-700 border-slate-200',
                        };
                        const sourceLabel = SOURCE_LABELS[row.source];
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {formatDateVN(row.workDate)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{row.employeeName}</div>
                              <div className="text-[11px] text-slate-500">{row.employeeCode}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {ln(row.departmentName, row.departmentNameEn)}
                            </td>
                            <td
                              className="px-4 py-3 text-slate-600"
                              title={row.shiftName ? ln(row.shiftName, row.shiftNameEn) : undefined}
                            >
                              {row.shiftCode ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-semibold">
                              <span className="text-emerald-700">{row.checkInTime ?? '--:--'}</span>
                              <span className="mx-1 text-slate-300">/</span>
                              <span className="text-blue-700">{row.checkOutTime ?? '--:--'}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={row.lateMinutes > 0 ? 'font-semibold text-amber-600' : 'text-slate-400'}>
                                {row.lateMinutes}
                                {tr('p', 'm')}
                              </span>
                              <span className="mx-1 text-slate-300">/</span>
                              <span className={row.earlyLeaveMinutes > 0 ? 'font-semibold text-rose-600' : 'text-slate-400'}>
                                {row.earlyLeaveMinutes}
                                {tr('p', 'm')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                              {row.workedHours.toFixed(2)}h
                            </td>
                            <td className="px-4 py-3 text-center text-slate-500">
                              {sourceLabel
                                ? locale === 'en'
                                  ? sourceLabel.en
                                  : sourceLabel.vi
                                : row.source}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 font-medium ${badge.className}`}>
                                {locale === 'en' ? badge.en : badge.vi}
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
                                  <span>{tr('Sửa', 'Edit')}</span>
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
                      {tr(
                        `Trang ${logsMeta.page}/${logsMeta.totalPages} (${logsMeta.total} bản ghi)`,
                        `Page ${logsMeta.page}/${logsMeta.totalPages} (${logsMeta.total} records)`,
                      )}
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
                        {tr('Trước', 'Previous')}
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
                        {tr('Sau', 'Next')}
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
                <span>{tr('Thử lại', 'Retry')}</span>
              </button>
            </div>
          ) : shifts.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {tr('Chưa có ca làm việc nào được cấu hình.', 'No work shifts configured yet.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{tr('Mã / Tên ca', 'Code / Shift Name')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('Phạm vi', 'Scope')}</th>
                    <th className="px-4 py-3 text-center font-semibold">{tr('Giờ làm việc', 'Working Hours')}</th>
                    <th className="px-4 py-3 text-center font-semibold">{tr('Nghỉ trưa', 'Break')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{tr('Giờ công', 'Work Hours')}</th>
                    <th className="px-4 py-3 text-center font-semibold">{tr('Dung sai (M/S)', 'Grace (L/E)')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{tr('Đang phân ca', 'Assigned')}</th>
                    <th className="px-4 py-3 text-center font-semibold">{tr('Trạng thái', 'Status')}</th>
                    {canManage && <th className="px-4 py-3 text-right font-semibold">{tr('Thao tác', 'Actions')}</th>}
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
                              {tr('Mặc định', 'Default')}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600">{ln(shift.name, shift.nameEn)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {shift.branchName
                          ? ln(shift.branchName, shift.branchNameEn)
                          : tr('Toàn công ty', 'Company-wide')}
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
                        {shift.lateGraceMinutes}
                        {tr('p', 'm')} / {shift.earlyLeaveGraceMinutes}
                        {tr('p', 'm')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {shift.assignedEmployeeCount} {tr('NV', 'emp')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            shift.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {shift.isActive ? tr('Hoạt động', 'Active') : tr('Ngừng dùng', 'Inactive')}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShiftModalState({ open: true, data: shift })}
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                              title={tr('Chỉnh sửa', 'Edit')}
                            >
                              <IconEdit size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  kind: 'shift',
                                  id: shift.id,
                                  label: tr(
                                    `ca làm việc ${shift.code} - ${shift.name}`,
                                    `work shift ${shift.code} - ${shift.name}`,
                                  ),
                                })
                              }
                              className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                              title={tr('Xóa mềm', 'Delete')}
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
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                {tr('Lọc theo ca', 'Filter by Shift')}
              </label>
              <select
                value={assignShiftFilter}
                onChange={(e) => {
                  setAssignShiftFilter(e.target.value);
                  setAssignPage(1);
                  setAssignmentsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('Tất cả ca làm việc', 'All Work Shifts')}</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {ln(s.name, s.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                {tr('Tìm nhân viên', 'Search Employee')}
              </label>
              <input
                type="text"
                value={assignSearchInput}
                onChange={(e) => setAssignSearchInput(e.target.value)}
                placeholder={tr('Nhập mã NV hoặc họ tên...', 'Enter employee code or full name...')}
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
                  <span>{tr('Thử lại', 'Retry')}</span>
                </button>
              </div>
            ) : assignments.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {tr('Chưa có bản ghi phân ca nào phù hợp.', 'No matching shift assignments found.')}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{tr('Nhân viên', 'Employee')}</th>
                        <th className="px-4 py-3 font-semibold">{tr('Phòng ban', 'Department')}</th>
                        <th className="px-4 py-3 font-semibold">{tr('Ca áp dụng', 'Assigned Shift')}</th>
                        <th className="px-4 py-3 text-center font-semibold">{tr('Hiệu lực', 'Effective Period')}</th>
                        <th className="px-4 py-3 font-semibold">{tr('Ngày làm trong tuần', 'Work Days')}</th>
                        <th className="px-4 py-3 font-semibold">{tr('Ghi chú', 'Note')}</th>
                        {canManage && <th className="px-4 py-3 text-right font-semibold">{tr('Thao tác', 'Actions')}</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignments.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.employeeName}</div>
                            <div className="text-[11px] text-slate-500">{item.employeeCode}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {ln(item.departmentName, item.departmentNameEn)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="font-mono font-semibold text-blue-700"
                              title={ln(item.shiftName, item.shiftNameEn)}
                            >
                              {item.shiftCode}
                            </span>
                            <span className="ml-1.5 text-slate-600">
                              ({item.startTime}–{item.endTime})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">
                            {formatDateVN(item.effectiveFrom)} →{' '}
                            {item.effectiveTo
                              ? formatDateVN(item.effectiveTo)
                              : tr('Hiện tại', 'Present')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {item.workDays.map((d) => {
                                const dayLabel = DAY_LABELS[d];
                                return (
                                  <span
                                    key={d}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                                  >
                                    {dayLabel
                                      ? locale === 'en'
                                        ? dayLabel.en
                                        : dayLabel.vi
                                      : d}
                                  </span>
                                );
                              })}
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
                                    label: tr(
                                      `phân ca ${item.shiftCode} của ${item.employeeCode}`,
                                      `shift assignment ${item.shiftCode} for ${item.employeeCode}`,
                                    ),
                                  })
                                }
                                className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                                title={tr('Gỡ phân ca', 'Remove assignment')}
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
                      {tr(
                        `Trang ${assignmentsMeta.page}/${assignmentsMeta.totalPages} (${assignmentsMeta.total} bản ghi)`,
                        `Page ${assignmentsMeta.page}/${assignmentsMeta.totalPages} (${assignmentsMeta.total} records)`,
                      )}
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
                        {tr('Trước', 'Previous')}
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
                        {tr('Sau', 'Next')}
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
              {tr(
                'Danh mục ngày nghỉ lễ áp dụng tính công, đơn nghỉ phép và hệ số OT 300%.',
                'Public holidays applied to attendance calculation, leave requests, and 300% OT rate.',
              )}
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
                  {tr(`Năm ${y}`, `Year ${y}`)}
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
                  <span>{tr('Thử lại', 'Retry')}</span>
                </button>
              </div>
            ) : holidays.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {tr(
                  `Chưa có ngày lễ nào trong năm ${holidayYear}.`,
                  `No holidays configured for ${holidayYear}.`,
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{tr('Ngày lễ', 'Date')}</th>
                      <th className="px-4 py-3 font-semibold">{tr('Tên ngày lễ', 'Holiday Name')}</th>
                      <th className="px-4 py-3 font-semibold">{tr('Phạm vi áp dụng', 'Scope')}</th>
                      <th className="px-4 py-3 text-center font-semibold">{tr('Hưởng lương', 'Paid')}</th>
                      <th className="px-4 py-3 font-semibold">{tr('Ghi chú', 'Note')}</th>
                      {canManage && <th className="px-4 py-3 text-right font-semibold">{tr('Thao tác', 'Actions')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {holidays.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                          {formatDateVN(item.holidayDate)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {ln(item.name, item.nameEn)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.branchName
                            ? ln(item.branchName, item.branchNameEn)
                            : tr('Toàn công ty', 'Company-wide')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              item.isPaid
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.isPaid ? tr('Có lương', 'Paid') : tr('Không lương', 'Unpaid')}
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
                                title={tr('Chỉnh sửa', 'Edit')}
                              >
                                <IconEdit size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDelete({
                                    kind: 'holiday',
                                    id: item.id,
                                    label: tr(
                                      `ngày lễ "${item.name}" (${formatDateVN(item.holidayDate)})`,
                                      `holiday "${item.name}" (${formatDateVN(item.holidayDate)})`,
                                    ),
                                  })
                                }
                                className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                                title={tr('Xóa mềm', 'Delete')}
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
            triggerRefresh(tr('Đã lưu ca làm việc thành công.', 'Work shift saved successfully.'));
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
            triggerRefresh(
              tr(
                'Đã phân ca làm việc cho nhân viên thành công.',
                'Shift assigned to employee successfully.',
              ),
            );
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
            triggerRefresh(tr('Đã lưu ngày lễ thành công.', 'Holiday saved successfully.'));
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
            triggerRefresh(
              tr(
                'Đã lưu điều chỉnh chấm công và ghi Audit Log.',
                'Attendance adjustment saved and recorded in Audit Log.',
              ),
            );
          }}
        />
      )}

      {importModalOpen && (
        <AttendanceImportModal
          onClose={() => setImportModalOpen(false)}
          onImported={() =>
            triggerRefresh(
              tr('Đã import dữ liệu chấm công từ Excel.', 'Attendance data imported from Excel.'),
            )
          }
        />
      )}

      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        title={tr('Xác nhận xóa dữ liệu', 'Confirm Deletion')}
        description={
          confirmDelete
            ? tr(
                `Bạn có chắc chắn muốn xóa ${confirmDelete.label}? Hành động này sẽ thực hiện xóa mềm và lưu vết lịch sử hệ thống.`,
                `Are you sure you want to delete ${confirmDelete.label}? This will perform a soft delete and record an audit trail.`,
              )
            : ''
        }
        confirmLabel={tr('Xác nhận xóa', 'Confirm Delete')}
        cancelLabel={tr('Hủy', 'Cancel')}
        variant="danger"
        isProcessing={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
