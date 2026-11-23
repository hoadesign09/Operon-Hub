'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheck,
  IconDownload,
  IconEye,
  IconFileSpreadsheet,
  IconLockOpen,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { PayrollPeriodFormModal } from '@/components/hrm/PayrollPeriodFormModal';
import { PayslipDetailModal } from '@/components/hrm/PayslipDetailModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import type { PayrollConfig } from '@/modules/hrm/payroll/payroll-calculator';
import type {
  PayrollPeriodItem,
  PayslipRowItem,
} from '@/modules/hrm/payroll/payroll.service';

type ActiveTab = 'periods' | 'config';

const STATUS_BADGES: Record<
  PayrollPeriodItem['status'],
  { label: string; className: string }
> = {
  DRAFT: { label: 'Nháp', className: 'bg-slate-100 text-slate-700' },
  CALCULATED: { label: 'Đã tính lương', className: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Đã phê duyệt', className: 'bg-blue-100 text-blue-800' },
  PAID: { label: 'Đã chi trả & Phát phiếu', className: 'bg-emerald-100 text-emerald-800' },
};

export default function HrmPayrollPage() {
  const { user, selectedBranchId } = usePortalAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const canManage = Boolean(
    user?.isSuperAdmin || user?.permissions.includes('hrm.payroll.manage'),
  );
  const canApprove = Boolean(
    user?.isSuperAdmin || user?.permissions.includes('hrm.payroll.approve'),
  );
  const canExport = Boolean(
    user?.isSuperAdmin || user?.permissions.includes('hrm.payroll.export'),
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('periods');
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [reloadTick, setReloadTick] = useState(0);

  // Period list state
  const [periods, setPeriods] = useState<PayrollPeriodItem[]>([]);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);
  const [periodsError, setPeriodsError] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  // Selected period detail + payslips
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriodItem | null>(null);
  const [payslips, setPayslips] = useState<PayslipRowItem[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [payslipSearch, setPayslipSearch] = useState('');
  const [detailReloadTick, setDetailReloadTick] = useState(0);

  // Actions & Modals
  const [includeDraftAttendance, setIncludeDraftAttendance] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionWarnings, setActionWarnings] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activePayslipId, setActivePayslipId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    'approve' | 'pay' | 'delete' | null
  >(null);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Config tab state
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configReloadTick, setConfigReloadTick] = useState(0);

  // Load periods list
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filterYear) params.set('year', filterYear);
    if (filterStatus) params.set('status', filterStatus);
    if (selectedBranchId) params.set('branchId', String(selectedBranchId));
    params.set('limit', '50');

    fetch(`/api/v1/hrm/payroll/periods?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { items: PayrollPeriodItem[] };
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Không thể tải danh sách kỳ lương.');
        }
        const items = json.data.items;
        setPeriods(items);
        setPeriodsError(null);
        setSelectedPeriodId((prev) => {
          if (prev && items.some((p) => p.id === prev)) {
            return prev;
          }
          return items[0]?.id ?? null;
        });
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setPeriodsError(err instanceof Error ? err.message : 'Lỗi tải danh sách kỳ lương.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingPeriods(false);
        }
      });

    return () => controller.abort();
  }, [filterYear, filterStatus, selectedBranchId, reloadTick]);

  // Load selected period detail
  useEffect(() => {
    if (!selectedPeriodId) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ limit: '200' });
    if (payslipSearch.trim()) {
      params.set('search', payslipSearch.trim());
    }

    fetch(`/api/v1/hrm/payroll/periods/${selectedPeriodId}?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { period: PayrollPeriodItem; payslips: PayslipRowItem[] };
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Không thể tải bảng lương chi tiết.');
        }
        setSelectedPeriod(json.data.period);
        setPayslips(json.data.payslips);
        setDetailError(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setDetailError(err instanceof Error ? err.message : 'Lỗi tải chi tiết kỳ lương.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingDetail(false);
        }
      });

    return () => controller.abort();
  }, [selectedPeriodId, payslipSearch, detailReloadTick]);

  // Load payroll config when switching to config tab
  useEffect(() => {
    if (activeTab !== 'config') return;
    const controller = new AbortController();

    fetch('/api/v1/hrm/payroll/config', { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { config: PayrollConfig };
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data?.config) {
          throw new Error(json.error?.message ?? 'Không thể tải cấu hình tính lương.');
        }
        setConfig(json.data.config);
        setConfigError(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setConfigError(err instanceof Error ? err.message : 'Lỗi tải cấu hình lương.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingConfig(false);
        }
      });

    return () => controller.abort();
  }, [activeTab, configReloadTick]);

  function triggerReloadAll() {
    setIsLoadingPeriods(true);
    setReloadTick((t) => t + 1);
    if (selectedPeriodId) {
      setIsLoadingDetail(true);
      setDetailReloadTick((t) => t + 1);
    }
  }

  async function handleCalculate() {
    if (!selectedPeriod) return;
    setActionBusy('calculate');
    setActionError(null);
    setActionMessage(null);
    setActionWarnings([]);

    try {
      const res = await fetch(
        `/api/v1/hrm/payroll/periods/${selectedPeriod.id}/calculate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ includeDraftAttendance }),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          processedCount: number;
          warnings: string[];
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setActionError(json.error?.message ?? 'Không thể chạy tính lương.');
      } else {
        setActionMessage(
          `Đã hoàn tất tính lương cho ${json.data.processedCount} nhân viên.`,
        );
        setActionWarnings(json.data.warnings ?? []);
        triggerReloadAll();
      }
    } catch {
      setActionError('Lỗi kết nối khi chạy tính lương.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleConfirmExecute() {
    if (!selectedPeriod || !confirmAction) return;
    setActionBusy(confirmAction);
    setActionError(null);
    setActionMessage(null);
    setActionWarnings([]);

    try {
      let url = `/api/v1/hrm/payroll/periods/${selectedPeriod.id}`;
      let method: 'POST' | 'DELETE' = 'POST';
      if (confirmAction === 'approve') url += '/approve';
      else if (confirmAction === 'pay') url += '/pay';
      else if (confirmAction === 'delete') method = 'DELETE';

      const res = await fetch(url, { method });
      const json = (await res.json()) as {
        success: boolean;
        data?: { publishedCount?: number; notifiedCount?: number };
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setActionError(json.error?.message ?? 'Thao tác thất bại.');
      } else {
        if (confirmAction === 'approve') {
          setActionMessage('Đã phê duyệt kỳ lương thành công.');
        } else if (confirmAction === 'pay') {
          setActionMessage(
            `Đã xác nhận chi trả, phát hành ${json.data?.publishedCount ?? 0} phiếu lương và gửi ${json.data?.notifiedCount ?? 0} thông báo tới nhân viên.`,
          );
        } else {
          setActionMessage('Đã xóa kỳ lương.');
          setSelectedPeriodId(null);
          setSelectedPeriod(null);
          setPayslips([]);
        }
        triggerReloadAll();
      }
    } catch {
      setActionError('Lỗi kết nối máy chủ.');
    } finally {
      setActionBusy(null);
      setConfirmAction(null);
    }
  }

  async function handleReopenSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedPeriod) return;
    setActionBusy('reopen');
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await fetch(
        `/api/v1/hrm/payroll/periods/${selectedPeriod.id}/reopen`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reopenReason.trim() }),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setActionError(json.error?.message ?? 'Không thể mở lại kỳ lương.');
      } else {
        setActionMessage('Đã mở lại kỳ lương sang trạng thái Đã tính để điều chỉnh.');
        setReopenReason('');
        setIsReopenModalOpen(false);
        triggerReloadAll();
      }
    } catch {
      setActionError('Lỗi kết nối khi mở lại kỳ lương.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSaveConfig(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setIsSavingConfig(true);
    setConfigError(null);
    setConfigSavedMsg(null);

    try {
      const res = await fetch('/api/v1/hrm/payroll/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { config: PayrollConfig };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data?.config) {
        setConfigError(json.error?.message ?? 'Không thể lưu cấu hình lương.');
      } else {
        setConfig(json.data.config);
        setConfigSavedMsg('Đã cập nhật cấu hình Bảo hiểm & Thuế TNCN thành công.');
      }
    } catch {
      setConfigError('Lỗi kết nối khi lưu cấu hình.');
    } finally {
      setIsSavingConfig(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tính lương & Phiếu lương</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý kỳ lương, tính lương tự động từ bảng công & hợp đồng, duyệt chi trả và phát hành phiếu lương PDF/Excel.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('periods')}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              activeTab === 'periods'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Kỳ lương & Bảng tính
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('config');
              setIsLoadingConfig(true);
              setConfigReloadTick((t) => t + 1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              activeTab === 'config'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <IconSettings size={16} />
            <span>Cấu hình BH & Thuế</span>
          </button>
        </div>
      </div>

      {activeTab === 'periods' ? (
        <div className="space-y-6">
          {/* Filters + Create Period */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span>Năm:</span>
                <select
                  value={filterYear}
                  onChange={(e) => {
                    setFilterYear(e.target.value);
                    setIsLoadingPeriods(true);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="">Tất cả</option>
                  {[currentYear + 1, currentYear, currentYear - 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span>Trạng thái:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setIsLoadingPeriods(true);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="">Tất cả</option>
                  <option value="DRAFT">Nháp</option>
                  <option value="CALCULATED">Đã tính lương</option>
                  <option value="APPROVED">Đã phê duyệt</option>
                  <option value="PAID">Đã chi trả</option>
                </select>
              </label>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <IconPlus size={16} />
                <span>Tạo kỳ lương</span>
              </button>
            )}
          </div>

          {/* Periods List */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {isLoadingPeriods ? (
              <div className="space-y-3 p-6">
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ) : periodsError ? (
              <div className="p-6 text-center">
                <p className="text-sm text-rose-700">{periodsError}</p>
                <button
                  type="button"
                  onClick={triggerReloadAll}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <IconRefresh size={14} />
                  <span>Thử lại</span>
                </button>
              </div>
            ) : periods.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Chưa có kỳ lương nào phù hợp bộ lọc hiện tại.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Khởi tạo kỳ lương mới để bắt đầu tổng hợp công, phụ cấp, BHXH và thuế TNCN.
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <IconPlus size={16} />
                    <span>Tạo kỳ lương đầu tiên</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Kỳ lương</th>
                      <th className="px-4 py-3">Chi nhánh</th>
                      <th className="px-4 py-3 text-right">Số NV</th>
                      <th className="px-4 py-3 text-right">Tổng Gross</th>
                      <th className="px-4 py-3 text-right">BH NLĐ</th>
                      <th className="px-4 py-3 text-right">Thuế TNCN</th>
                      <th className="px-4 py-3 text-right">Tổng Thực lĩnh</th>
                      <th className="px-4 py-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periods.map((period) => {
                      const badge = STATUS_BADGES[period.status];
                      const isSelected = period.id === selectedPeriodId;
                      return (
                        <tr
                          key={period.id}
                          onClick={() => {
                            setSelectedPeriodId(period.id);
                            setIsLoadingDetail(true);
                            setActionMessage(null);
                            setActionWarnings([]);
                            setActionError(null);
                          }}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{period.name}</div>
                            <div className="text-xs text-slate-500">
                              {period.code} • Tháng {String(period.month).padStart(2, '0')}/
                              {period.year}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{period.branchName}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {period.totalEmployees}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {formatVND(period.totalGross)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatVND(period.totalInsuranceEmp)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatVND(period.totalPit)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700">
                            {formatVND(period.totalNet)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected Period Detail & Payslips Table */}
          {selectedPeriod && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedPeriod.name}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGES[selectedPeriod.status].className}`}
                    >
                      {STATUS_BADGES[selectedPeriod.status].label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Mã kỳ: {selectedPeriod.code}
                    {selectedPeriod.approvedAt
                      ? ` • Duyệt bởi ${selectedPeriod.approvedByName ?? 'N/A'} (${selectedPeriod.approvedAt})`
                      : ''}
                    {selectedPeriod.paidAt
                      ? ` • Chi trả bởi ${selectedPeriod.paidByName ?? 'N/A'} (${selectedPeriod.paidAt})`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManage &&
                    (selectedPeriod.status === 'DRAFT' ||
                      selectedPeriod.status === 'CALCULATED') && (
                      <>
                        <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={includeDraftAttendance}
                            onChange={(e) => setIncludeDraftAttendance(e.target.checked)}
                          />
                          <span>Gồm công chưa chốt (DRAFT)</span>
                        </label>
                        <button
                          type="button"
                          disabled={actionBusy !== null}
                          onClick={() => void handleCalculate()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          <IconCalculator size={15} />
                          <span>
                            {actionBusy === 'calculate'
                              ? 'Đang tính lương...'
                              : selectedPeriod.status === 'DRAFT'
                                ? 'Chạy tính lương'
                                : 'Tính lại bảng lương'}
                          </span>
                        </button>
                      </>
                    )}

                  {canApprove && selectedPeriod.status === 'CALCULATED' && (
                    <button
                      type="button"
                      disabled={actionBusy !== null || selectedPeriod.totalEmployees === 0}
                      onClick={() => setConfirmAction('approve')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      <IconCheck size={15} />
                      <span>Phê duyệt kỳ lương</span>
                    </button>
                  )}

                  {canApprove && selectedPeriod.status === 'APPROVED' && (
                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() => setIsReopenModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                    >
                      <IconLockOpen size={15} />
                      <span>Mở lại điều chỉnh</span>
                    </button>
                  )}

                  {(canApprove || canManage) && selectedPeriod.status === 'APPROVED' && (
                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() => setConfirmAction('pay')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <IconSend size={15} />
                      <span>Chi trả & Phát phiếu lương</span>
                    </button>
                  )}

                  {canExport && selectedPeriod.totalEmployees > 0 && (
                    <a
                      href={`/api/v1/hrm/payroll/periods/${selectedPeriod.id}/export`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <IconFileSpreadsheet size={15} />
                      <span>Xuất Excel</span>
                    </a>
                  )}

                  {canManage &&
                    (selectedPeriod.status === 'DRAFT' ||
                      selectedPeriod.status === 'CALCULATED') && (
                      <button
                        type="button"
                        disabled={actionBusy !== null}
                        onClick={() => setConfirmAction('delete')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        <IconTrash size={15} />
                        <span>Xóa kỳ</span>
                      </button>
                    )}
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs text-slate-500">Tổng Quỹ lương Gross</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {formatVND(selectedPeriod.totalGross)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs text-slate-500">Tổng BHXH/BHYT/BHTN (NLĐ)</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">
                    {formatVND(selectedPeriod.totalInsuranceEmp)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs text-slate-500">Tổng Thuế TNCN</div>
                  <div className="mt-1 text-lg font-bold text-amber-700">
                    {formatVND(selectedPeriod.totalPit)}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
                  <div className="text-xs font-medium text-blue-700">
                    Tổng Thực lĩnh Chi trả (Net)
                  </div>
                  <div className="mt-1 text-lg font-bold text-blue-800">
                    {formatVND(selectedPeriod.totalNet)}
                  </div>
                </div>
              </div>

              {actionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {actionError}
                </div>
              )}
              {actionMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {actionMessage}
                </div>
              )}
              {actionWarnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <IconAlertTriangle size={16} />
                    <span>Lưu ý khi tính lương ({actionWarnings.length} trường hợp bỏ qua):</span>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
                    {actionWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Search payslips */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative w-full max-w-xs">
                  <IconSearch
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={payslipSearch}
                    onChange={(e) => {
                      setPayslipSearch(e.target.value);
                      setIsLoadingDetail(true);
                    }}
                    placeholder="Tìm theo mã NV hoặc họ tên..."
                    className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <span className="text-xs text-slate-500">
                  Hiển thị {payslips.length} phiếu lương
                </span>
              </div>

              {isLoadingDetail ? (
                <div className="space-y-2 py-4">
                  <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                </div>
              ) : detailError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
                  <p className="text-sm text-rose-700">{detailError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoadingDetail(true);
                      setDetailReloadTick((t) => t + 1);
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <IconRefresh size={14} />
                    <span>Thử lại</span>
                  </button>
                </div>
              ) : payslips.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Chưa có phiếu lương trong kỳ này. Hãy đảm bảo đã chốt bảng công tháng và bấm{' '}
                  <span className="font-semibold text-slate-700">Chạy tính lương</span>.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Nhân viên</th>
                        <th className="px-3 py-3 text-right">Công</th>
                        <th className="px-3 py-3 text-right">Lương công</th>
                        <th className="px-3 py-3 text-right">Phụ cấp + OT + Thưởng</th>
                        <th className="px-3 py-3 text-right">Tổng Gross</th>
                        <th className="px-3 py-3 text-right">BH (10.5%)</th>
                        <th className="px-3 py-3 text-right">Thuế TNCN</th>
                        <th className="px-3 py-3 text-right">Thực lĩnh Net</th>
                        <th className="px-3 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payslips.map((ps) => (
                        <tr key={ps.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-900">
                              {ps.employeeCode} — {ps.employeeName}
                            </div>
                            <div className="max-w-[200px] truncate text-xs text-slate-500" title={`${ps.departmentName} • ${ps.positionName}`}>
                              {ps.departmentName} • {ps.positionName}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-slate-700">
                            {ps.payableDays}/{ps.standardWorkDays}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-slate-700">
                            {formatVND(ps.proratedSalary)}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-emerald-700">
                            {formatVND(ps.totalAllowances + ps.totalOtPay + ps.totalBonus)}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap font-semibold text-slate-900">
                            {formatVND(ps.grossSalary)}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-slate-600">
                            {formatVND(ps.totalInsuranceEmp)}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-amber-700">
                            {formatVND(ps.personalIncomeTax)}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap font-bold text-blue-700">
                            {formatVND(ps.netSalary)}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setActivePayslipId(ps.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                <IconEye size={14} />
                                <span>Chi tiết</span>
                              </button>
                              <a
                                href={`/api/v1/hrm/payroll/payslips/${ps.id}/pdf`}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                <IconDownload size={14} />
                                <span>PDF</span>
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Config BH & Tax */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {isLoadingConfig ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : configError && !config ? (
            <div className="p-4 text-center">
              <p className="text-sm text-rose-700">{configError}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoadingConfig(true);
                  setConfigReloadTick((t) => t + 1);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white"
              >
                <IconRefresh size={14} />
                <span>Thử lại</span>
              </button>
            </div>
          ) : config ? (
            <form onSubmit={(e) => void handleSaveConfig(e)} className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Cấu hình Tỷ lệ Bảo hiểm & Thuế TNCN (Việt Nam)
                </h2>
                <p className="text-xs text-slate-500">
                  Mọi kỳ lương đã tính sẽ lưu bản chụp (snapshot) cấu hình tại thời điểm tính để không làm sai lệch lịch sử.
                </p>
              </div>

              {configError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {configError}
                </div>
              )}
              {configSavedMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                  {configSavedMsg}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">BHXH NLĐ (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={50}
                    disabled={!canManage}
                    value={Number((config.bhxhEmpRate * 100).toFixed(2))}
                    onChange={(e) =>
                      setConfig({ ...config, bhxhEmpRate: Number(e.target.value) / 100 })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">BHYT NLĐ (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={50}
                    disabled={!canManage}
                    value={Number((config.bhytEmpRate * 100).toFixed(2))}
                    onChange={(e) =>
                      setConfig({ ...config, bhytEmpRate: Number(e.target.value) / 100 })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">BHTN NLĐ (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={50}
                    disabled={!canManage}
                    value={Number((config.bhtnEmpRate * 100).toFixed(2))}
                    onChange={(e) =>
                      setConfig({ ...config, bhtnEmpRate: Number(e.target.value) / 100 })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Trần lương đóng BHXH / BHYT (VNĐ)
                  </span>
                  <input
                    type="number"
                    min={0}
                    disabled={!canManage}
                    value={config.bhxhBhytSalaryCap}
                    onChange={(e) =>
                      setConfig({ ...config, bhxhBhytSalaryCap: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Trần lương đóng BHTN (VNĐ)
                  </span>
                  <input
                    type="number"
                    min={0}
                    disabled={!canManage}
                    value={config.bhtnSalaryCap}
                    onChange={(e) =>
                      setConfig({ ...config, bhtnSalaryCap: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Giảm trừ gia cảnh bản thân (VNĐ/tháng)
                  </span>
                  <input
                    type="number"
                    min={0}
                    disabled={!canManage}
                    value={config.personalDeduction}
                    onChange={(e) =>
                      setConfig({ ...config, personalDeduction: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Giảm trừ mỗi người phụ thuộc (VNĐ/tháng)
                  </span>
                  <input
                    type="number"
                    min={0}
                    disabled={!canManage}
                    value={config.dependentDeduction}
                    onChange={(e) =>
                      setConfig({ ...config, dependentDeduction: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={config.requireLockedAttendance}
                  onChange={(e) =>
                    setConfig({ ...config, requireLockedAttendance: e.target.checked })
                  }
                />
                <span>
                  Bắt buộc Bảng công tháng phải ở trạng thái Đã chốt (LOCKED) mới tính lương
                </span>
              </label>

              {/* Progressive 7 brackets reference table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Biểu thuế TNCN lũy tiến từng phần ({config.pitBrackets.length} bậc)
                </h3>
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-left font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Bậc</th>
                        <th className="px-4 py-2">Phần thu nhập tính thuế / tháng</th>
                        <th className="px-4 py-2 text-right">Thuế suất</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {config.pitBrackets.map((b, idx) => {
                        const prev = idx === 0 ? 0 : config.pitBrackets[idx - 1].upTo ?? 0;
                        const label =
                          b.upTo === null
                            ? `Trên ${formatVND(prev)}`
                            : `Từ ${formatVND(prev)} đến ${formatVND(b.upTo)}`;
                        return (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-semibold text-slate-800">
                              Bậc {idx + 1}
                            </td>
                            <td className="px-4 py-2 text-slate-700">{label}</td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-700">
                              {Math.round(b.rate * 100)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {canManage && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isSavingConfig ? 'Đang lưu cấu hình...' : 'Lưu cấu hình'}
                  </button>
                </div>
              )}
            </form>
          ) : null}
        </div>
      )}

      {/* Create Period Modal */}
      {isCreateModalOpen && user && (
        <PayrollPeriodFormModal
          key="create-payroll-period"
          defaultYear={currentYear}
          defaultMonth={currentMonth}
          defaultBranchId={selectedBranchId}
          hasAllBranches={user.hasAllBranches}
          branches={user.branches}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(newId) => {
            setIsCreateModalOpen(false);
            setSelectedPeriodId(newId);
            setActionMessage('Đã khởi tạo kỳ lương mới. Hãy bấm Chạy tính lương để tổng hợp.');
            triggerReloadAll();
          }}
        />
      )}

      {/* Payslip Detail / Manual Edit Modal */}
      {activePayslipId !== null && (
        <PayslipDetailModal
          key={`payslip-${activePayslipId}`}
          payslipId={activePayslipId}
          canEdit={canManage}
          onClose={() => setActivePayslipId(null)}
          onSaved={triggerReloadAll}
        />
      )}

      {/* Reopen Modal with Mandatory Reason */}
      {isReopenModalOpen && selectedPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={(e) => void handleReopenSubmit(e)}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-900">Mở lại kỳ lương đã duyệt</h3>
            <p className="text-xs text-slate-500">
              Kỳ lương <strong>{selectedPeriod.name}</strong> sẽ trở về trạng thái Đã tính lương để điều chỉnh. Thao tác này được lưu vết trong Nhật ký hệ thống.
            </p>
            <textarea
              rows={3}
              required
              minLength={5}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Nhập lý do mở lại kỳ lương (tối thiểu 5 ký tự)..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={actionBusy === 'reopen'}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {actionBusy === 'reopen' ? 'Đang mở lại...' : 'Xác nhận mở lại'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Modal for Approve / Pay / Delete */}
      <ConfirmModal
        isOpen={confirmAction !== null}
        title={
          confirmAction === 'approve'
            ? 'Xác nhận phê duyệt kỳ lương?'
            : confirmAction === 'pay'
              ? 'Xác nhận chi trả & phát hành Phiếu lương?'
              : 'Xác nhận xóa kỳ lương?'
        }
        description={
          confirmAction === 'approve'
            ? `Phê duyệt bảng lương "${selectedPeriod?.name ?? ''}" với tổng thực lĩnh ${formatVND(selectedPeriod?.totalNet ?? 0)}. Sau khi duyệt sẽ không thể chỉnh sửa trừ khi mở lại.`
            : confirmAction === 'pay'
              ? `Kỳ lương "${selectedPeriod?.name ?? ''}" sẽ bị khóa vĩnh viễn (PAID), toàn bộ phiếu lương chuyển sang Đã phát hành và gửi thông báo tới nhân viên.`
              : `Xóa mềm kỳ lương "${selectedPeriod?.name ?? ''}" và toàn bộ phiếu lương nháp trong kỳ.`
        }
        confirmLabel={
          confirmAction === 'approve'
            ? 'Phê duyệt'
            : confirmAction === 'pay'
              ? 'Chi trả & Phát phiếu'
              : 'Xóa kỳ lương'
        }
        cancelLabel="Hủy"
        variant={confirmAction === 'delete' ? 'danger' : 'primary'}
        isProcessing={actionBusy !== null}
        onConfirm={() => void handleConfirmExecute()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
