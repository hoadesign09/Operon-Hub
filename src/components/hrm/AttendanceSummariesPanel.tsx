'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  IconCalculator,
  IconDownload,
  IconEdit,
  IconLoader2,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import {
  AttendanceSummaryEditModal,
  type AttendanceSummaryRecord,
} from '@/components/hrm/AttendanceSummaryEditModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonKpiGrid, SkeletonTableRows } from '@/components/ui/Skeleton';
import { useI18n } from '@/shared/i18n/I18nContext';

interface SummaryPeriodStats {
  totalEmployees: number;
  draftCount: number;
  lockedCount: number;
  totalPayableDays: number;
  totalOtHours: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AttendanceSummariesPanelProps {
  selectedBranchId: number | null;
  canManage: boolean;
  canLock: boolean;
  canExport: boolean;
}

export function AttendanceSummariesPanel({
  selectedBranchId,
  canManage,
  canLock,
  canExport,
}: AttendanceSummariesPanelProps) {
  const { tr } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [items, setItems] = useState<AttendanceSummaryRecord[]>([]);
  const [stats, setStats] = useState<SummaryPeriodStats>({
    totalEmployees: 0,
    draftCount: 0,
    lockedCount: 0,
    totalPayableDays: 0,
    totalOtHours: 0,
  });
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState<AttendanceSummaryRecord | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const qs = new URLSearchParams({
      year: String(year),
      month: String(month),
      page: String(page),
      limit: '20',
    });
    if (selectedBranchId) qs.set('branchId', String(selectedBranchId));
    if (statusFilter) qs.set('status', statusFilter);
    if (search) qs.set('search', search);

    fetch(`/api/v1/hrm/attendance/summaries?${qs.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { items: AttendanceSummaryRecord[]; stats: SummaryPeriodStats };
          meta?: PaginationMeta;
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(
            json.error?.message ??
              trRef.current(
                'Không thể tải bảng công tổng hợp tháng.',
                'Unable to load monthly attendance summary.',
              ),
          );
        }
        setItems(json.data.items);
        setStats(json.data.stats);
        if (json.meta) setMeta(json.meta);
        setErrorMsg(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : trRef.current(
                'Lỗi tải bảng công tháng.',
                'Error loading monthly attendance summary.',
              ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [year, month, selectedBranchId, statusFilter, search, page, reloadTick]);

  function refreshList(msg?: string) {
    setIsLoading(true);
    if (msg) {
      setBanner({ type: 'success', message: msg });
    }
    setReloadTick((t) => t + 1);
  }

  async function handleCalculate() {
    setIsCalculating(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/hrm/attendance/summaries/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          branchId: selectedBranchId,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          totalProcessed: number;
          createdCount: number;
          updatedCount: number;
          skippedLockedCount: number;
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setBanner({
          type: 'error',
          message:
            json.error?.message ??
            tr('Tổng hợp công tháng thất bại.', 'Failed to calculate monthly attendance.'),
        });
        setIsCalculating(false);
        return;
      }

      const d = json.data;
      setIsCalculating(false);
      refreshList(
        tr(
          `Đã tổng hợp bảng công Tháng ${month}/${year}: ${d.createdCount} tạo mới, ${d.updatedCount} cập nhật${
            d.skippedLockedCount > 0 ? `, bỏ qua ${d.skippedLockedCount} bản ghi đã chốt` : ''
          }.`,
          `Calculated attendance summary for ${month}/${year}: ${d.createdCount} created, ${d.updatedCount} updated${
            d.skippedLockedCount > 0 ? `, skipped ${d.skippedLockedCount} locked records` : ''
          }.`,
        ),
      );
    } catch {
      setBanner({
        type: 'error',
        message: tr(
          'Lỗi kết nối máy chủ khi tổng hợp công tháng.',
          'Server connection error while calculating monthly attendance.',
        ),
      });
      setIsCalculating(false);
    }
  }

  async function handleConfirmLock() {
    setIsLocking(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/hrm/attendance/summaries/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          branchId: selectedBranchId,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { lockedCount: number };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setBanner({
          type: 'error',
          message:
            json.error?.message ??
            tr('Chốt bảng công thất bại.', 'Failed to lock attendance summary.'),
        });
        setIsLocking(false);
        setIsLockModalOpen(false);
        return;
      }

      setIsLocking(false);
      setIsLockModalOpen(false);
      refreshList(
        tr(
          `Đã chốt khóa ${json.data.lockedCount} bản ghi bảng công Tháng ${month}/${year}.`,
          `Locked ${json.data.lockedCount} attendance summary records for ${month}/${year}.`,
        ),
      );
    } catch {
      setBanner({
        type: 'error',
        message: tr(
          'Lỗi kết nối máy chủ khi chốt bảng công.',
          'Server connection error while locking attendance summary.',
        ),
      });
      setIsLocking(false);
      setIsLockModalOpen(false);
    }
  }

  async function handleSubmitUnlock(e: FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    if (unlockReason.trim().length < 3) {
      setUnlockError(
        tr(
          'Vui lòng nhập lý do mở khóa (tối thiểu 3 ký tự).',
          'Please enter an unlock reason (at least 3 characters).',
        ),
      );
      return;
    }

    setIsUnlocking(true);
    try {
      const res = await fetch('/api/v1/hrm/attendance/summaries/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          branchId: selectedBranchId,
          reason: unlockReason.trim(),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { unlockedCount: number };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setUnlockError(
          json.error?.message ??
            tr('Mở khóa kỳ công thất bại.', 'Failed to unlock attendance period.'),
        );
        setIsUnlocking(false);
        return;
      }

      setIsUnlocking(false);
      setIsUnlockModalOpen(false);
      setUnlockReason('');
      refreshList(
        tr(
          `Đã mở khóa ${json.data.unlockedCount} bản ghi bảng công Tháng ${month}/${year} về trạng thái Nháp.`,
          `Unlocked ${json.data.unlockedCount} attendance summary records for ${month}/${year} back to Draft.`,
        ),
      );
    } catch {
      setUnlockError(
        tr(
          'Lỗi kết nối máy chủ khi mở khóa kỳ công.',
          'Server connection error while unlocking attendance period.',
        ),
      );
      setIsUnlocking(false);
    }
  }

  function buildExportUrl(): string {
    const qs = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    if (selectedBranchId) qs.set('branchId', String(selectedBranchId));
    if (statusFilter) qs.set('status', statusFilter);
    if (search) qs.set('search', search);
    return `/api/v1/hrm/attendance/summaries/export?${qs.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={month}
            onChange={(e) => {
              setMonth(Number(e.target.value));
              setPage(1);
              setIsLoading(true);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
              <option key={m} value={m}>
                {tr(`Tháng ${m}`, `Month ${m}`)}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPage(1);
              setIsLoading(true);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {tr(`Năm ${y}`, `Year ${y}`)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              setIsLoading(true);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">{tr('Tất cả trạng thái', 'All statuses')}</option>
            <option value="DRAFT">{tr('Đang rà soát (Nháp)', 'In Review (Draft)')}</option>
            <option value="LOCKED">{tr('Đã chốt công (LOCKED)', 'Locked (LOCKED)')}</option>
          </select>
          <div className="relative">
            <IconSearch size={14} className="absolute left-3 top-2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tr('Tìm mã NV / họ tên...', 'Search emp. code / name...')}
              className="rounded-xl border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              disabled={isCalculating}
              onClick={() => void handleCalculate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isCalculating ? (
                <IconLoader2 size={15} className="animate-spin" />
              ) : (
                <IconCalculator size={15} />
              )}
              <span>
                {isCalculating
                  ? tr('Đang tổng hợp...', 'Calculating...')
                  : tr('Tổng hợp công tháng', 'Calculate Monthly Summary')}
              </span>
            </button>
          )}
          {canLock && stats.draftCount > 0 && (
            <button
              type="button"
              onClick={() => setIsLockModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <IconLock size={15} />
              <span>{tr(`Chốt công (${stats.draftCount})`, `Lock (${stats.draftCount})`)}</span>
            </button>
          )}
          {canLock && stats.lockedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setUnlockError(null);
                setUnlockReason('');
                setIsUnlockModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              <IconLockOpen size={15} />
              <span>{tr(`Mở khóa (${stats.lockedCount})`, `Unlock (${stats.lockedCount})`)}</span>
            </button>
          )}
          {canExport && (
            <a
              href={buildExportUrl()}
              download
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <IconDownload size={15} />
              <span>{tr('Xuất Excel', 'Export Excel')}</span>
            </a>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-medium ${
            banner.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {banner.message}
        </div>
      )}

      {isLoading ? (
        <SkeletonKpiGrid count={4} compact columnsClass="grid-cols-2 gap-3 lg:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">
              {tr(`Nhân sự kỳ ${month}/${year}`, `Employees (${month}/${year})`)}
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.totalEmployees}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">{tr('Trạng thái chốt', 'Lock Status')}</div>
            <div className="mt-1 text-lg font-bold">
              <span className="text-emerald-600">
                {tr(`${stats.lockedCount} đã chốt`, `${stats.lockedCount} locked`)}
              </span>
              <span className="mx-1.5 text-slate-300">/</span>
              <span className="text-amber-600">
                {tr(`${stats.draftCount} nháp`, `${stats.draftCount} draft`)}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">
              {tr('Tổng công hưởng lương', 'Total Payable Days')}
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-blue-700">
              {stats.totalPayableDays.toFixed(2)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">
              {tr('Tổng giờ OT đã duyệt', 'Total Approved OT Hours')}
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-purple-700">
              {stats.totalOtHours.toFixed(2)}h
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!isLoading && errorMsg ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-rose-700">{errorMsg}</p>
            <button
              type="button"
              onClick={() => refreshList()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white"
            >
              <IconRefresh size={15} />
              <span>{tr('Thử lại', 'Retry')}</span>
            </button>
          </div>
        ) : !isLoading && items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              {tr(
                `Chưa có bảng công tổng hợp cho Tháng ${month}/${year}.`,
                `No attendance summary found for ${month}/${year}.`,
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {tr(
                'Bấm "Tổng hợp công tháng" để hệ thống tự động tính công từ chấm công ngày, ngày lễ, nghỉ phép, OT và công tác đã duyệt.',
                'Click "Calculate Monthly Summary" to automatically compute workdays from daily attendance, holidays, approved leaves, OT, and business trips.',
              )}
            </p>
            {canManage && (
              <button
                type="button"
                disabled={isCalculating}
                onClick={() => void handleCalculate()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <IconCalculator size={15} />
                <span>
                  {tr(
                    `Chạy tổng hợp công Tháng ${month}/${year}`,
                    `Calculate Summary for ${month}/${year}`,
                  )}
                </span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto" aria-busy={isLoading}>
              <table className="w-full min-w-[1060px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{tr('Nhân viên', 'Employee')}</th>
                    <th className="px-3 py-3 font-semibold">{tr('Phòng ban', 'Department')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{tr('Chuẩn', 'Standard')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{tr('Thực tế', 'Actual')}</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      {tr('Phép CL / KL', 'Paid / Unpaid Leave')}
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">{tr('Lễ', 'Holiday')}</th>
                    <th className="px-3 py-3 text-right font-semibold text-blue-700">
                      {tr('Hưởng lương', 'Payable')}
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">OT (150/200/300)</th>
                    <th className="px-3 py-3 text-right font-semibold">{tr('Đi muộn', 'Late')}</th>
                    <th className="px-3 py-3 text-center font-semibold">
                      {tr('Trạng thái', 'Status')}
                    </th>
                    {canManage && (
                      <th className="px-4 py-3 text-right font-semibold">
                        {tr('Thao tác', 'Actions')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <SkeletonTableRows rows={6} columns={canManage ? 11 : 10} />
                  ) : (
                    items.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{row.employeeName}</div>
                          <div className="text-[11px] text-slate-500">{row.employeeCode}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{row.departmentName}</td>
                        <td className="px-3 py-3 text-right font-mono text-slate-600">
                          {row.standardWorkDays.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-slate-800">
                          {row.actualWorkDays.toFixed(2)}
                          {row.businessTripDays > 0 && (
                            <div className="text-[10px] font-normal text-slate-400">
                              {tr(`(CT: ${row.businessTripDays})`, `(Trip: ${row.businessTripDays})`)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono">
                          <span className="text-emerald-700">{row.paidLeaveDays.toFixed(1)}</span>
                          <span className="mx-1 text-slate-300">/</span>
                          <span className="text-rose-600">{row.unpaidLeaveDays.toFixed(1)}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-purple-700">
                          {row.holidayDays.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm font-bold text-blue-700">
                          {row.payableDays.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[11px] text-slate-700">
                          {row.otHours150}/{row.otHours200}/{row.otHours300}h
                        </td>
                        <td className="px-3 py-3 text-right">
                          {row.lateCount > 0 ? (
                            <span className="font-semibold text-amber-600">
                              {tr(
                                `${row.lateCount} lần (${row.totalLateMinutes}p)`,
                                `${row.lateCount}x (${row.totalLateMinutes}m)`,
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.status === 'LOCKED' ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                              title={
                                row.lockedAt
                                  ? tr(
                                      `Chốt lúc ${row.lockedAt} bởi ${row.lockedByName ?? ''}`,
                                      `Locked at ${row.lockedAt} by ${row.lockedByName ?? ''}`,
                                    )
                                  : tr('Đã chốt công', 'Locked')
                              }
                            >
                              <IconLock size={12} />
                              <span>{tr('Đã chốt', 'Locked')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                              {tr('Nháp', 'Draft')}
                            </span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={row.status === 'LOCKED'}
                              onClick={() => setEditingSummary(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              title={
                                row.status === 'LOCKED'
                                  ? tr(
                                      'Cần mở khóa kỳ công trước khi điều chỉnh',
                                      'Unlock attendance period before editing',
                                    )
                                  : tr('Điều chỉnh bảng công', 'Adjust attendance summary')
                              }
                            >
                              <IconEdit size={14} />
                              <span>{tr('Sửa', 'Edit')}</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isLoading && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                <span>
                  {tr(
                    `Trang ${meta.page}/${meta.totalPages} (${meta.total} bản ghi)`,
                    `Page ${meta.page}/${meta.totalPages} (${meta.total} records)`,
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => p - 1);
                      setIsLoading(true);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                  >
                    {tr('Trước', 'Previous')}
                  </button>
                  <button
                    type="button"
                    disabled={page >= meta.totalPages}
                    onClick={() => {
                      setPage((p) => p + 1);
                      setIsLoading(true);
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

      {editingSummary && (
        <AttendanceSummaryEditModal
          key={editingSummary.id}
          summary={editingSummary}
          onClose={() => setEditingSummary(null)}
          onSuccess={() => {
            setEditingSummary(null);
            refreshList(
              tr(
                'Đã lưu điều chỉnh bảng công và ghi Audit Log.',
                'Saved attendance summary adjustment and recorded Audit Log.',
              ),
            );
          }}
        />
      )}

      <ConfirmModal
        isOpen={isLockModalOpen}
        title={tr(
          `Chốt bảng công Tháng ${month}/${year}`,
          `Lock Attendance Summary for ${month}/${year}`,
        )}
        description={tr(
          `Bạn sắp chốt khóa ${stats.draftCount} bản ghi bảng công ở trạng thái Nháp sang LOCKED. Sau khi chốt, dữ liệu chấm công trong tháng này sẽ được bảo vệ để phục vụ tính lương.`,
          `You are about to lock ${stats.draftCount} draft attendance summary records to LOCKED. Once locked, this month's attendance data will be protected for payroll calculation.`,
        )}
        confirmLabel={tr('Xác nhận Chốt công', 'Confirm Lock')}
        cancelLabel={tr('Hủy', 'Cancel')}
        variant="primary"
        isProcessing={isLocking}
        onConfirm={() => void handleConfirmLock()}
        onCancel={() => setIsLockModalOpen(false)}
      />

      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {tr(
                  `Mở khóa Bảng công Tháng ${month}/${year}`,
                  `Unlock Attendance Summary for ${month}/${year}`,
                )}
              </h3>
              <button
                type="button"
                disabled={isUnlocking}
                onClick={() => setIsUnlockModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label={tr('Đóng', 'Close')}
              >
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={(e) => void handleSubmitUnlock(e)} className="space-y-4 p-5">
              {unlockError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {unlockError}
                </div>
              )}
              <p className="text-xs text-slate-600">
                {tr(
                  `Thao tác mở khóa sẽ chuyển ${stats.lockedCount} bản ghi đã chốt về trạng thái Nháp để điều chỉnh và được ghi nhận vào Audit Log.`,
                  `Unlocking will revert ${stats.lockedCount} locked records to Draft status for adjustment and will be recorded in the Audit Log.`,
                )}
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Lý do mở khóa *', 'Unlock Reason *')}
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={3}
                  disabled={isUnlocking}
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder={tr(
                    'VD: Bổ sung đơn nghỉ phép đã duyệt trễ cho nhân viên phòng Kỹ thuật',
                    'e.g. Adding late-approved leave request for Engineering employee',
                  )}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isUnlocking}
                  onClick={() => setIsUnlockModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700"
                >
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {isUnlocking && <IconLoader2 size={14} className="animate-spin" />}
                  <span>{tr('Xác nhận Mở khóa', 'Confirm Unlock')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
