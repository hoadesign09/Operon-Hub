'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { useI18n } from '@/shared/i18n/I18nContext';

type ActiveTab = 'periods' | 'config';

const STATUS_BADGES: Record<
  PayrollPeriodItem['status'],
  { vi: string; en: string; className: string }
> = {
  DRAFT: { vi: 'Nháp', en: 'Draft', className: 'bg-slate-100 text-slate-700' },
  CALCULATED: { vi: 'Đã tính lương', en: 'Calculated', className: 'bg-amber-100 text-amber-800' },
  APPROVED: { vi: 'Đã phê duyệt', en: 'Approved', className: 'bg-blue-100 text-blue-800' },
  PAID: { vi: 'Đã chi trả & Phát phiếu', en: 'Paid & Published', className: 'bg-emerald-100 text-emerald-800' },
};

export default function HrmPayrollPage() {
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

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
          throw new Error(
            json.error?.message ??
              trRef.current('Không thể tải danh sách kỳ lương.', 'Failed to load payroll periods.'),
          );
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
        setPeriodsError(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải danh sách kỳ lương.', 'Error loading payroll periods.'),
        );
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
          throw new Error(
            json.error?.message ??
              trRef.current('Không thể tải bảng lương chi tiết.', 'Failed to load payroll details.'),
          );
        }
        setSelectedPeriod(json.data.period);
        setPayslips(json.data.payslips);
        setDetailError(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setDetailError(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải chi tiết kỳ lương.', 'Error loading payroll period details.'),
        );
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
          throw new Error(
            json.error?.message ??
              trRef.current(
                'Không thể tải cấu hình tính lương.',
                'Failed to load payroll configuration.',
              ),
          );
        }
        setConfig(json.data.config);
        setConfigError(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setConfigError(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải cấu hình lương.', 'Error loading payroll configuration.'),
        );
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
        setActionError(
          json.error?.message ??
            tr('Không thể chạy tính lương.', 'Failed to run payroll calculation.'),
        );
      } else {
        setActionMessage(
          tr(
            `Đã hoàn tất tính lương cho ${json.data.processedCount} nhân viên.`,
            `Payroll calculation completed for ${json.data.processedCount} employees.`,
          ),
        );
        setActionWarnings(json.data.warnings ?? []);
        triggerReloadAll();
      }
    } catch {
      setActionError(
        tr('Lỗi kết nối khi chạy tính lương.', 'Connection error while running payroll calculation.'),
      );
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
        setActionError(json.error?.message ?? tr('Thao tác thất bại.', 'Action failed.'));
      } else {
        if (confirmAction === 'approve') {
          setActionMessage(
            tr('Đã phê duyệt kỳ lương thành công.', 'Payroll period approved successfully.'),
          );
        } else if (confirmAction === 'pay') {
          setActionMessage(
            tr(
              `Đã xác nhận chi trả, phát hành ${json.data?.publishedCount ?? 0} phiếu lương và gửi ${json.data?.notifiedCount ?? 0} thông báo tới nhân viên.`,
              `Payment confirmed, ${json.data?.publishedCount ?? 0} payslips published, and ${json.data?.notifiedCount ?? 0} notifications sent to employees.`,
            ),
          );
        } else {
          setActionMessage(tr('Đã xóa kỳ lương.', 'Payroll period deleted.'));
          setSelectedPeriodId(null);
          setSelectedPeriod(null);
          setPayslips([]);
        }
        triggerReloadAll();
      }
    } catch {
      setActionError(tr('Lỗi kết nối máy chủ.', 'Server connection error.'));
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
        setActionError(
          json.error?.message ?? tr('Không thể mở lại kỳ lương.', 'Failed to reopen payroll period.'),
        );
      } else {
        setActionMessage(
          tr(
            'Đã mở lại kỳ lương sang trạng thái Đã tính để điều chỉnh.',
            'Payroll period reopened to Calculated status for adjustments.',
          ),
        );
        setReopenReason('');
        setIsReopenModalOpen(false);
        triggerReloadAll();
      }
    } catch {
      setActionError(
        tr('Lỗi kết nối khi mở lại kỳ lương.', 'Connection error while reopening payroll period.'),
      );
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
        setConfigError(
          json.error?.message ??
            tr('Không thể lưu cấu hình lương.', 'Failed to save payroll configuration.'),
        );
      } else {
        setConfig(json.data.config);
        setConfigSavedMsg(
          tr(
            'Đã cập nhật cấu hình Bảo hiểm & Thuế TNCN thành công.',
            'Insurance & PIT configuration updated successfully.',
          ),
        );
      }
    } catch {
      setConfigError(
        tr('Lỗi kết nối khi lưu cấu hình.', 'Connection error while saving configuration.'),
      );
    } finally {
      setIsSavingConfig(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {tr('Tính lương & Phiếu lương', 'Payroll & Payslips')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Quản lý kỳ lương, tính lương tự động từ bảng công & hợp đồng, duyệt chi trả và phát hành phiếu lương PDF/Excel.',
              'Manage payroll periods, auto-calculate salaries from attendance & contracts, approve payouts, and issue PDF/Excel payslips.',
            )}
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
            {tr('Kỳ lương & Bảng tính', 'Payroll Periods')}
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
            <span>{tr('Cấu hình BH & Thuế', 'Insurance & PIT Config')}</span>
          </button>
        </div>
      </div>

      {activeTab === 'periods' ? (
        <div className="space-y-6">
          {/* Filters + Create Period */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span>{tr('Năm:', 'Year:')}</span>
                <select
                  value={filterYear}
                  onChange={(e) => {
                    setFilterYear(e.target.value);
                    setIsLoadingPeriods(true);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="">{tr('Tất cả', 'All')}</option>
                  {[currentYear + 1, currentYear, currentYear - 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span>{tr('Trạng thái:', 'Status:')}</span>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setIsLoadingPeriods(true);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="">{tr('Tất cả', 'All')}</option>
                  <option value="DRAFT">{tr('Nháp', 'Draft')}</option>
                  <option value="CALCULATED">{tr('Đã tính lương', 'Calculated')}</option>
                  <option value="APPROVED">{tr('Đã phê duyệt', 'Approved')}</option>
                  <option value="PAID">{tr('Đã chi trả', 'Paid')}</option>
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
                <span>{tr('Tạo kỳ lương', 'New Payroll Period')}</span>
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
                  <span>{tr('Thử lại', 'Retry')}</span>
                </button>
              </div>
            ) : periods.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {tr(
                    'Chưa có kỳ lương nào phù hợp bộ lọc hiện tại.',
                    'No payroll periods match the current filters.',
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {tr(
                    'Khởi tạo kỳ lương mới để bắt đầu tổng hợp công, phụ cấp, BHXH và thuế TNCN.',
                    'Create a new payroll period to start aggregating attendance, allowances, social insurance, and PIT.',
                  )}
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <IconPlus size={16} />
                    <span>{tr('Tạo kỳ lương đầu tiên', 'Create First Period')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{tr('Kỳ lương', 'Period')}</th>
                      <th className="px-4 py-3">{tr('Chi nhánh', 'Branch')}</th>
                      <th className="px-4 py-3 text-right">{tr('Số NV', 'Headcount')}</th>
                      <th className="px-4 py-3 text-right">{tr('Tổng Gross', 'Total Gross')}</th>
                      <th className="px-4 py-3 text-right">{tr('BH NLĐ', 'Emp. Insurance')}</th>
                      <th className="px-4 py-3 text-right">{tr('Thuế TNCN', 'PIT')}</th>
                      <th className="px-4 py-3 text-right">{tr('Tổng Thực lĩnh', 'Total Net')}</th>
                      <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
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
                              {period.code} • {tr('Tháng', 'Month')}{' '}
                              {String(period.month).padStart(2, '0')}/{period.year}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {ln(period.branchName, period.branchNameEn)}
                          </td>
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
                              {locale === 'en' ? badge.en : badge.vi}
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
                      {locale === 'en'
                        ? STATUS_BADGES[selectedPeriod.status].en
                        : STATUS_BADGES[selectedPeriod.status].vi}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {tr('Mã kỳ:', 'Period Code:')} {selectedPeriod.code}
                    {selectedPeriod.approvedAt
                      ? ` • ${tr('Duyệt bởi', 'Approved by')} ${selectedPeriod.approvedByName ?? 'N/A'} (${selectedPeriod.approvedAt})`
                      : ''}
                    {selectedPeriod.paidAt
                      ? ` • ${tr('Chi trả bởi', 'Paid by')} ${selectedPeriod.paidByName ?? 'N/A'} (${selectedPeriod.paidAt})`
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
                          <span>
                            {tr('Gồm công chưa chốt (DRAFT)', 'Include unlocked attendance (DRAFT)')}
                          </span>
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
                              ? tr('Đang tính lương...', 'Calculating...')
                              : selectedPeriod.status === 'DRAFT'
                                ? tr('Chạy tính lương', 'Run Payroll')
                                : tr('Tính lại bảng lương', 'Recalculate Payroll')}
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
                      <span>{tr('Phê duyệt kỳ lương', 'Approve Period')}</span>
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
                      <span>{tr('Mở lại điều chỉnh', 'Reopen for Adjustment')}</span>
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
                      <span>{tr('Chi trả & Phát phiếu lương', 'Pay & Publish Payslips')}</span>
                    </button>
                  )}

                  {canExport && selectedPeriod.totalEmployees > 0 && (
                    <a
                      href={`/api/v1/hrm/payroll/periods/${selectedPeriod.id}/export`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <IconFileSpreadsheet size={15} />
                      <span>{tr('Xuất Excel', 'Export Excel')}</span>
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
                        <span>{tr('Xóa kỳ', 'Delete Period')}</span>
                      </button>
                    )}
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs text-slate-500">
                    {tr('Tổng Quỹ lương Gross', 'Total Gross Payroll')}
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {formatVND(selectedPeriod.totalGross)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs text-slate-500">
                    {tr('Tổng BHXH/BHYT/BHTN (NLĐ)', 'Total Employee Insurance')}
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-800">
                    {formatVND(selectedPeriod.totalInsuranceEmp)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs text-slate-500">{tr('Tổng Thuế TNCN', 'Total PIT')}</div>
                  <div className="mt-1 text-lg font-bold text-amber-700">
                    {formatVND(selectedPeriod.totalPit)}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
                  <div className="text-xs font-medium text-blue-700">
                    {tr('Tổng Thực lĩnh Chi trả (Net)', 'Total Net Payout')}
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
                    <span>
                      {tr(
                        `Lưu ý khi tính lương (${actionWarnings.length} trường hợp bỏ qua):`,
                        `Calculation notes (${actionWarnings.length} skipped):`,
                      )}
                    </span>
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
                    placeholder={tr(
                      'Tìm theo mã NV hoặc họ tên...',
                      'Search by employee code or name...',
                    )}
                    className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {tr(
                    `Hiển thị ${payslips.length} phiếu lương`,
                    `Showing ${payslips.length} payslips`,
                  )}
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
                    <span>{tr('Thử lại', 'Retry')}</span>
                  </button>
                </div>
              ) : payslips.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  {tr(
                    'Chưa có phiếu lương trong kỳ này. Hãy đảm bảo đã chốt bảng công tháng và bấm',
                    'No payslips in this period yet. Ensure monthly attendance is locked and click',
                  )}{' '}
                  <span className="font-semibold text-slate-700">
                    {tr('Chạy tính lương', 'Run Payroll')}
                  </span>
                  .
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-3">{tr('Nhân viên', 'Employee')}</th>
                        <th className="px-3 py-3 text-right">{tr('Công', 'Days')}</th>
                        <th className="px-3 py-3 text-right">{tr('Lương công', 'Prorated Pay')}</th>
                        <th className="px-3 py-3 text-right">
                          {tr('Phụ cấp + OT + Thưởng', 'Allowances + OT + Bonus')}
                        </th>
                        <th className="px-3 py-3 text-right">{tr('Tổng Gross', 'Total Gross')}</th>
                        <th className="px-3 py-3 text-right">{tr('BH (10.5%)', 'Ins. (10.5%)')}</th>
                        <th className="px-3 py-3 text-right">{tr('Thuế TNCN', 'PIT')}</th>
                        <th className="px-3 py-3 text-right">{tr('Thực lĩnh Net', 'Net Pay')}</th>
                        <th className="px-3 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payslips.map((ps) => (
                        <tr key={ps.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-900">
                              {ps.employeeCode} — {ps.employeeName}
                            </div>
                            <div
                              className="max-w-[200px] truncate text-xs text-slate-500"
                              title={`${ln(ps.departmentName, ps.departmentNameEn)} • ${ln(ps.positionName, ps.positionNameEn)}`}
                            >
                              {ln(ps.departmentName, ps.departmentNameEn)} •{' '}
                              {ln(ps.positionName, ps.positionNameEn)}
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
                                <span>{tr('Chi tiết', 'Details')}</span>
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
                <span>{tr('Thử lại', 'Retry')}</span>
              </button>
            </div>
          ) : config ? (
            <form onSubmit={(e) => void handleSaveConfig(e)} className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {tr(
                    'Cấu hình Tỷ lệ Bảo hiểm & Thuế TNCN (Việt Nam)',
                    'Vietnam Social Insurance & PIT Rate Configuration',
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  {tr(
                    'Mọi kỳ lương đã tính sẽ lưu bản chụp (snapshot) cấu hình tại thời điểm tính để không làm sai lệch lịch sử.',
                    'Calculated payroll periods store a snapshot of these settings so historical payslips remain unaffected.',
                  )}
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
                  <span className="text-xs font-semibold text-slate-700">
                    {tr('BHXH NLĐ (%)', 'Social Insurance – Emp (%)')}
                  </span>
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
                  <span className="text-xs font-semibold text-slate-700">
                    {tr('BHYT NLĐ (%)', 'Health Insurance – Emp (%)')}
                  </span>
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
                  <span className="text-xs font-semibold text-slate-700">
                    {tr('BHTN NLĐ (%)', 'Unemployment Ins. – Emp (%)')}
                  </span>
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
                    {tr('Trần lương đóng BHXH / BHYT (VNĐ)', 'Social / Health Insurance Cap (VND)')}
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
                    {tr('Trần lương đóng BHTN (VNĐ)', 'Unemployment Insurance Cap (VND)')}
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
                    {tr(
                      'Giảm trừ gia cảnh bản thân (VNĐ/tháng)',
                      'Personal Tax Deduction (VND/month)',
                    )}
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
                    {tr(
                      'Giảm trừ mỗi người phụ thuộc (VNĐ/tháng)',
                      'Dependent Tax Deduction (VND/month)',
                    )}
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
                  {tr(
                    'Bắt buộc Bảng công tháng phải ở trạng thái Đã chốt (LOCKED) mới tính lương',
                    'Require Monthly Attendance Summary to be LOCKED before calculating payroll',
                  )}
                </span>
              </label>

              {/* Progressive 7 brackets reference table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {tr(
                    `Biểu thuế TNCN lũy tiến từng phần (${config.pitBrackets.length} bậc)`,
                    `Progressive PIT Brackets (${config.pitBrackets.length} tiers)`,
                  )}
                </h3>
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-left font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-2">{tr('Bậc', 'Tier')}</th>
                        <th className="px-4 py-2">
                          {tr('Phần thu nhập tính thuế / tháng', 'Monthly Taxable Income')}
                        </th>
                        <th className="px-4 py-2 text-right">{tr('Thuế suất', 'Tax Rate')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {config.pitBrackets.map((b, idx) => {
                        const prev = idx === 0 ? 0 : config.pitBrackets[idx - 1].upTo ?? 0;
                        const label =
                          b.upTo === null
                            ? tr(`Trên ${formatVND(prev)}`, `Over ${formatVND(prev)}`)
                            : tr(
                                `Từ ${formatVND(prev)} đến ${formatVND(b.upTo)}`,
                                `From ${formatVND(prev)} to ${formatVND(b.upTo)}`,
                              );
                        return (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-semibold text-slate-800">
                              {tr('Bậc', 'Tier')} {idx + 1}
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
                    {isSavingConfig
                      ? tr('Đang lưu cấu hình...', 'Saving configuration...')
                      : tr('Lưu cấu hình', 'Save Configuration')}
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
            setActionMessage(
              tr(
                'Đã khởi tạo kỳ lương mới. Hãy bấm Chạy tính lương để tổng hợp.',
                'New payroll period created. Click Run Payroll to calculate.',
              ),
            );
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
            <h3 className="text-base font-bold text-slate-900">
              {tr('Mở lại kỳ lương đã duyệt', 'Reopen Approved Payroll Period')}
            </h3>
            <p className="text-xs text-slate-500">
              {locale === 'en' ? (
                <>
                  Payroll period <strong>{selectedPeriod.name}</strong> will return to Calculated
                  status for adjustments. This action is recorded in the Audit Log.
                </>
              ) : (
                <>
                  Kỳ lương <strong>{selectedPeriod.name}</strong> sẽ trở về trạng thái Đã tính lương
                  để điều chỉnh. Thao tác này được lưu vết trong Nhật ký hệ thống.
                </>
              )}
            </p>
            <textarea
              rows={3}
              required
              minLength={5}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder={tr(
                'Nhập lý do mở lại kỳ lương (tối thiểu 5 ký tự)...',
                'Enter reason for reopening (minimum 5 characters)...',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                {tr('Hủy', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={actionBusy === 'reopen'}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {actionBusy === 'reopen'
                  ? tr('Đang mở lại...', 'Reopening...')
                  : tr('Xác nhận mở lại', 'Confirm Reopen')}
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
            ? tr('Xác nhận phê duyệt kỳ lương?', 'Approve Payroll Period?')
            : confirmAction === 'pay'
              ? tr('Xác nhận chi trả & phát hành Phiếu lương?', 'Confirm Payout & Publish Payslips?')
              : tr('Xác nhận xóa kỳ lương?', 'Delete Payroll Period?')
        }
        description={
          confirmAction === 'approve'
            ? tr(
                `Phê duyệt bảng lương "${selectedPeriod?.name ?? ''}" với tổng thực lĩnh ${formatVND(selectedPeriod?.totalNet ?? 0)}. Sau khi duyệt sẽ không thể chỉnh sửa trừ khi mở lại.`,
                `Approve payroll "${selectedPeriod?.name ?? ''}" with total net payout ${formatVND(selectedPeriod?.totalNet ?? 0)}. Once approved, edits require reopening the period.`,
              )
            : confirmAction === 'pay'
              ? tr(
                  `Kỳ lương "${selectedPeriod?.name ?? ''}" sẽ bị khóa vĩnh viễn (PAID), toàn bộ phiếu lương chuyển sang Đã phát hành và gửi thông báo tới nhân viên.`,
                  `Payroll period "${selectedPeriod?.name ?? ''}" will be permanently locked (PAID), all payslips will be published, and employees will be notified.`,
                )
              : tr(
                  `Xóa mềm kỳ lương "${selectedPeriod?.name ?? ''}" và toàn bộ phiếu lương nháp trong kỳ.`,
                  `Soft delete payroll period "${selectedPeriod?.name ?? ''}" and all draft payslips in this period.`,
                )
        }
        confirmLabel={
          confirmAction === 'approve'
            ? tr('Phê duyệt', 'Approve')
            : confirmAction === 'pay'
              ? tr('Chi trả & Phát phiếu', 'Pay & Publish')
              : tr('Xóa kỳ lương', 'Delete Period')
        }
        cancelLabel={tr('Hủy', 'Cancel')}
        variant={confirmAction === 'delete' ? 'danger' : 'primary'}
        isProcessing={actionBusy !== null}
        onConfirm={() => void handleConfirmExecute()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
