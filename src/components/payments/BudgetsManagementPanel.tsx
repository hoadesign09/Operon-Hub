'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconAdjustments,
  IconAlertTriangle,
  IconArrowRight,
  IconArrowsExchange,
  IconCheck,
  IconCoins,
  IconEdit,
  IconFileSpreadsheet,
  IconFilterOff,
  IconLayoutGrid,
  IconList,
  IconLock,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldLock,
  IconSnowflake,
  IconWallet,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonCardGrid, SkeletonKpiGrid, SkeletonTable } from '@/components/ui/Skeleton';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';
import { BudgetAdjustModal } from './BudgetAdjustModal';
import { BudgetFormModal } from './BudgetFormModal';
import { BudgetTransferModal } from './BudgetTransferModal';
import {
  BUDGET_ENFORCEMENT_META,
  BUDGET_HEALTH_META,
  BUDGET_PERIOD_META,
  BUDGET_STATUS_META,
  type BudgetListItemDto,
  type BudgetSummaryDto,
} from './budget-ui.helpers';
import type { PaymentCategoryDto } from './payment-ui.helpers';

interface RefOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  branchId?: number;
}

interface BudgetsManagementPanelProps {
  categories: PaymentCategoryDto[];
  projects: Array<{ id: number; code: string; name: string }>;
  onBudgetsChanged?: () => void;
}

export function BudgetsManagementPanel({
  categories,
  projects,
  onBudgetsChanged,
}: BudgetsManagementPanelProps) {
  const { locale, tr, ln } = useI18n();
  const { hasPermission, selectedBranchId } = usePortalAuth();
  const canManage =
    hasPermission('payments.budgets.manage') || hasPermission('payments.manage');
  const canExport = hasPermission('payments.export') || canManage;

  const [fiscalYear, setFiscalYear] = useState<string>('2026');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [reloadTick, setReloadTick] = useState(0);

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [budgets, setBudgets] = useState<BudgetListItemDto[]>([]);
  const [summary, setSummary] = useState<BudgetSummaryDto | null>(null);
  const [branches, setBranches] = useState<RefOption[]>([]);
  const [departments, setDepartments] = useState<RefOption[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetListItemDto | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [adjustingBudget, setAdjustingBudget] = useState<BudgetListItemDto | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferPresetId, setTransferPresetId] = useState<number | null>(null);
  const [actingStatusId, setActingStatusId] = useState<number | null>(null);
  const [statusBannerError, setStatusBannerError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/v1/core/branches?limit=100&isActive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/hrm/org/departments?limit=200', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([bRes, dRes]) => {
        if (controller.signal.aborted) return;
        const [bJson, dJson] = await Promise.all([
          bRes.json().catch(() => null),
          dRes.json().catch(() => null),
        ]);
        if (bRes.ok && bJson?.success) setBranches((bJson.data ?? []) as RefOption[]);
        if (dRes.ok && dJson?.success) setDepartments((dJson.data ?? []) as RefOption[]);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: '1', limit: '100' });
    if (fiscalYear) params.set('fiscalYear', fiscalYear);
    if (statusFilter) params.set('status', statusFilter);
    if (healthFilter) params.set('health', healthFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedBranchId) params.set('branchId', String(selectedBranchId));

    const sumParams = new URLSearchParams();
    if (fiscalYear) sumParams.set('fiscalYear', fiscalYear);
    if (selectedBranchId) sumParams.set('branchId', String(selectedBranchId));

    Promise.all([
      fetch(`/api/v1/payments/budgets?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch(`/api/v1/payments/budgets/summary?${sumParams.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([listRes, sumRes]) => {
        if (controller.signal.aborted) return;
        const [listJson, sumJson] = await Promise.all([
          listRes.json().catch(() => null),
          sumRes.json().catch(() => null),
        ]);
        if (!listRes.ok || !listJson?.success) {
          setErrorMessage(
            listJson?.error?.message ??
              tr('Không thể tải danh sách quỹ ngân sách.', 'Unable to load budget funds.'),
          );
          setViewState('error');
          return;
        }
        setBudgets((listJson.data ?? []) as BudgetListItemDto[]);
        if (sumRes.ok && sumJson?.success) {
          setSummary((sumJson.data ?? null) as BudgetSummaryDto | null);
        }
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMessage(
          tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Network error. Please try again.'),
        );
        setViewState('error');
      });

    return () => controller.abort();
  }, [fiscalYear, statusFilter, healthFilter, debouncedSearch, selectedBranchId, reloadTick, tr]);

  function refreshAll() {
    setReloadTick((t) => t + 1);
    onBudgetsChanged?.();
  }

  function resetFilters() {
    setFiscalYear('2026');
    setStatusFilter('');
    setHealthFilter('');
    setSearchInput('');
    setDebouncedSearch('');
  }

  async function handleQuickStatusChange(
    budget: BudgetListItemDto,
    nextStatus: 'ACTIVE' | 'FROZEN',
  ) {
    if (actingStatusId) return;
    setStatusBannerError('');
    setActingStatusId(budget.id);
    try {
      const res = await fetch(`/api/v1/payments/budgets/${budget.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setStatusBannerError(
          json?.error?.message ??
            tr('Không thể đổi trạng thái quỹ ngân sách.', 'Unable to change budget status.'),
        );
        return;
      }
      refreshAll();
    } finally {
      setActingStatusId(null);
    }
  }

  async function handleExportExcel() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (fiscalYear) params.set('fiscalYear', fiscalYear);
      if (statusFilter) params.set('status', statusFilter);
      if (healthFilter) params.set('health', healthFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedBranchId) params.set('branchId', String(selectedBranchId));

      const res = await fetch(`/api/v1/payments/budgets/export/excel?${params.toString()}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operon-budgets-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const hasFilters = Boolean(statusFilter || healthFilter || debouncedSearch);

  return (
    <div className="w-full space-y-5">
      {/* 5 Executive Budget KPI Cards */}
      {viewState === 'loading' && !summary ? (
        <SkeletonKpiGrid
          count={5}
          compact
          columnsClass="grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5"
        />
      ) : (
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Tổng Hạn mức Cấp', 'Total Allocated')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconCoins size={17} />
            </span>
          </div>
          <div className="mt-2.5 text-xl font-extrabold tabular-nums text-slate-900">
            {formatVND(summary?.totalAllocated ?? 0)}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-slate-500">
            {tr(
              `${summary?.activeBudgets ?? 0} quỹ đang hiệu lực / ${summary?.totalBudgets ?? 0} quỹ`,
              `${summary?.activeBudgets ?? 0} active / ${summary?.totalBudgets ?? 0} funds`,
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Đang giữ chỗ (Cam kết)', 'Reserved / Committed')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <IconLock size={17} />
            </span>
          </div>
          <div className="mt-2.5 text-xl font-extrabold tabular-nums text-amber-700">
            {formatVND(summary?.totalReserved ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {tr('Từ Đề xuất & Thanh toán chờ chi', 'From Proposals & Pending Payments')}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Đã thực chi (Giải ngân)', 'Actual Disbursed')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconCheck size={17} />
            </span>
          </div>
          <div className="mt-2.5 text-xl font-extrabold tabular-nums text-emerald-700">
            {formatVND(summary?.totalSpent ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {tr(
              `Tỷ lệ sử dụng chung: ${summary?.overallUtilizationPercent ?? 0}%`,
              `Overall utilization: ${summary?.overallUtilizationPercent ?? 0}%`,
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Khả dụng còn lại', 'Remaining Available')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <IconWallet size={17} />
            </span>
          </div>
          <div
            className={`mt-2.5 text-xl font-extrabold tabular-nums ${
              (summary?.totalAvailable ?? 0) < 0 ? 'text-rose-700' : 'text-teal-700'
            }`}
          >
            {formatVND(summary?.totalAvailable ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {tr('Hạn mức − Giữ chỗ − Thực chi', 'Allocated − Reserved − Spent')}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setHealthFilter((prev) => (prev === 'WARNING' ? '' : 'WARNING'))}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            healthFilter === 'WARNING' || healthFilter === 'EXCEEDED'
              ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20'
              : 'border-slate-200 bg-white hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Cảnh báo / Vượt mức', 'Warning / Exceeded')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <IconAlertTriangle size={17} />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tabular-nums text-rose-700">
              {(summary?.warningCount ?? 0) + (summary?.exceededCount ?? 0)}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {tr(
                `${summary?.warningCount ?? 0} cảnh báo • ${summary?.exceededCount ?? 0} vượt`,
                `${summary?.warningCount ?? 0} warn • ${summary?.exceededCount ?? 0} over`,
              )}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {tr('Nhấn để lọc các quỹ cần lưu ý', 'Click to filter attention funds')}
          </div>
        </button>
      </section>
      )}

      {statusBannerError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
          {statusBannerError}
        </div>
      )}

      {/* Action & Filter Toolbar */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBudget(null);
                    setFormKey((k) => k + 1);
                    setIsFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
                >
                  <IconPlus size={15} />
                  <span>{tr('Tạo Quỹ Ngân sách', 'New Budget Fund')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTransferPresetId(null);
                    setIsTransferOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                >
                  <IconArrowsExchange size={15} />
                  <span>{tr('Điều chuyển Ngân sách', 'Transfer Budget')}</span>
                </button>
              </>
            )}
            {canExport && (
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportExcel()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                <IconFileSpreadsheet size={15} />
                <span>
                  {isExporting
                    ? tr('Đang xuất...', 'Exporting...')
                    : tr('Xuất Excel Ngân sách', 'Export Budgets Excel')}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <IconLayoutGrid size={15} />
              <span>{tr('Thẻ', 'Cards')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <IconList size={15} />
              <span>{tr('Bảng', 'Table')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <IconSearch
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tr(
                'Tìm mã quỹ, tên quỹ, phòng ban, danh mục...',
                'Search fund code, name, department, category...',
              )}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">{tr('Tất cả năm tài chính', 'All Fiscal Years')}</option>
            <option value="2027">FY 2027</option>
            <option value="2026">FY 2026</option>
            <option value="2025">FY 2025</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">{tr('Tất cả trạng thái', 'All Statuses')}</option>
            <option value="ACTIVE">{tr('Đang hiệu lực', 'Active')}</option>
            <option value="FROZEN">{tr('Tạm khóa', 'Frozen')}</option>
            <option value="DRAFT">{tr('Nháp', 'Draft')}</option>
            <option value="CLOSED">{tr('Đã đóng sổ', 'Closed')}</option>
          </select>

          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">{tr('Tất cả mức cảnh báo', 'All Health Levels')}</option>
            <option value="HEALTHY">{tr('An toàn', 'Healthy')}</option>
            <option value="WARNING">{tr('Chạm ngưỡng cảnh báo', 'Warning')}</option>
            <option value="EXCEEDED">{tr('Vượt hạn mức', 'Exceeded')}</option>
          </select>

          <div className="flex items-center justify-end gap-1.5">
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <IconFilterOff size={14} />
                <span>{tr('Xóa lọc', 'Clear')}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4 Mandatory States */}
      {viewState === 'loading' &&
        (viewMode === 'table' ? (
          <SkeletonTable rows={6} columns={8} showToolbar={false} showPagination={false} />
        ) : (
          <SkeletonCardGrid
            count={6}
            columnsClass="grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          />
        ))}

      {viewState === 'error' && (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              setViewState('loading');
              setReloadTick((t) => t + 1);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconRefresh size={15} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      )}

      {viewState === 'success' && budgets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <IconCoins size={24} />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">
            {tr('Chưa có quỹ ngân sách nào phù hợp', 'No matching budget funds')}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {tr(
              'Khởi tạo quỹ ngân sách để kiểm soát chi tiêu thống nhất cho cả Đề xuất Nội bộ và Thanh toán.',
              'Create a budget fund to control spending across both Internal Proposals and Payment Requests.',
            )}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingBudget(null);
                setFormKey((k) => k + 1);
                setIsFormOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <IconPlus size={15} />
              <span>{tr('Tạo Quỹ Ngân sách đầu tiên', 'Create First Budget Fund')}</span>
            </button>
          )}
        </div>
      )}

      {viewState === 'success' && budgets.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {budgets.map((b) => {
            const stMeta = BUDGET_STATUS_META[b.status];
            const enfMeta = BUDGET_ENFORCEMENT_META[b.enforcementMode];
            const hlMeta = BUDGET_HEALTH_META[b.health];
            const spentW = Math.min(100, Math.max(0, b.spentPercent));
            const reservedW = Math.min(100 - spentW, Math.max(0, b.reservedPercent));

            return (
              <div
                key={b.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/services/payments/budgets/${b.id}`}
                        className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white hover:bg-blue-700"
                      >
                        {b.code}
                      </Link>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {b.periodLabel}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${stMeta.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${stMeta.dotCls}`} />
                      {locale === 'en' ? stMeta.en : stMeta.vi}
                    </span>
                  </div>

                  <Link
                    href={`/services/payments/budgets/${b.id}`}
                    className="mt-2.5 block line-clamp-2 text-sm font-bold text-slate-900 hover:text-blue-700"
                  >
                    {ln(b.name, b.nameEn)}
                  </Link>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    {b.departmentName && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                        {ln(b.departmentName, b.departmentNameEn)}
                      </span>
                    )}
                    {b.categoryName && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
                        {ln(b.categoryName, b.categoryNameEn)}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${enfMeta.cls}`}>
                      <IconShieldLock size={11} />
                      {locale === 'en' ? enfMeta.en : enfMeta.vi}
                    </span>
                  </div>

                  {/* Stacked progress bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${hlMeta.cls}`}>
                        {locale === 'en' ? hlMeta.en : hlMeta.vi} • {b.utilizationPercent}%
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatDateVN(b.startDate)} – {formatDateVN(b.endDate)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="flex h-full w-full">
                        <div className="h-full bg-emerald-500" style={{ width: `${spentW}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${reservedW}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <div className="text-[10px] text-slate-500">{tr('Hạn mức cấp', 'Allocated')}</div>
                        <div className="font-extrabold tabular-nums text-slate-900">
                          {formatVND(b.allocatedAmount)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-emerald-50/60 p-2">
                        <div className="text-[10px] text-emerald-700">{tr('Khả dụng còn', 'Available')}</div>
                        <div
                          className={`font-extrabold tabular-nums ${
                            b.availableAmount < 0 ? 'text-rose-700' : 'text-emerald-800'
                          }`}
                        >
                          {formatVND(b.availableAmount)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-1 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-500">
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          {tr('Giữ chỗ', 'Reserved')}
                        </span>
                        <span className="font-bold tabular-nums text-amber-700">
                          {formatVND(b.reservedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-1 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-500">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {tr('Thực chi', 'Spent')}
                        </span>
                        <span className="font-bold tabular-nums text-emerald-700">
                          {formatVND(b.spentAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-medium text-slate-500">
                    {tr(
                      `${b.linkedProposalCount} đề xuất • ${b.linkedPaymentCount} thanh toán`,
                      `${b.linkedProposalCount} proposals • ${b.linkedPaymentCount} payments`,
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && b.status !== 'CLOSED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAdjustingBudget(b)}
                          title={tr('Bổ sung / Cắt giảm', 'Adjust Allocation')}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <IconAdjustments size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBudget(b);
                            setFormKey((k) => k + 1);
                            setIsFormOpen(true);
                          }}
                          title={tr('Chỉnh sửa', 'Edit')}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                        >
                          <IconEdit size={14} />
                        </button>
                        {b.status === 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={actingStatusId === b.id}
                            onClick={() => void handleQuickStatusChange(b, 'FROZEN')}
                            title={tr('Tạm khóa quỹ', 'Freeze Fund')}
                            className="rounded-lg border border-amber-200 p-1.5 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                          >
                            <IconSnowflake size={14} />
                          </button>
                        )}
                      </>
                    )}
                    <Link
                      href={`/services/payments/budgets/${b.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                    >
                      <span>{tr('Sổ cái', 'Ledger')}</span>
                      <IconArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewState === 'success' && budgets.length > 0 && viewMode === 'table' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">{tr('Mã & Tên Quỹ', 'Code & Fund Name')}</th>
                  <th className="px-4 py-3">{tr('Kỳ & Phạm vi', 'Period & Scope')}</th>
                  <th className="px-4 py-3 text-right">{tr('Hạn mức cấp', 'Allocated')}</th>
                  <th className="px-4 py-3 text-right">{tr('Giữ chỗ', 'Reserved')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thực chi', 'Spent')}</th>
                  <th className="px-4 py-3 text-right">{tr('Khả dụng', 'Available')}</th>
                  <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgets.map((b) => {
                  const stMeta = BUDGET_STATUS_META[b.status];
                  const hlMeta = BUDGET_HEALTH_META[b.health];
                  const periodMeta = BUDGET_PERIOD_META[b.periodType];
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/services/payments/budgets/${b.id}`}
                          className="font-mono text-xs font-bold text-blue-700 hover:underline"
                        >
                          {b.code}
                        </Link>
                        <div className="mt-0.5 font-bold text-slate-900">
                          {ln(b.name, b.nameEn)}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {tr(
                            `${b.linkedProposalCount} đề xuất • ${b.linkedPaymentCount} thanh toán`,
                            `${b.linkedProposalCount} proposals • ${b.linkedPaymentCount} payments`,
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-800">
                          {b.periodLabel} ({locale === 'en' ? periodMeta.en : periodMeta.vi})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {[
                            b.departmentName ? ln(b.departmentName, b.departmentNameEn) : null,
                            b.categoryName ? ln(b.categoryName, b.categoryNameEn) : null,
                          ]
                            .filter(Boolean)
                            .join(' • ') || tr('Toàn công ty', 'Company-wide')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                        {formatVND(b.allocatedAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-amber-700">
                        {formatVND(b.reservedAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                        {formatVND(b.spentAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className={`font-extrabold tabular-nums ${
                            b.availableAmount < 0 ? 'text-rose-700' : 'text-teal-700'
                          }`}
                        >
                          {formatVND(b.availableAmount)}
                        </div>
                        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${hlMeta.cls}`}>
                          {b.utilizationPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${stMeta.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${stMeta.dotCls}`} />
                          {locale === 'en' ? stMeta.en : stMeta.vi}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="inline-flex items-center gap-1.5">
                          {canManage && b.status !== 'CLOSED' && (
                            <button
                              type="button"
                              onClick={() => setAdjustingBudget(b)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              {tr('Điều chỉnh', 'Adjust')}
                            </button>
                          )}
                          <Link
                            href={`/services/payments/budgets/${b.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
                          >
                            <span>{tr('Chi tiết', 'Details')}</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <BudgetFormModal
        key={formKey}
        isOpen={isFormOpen}
        editingBudget={editingBudget}
        branches={branches}
        departments={departments}
        categories={categories}
        projects={projects}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => {
          setIsFormOpen(false);
          refreshAll();
        }}
      />

      <BudgetAdjustModal
        budget={adjustingBudget}
        onClose={() => setAdjustingBudget(null)}
        onAdjusted={() => {
          setAdjustingBudget(null);
          refreshAll();
        }}
      />

      <BudgetTransferModal
        isOpen={isTransferOpen}
        budgets={budgets}
        presetFromBudgetId={transferPresetId}
        onClose={() => setIsTransferOpen(false)}
        onTransferred={() => {
          setIsTransferOpen(false);
          refreshAll();
        }}
      />
    </div>
  );
}
