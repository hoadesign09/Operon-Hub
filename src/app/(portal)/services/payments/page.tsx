'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCategory,
  IconCheck,
  IconClock,
  IconCoins,
  IconCreditCard,
  IconFileDownload,
  IconFileSpreadsheet,
  IconFilterOff,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconReceiptRefund,
  IconRefresh,
  IconSearch,
  IconWallet,
} from '@tabler/icons-react';
import { BudgetsManagementPanel } from '@/components/payments/BudgetsManagementPanel';
import { PaymentCategoryModal } from '@/components/payments/PaymentCategoryModal';
import { PaymentFormModal } from '@/components/payments/PaymentFormModal';
import {
  PAYMENT_PRIORITY_META,
  PAYMENT_STATUS_META,
  PAYMENT_TYPE_META,
  type PaymentCategoryDto,
  type PaymentFormOptionsDto,
  type PaymentListItemDto,
  type PaymentSummaryDto,
} from '@/components/payments/payment-ui.helpers';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonCardGrid, SkeletonKpiGrid, SkeletonTable } from '@/components/ui/Skeleton';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { PaginationMeta } from '@/lib/portable/pagination';
import { useI18n } from '@/shared/i18n/I18nContext';

type PaymentScope =
  | 'all'
  | 'mine'
  | 'pending_my_approval'
  | 'ready_to_disburse'
  | 'unsettled_advances'
  | 'overdue';

const SCOPE_TABS: ReadonlyArray<{ key: PaymentScope; vi: string; en: string }> = [
  { key: 'all', vi: 'Tất cả', en: 'All' },
  { key: 'mine', vi: 'Của tôi', en: 'My Requests' },
  { key: 'pending_my_approval', vi: 'Chờ tôi duyệt', en: 'Pending My Approval' },
  { key: 'ready_to_disburse', vi: 'Chờ giải ngân', en: 'Ready to Disburse' },
  { key: 'unsettled_advances', vi: 'Tạm ứng chưa QT', en: 'Unsettled Advances' },
  { key: 'overdue', vi: 'Quá hạn', en: 'Overdue' },
];

export default function PaymentsListPage() {
  const { locale, tr, ln } = useI18n();
  const { hasPermission, selectedBranchId } = usePortalAuth();
  const canCreate = hasPermission('payments.create');
  const canManage = hasPermission('payments.manage');
  const canExport = hasPermission('payments.export');
  const canViewBudgets =
    canManage ||
    hasPermission('payments.budgets.read') ||
    hasPermission('payments.budgets.manage') ||
    hasPermission('payments.disburse');

  const [workspaceTab, setWorkspaceTab] = useState<'payments' | 'budgets'>('payments');
  const [scope, setScope] = useState<PaymentScope>('all');
  const [paymentType, setPaymentType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [budgetIdFilter, setBudgetIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [items, setItems] = useState<PaymentListItemDto[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<PaymentSummaryDto | null>(null);
  const [categories, setCategories] = useState<PaymentCategoryDto[]>([]);
  const [options, setOptions] = useState<PaymentFormOptionsDto | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [presetProposalId, setPresetProposalId] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('tab') === 'budgets' && canViewBudgets) {
        setWorkspaceTab('budgets');
      }
      const propParam = Number(sp.get('createFromProposal'));
      if (Number.isInteger(propParam) && propParam > 0 && canCreate) {
        setWorkspaceTab('payments');
        setPresetProposalId(propParam);
        setFormKey((k) => k + 1);
        setIsFormOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canViewBudgets, canCreate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/v1/payments/categories?includeInactive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/payments/options', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([cRes, oRes]) => {
        if (controller.signal.aborted) return;
        const [cJson, oJson] = await Promise.all([
          cRes.json().catch(() => null),
          oRes.json().catch(() => null),
        ]);
        if (cRes.ok && cJson?.success) {
          setCategories((cJson.data ?? []) as PaymentCategoryDto[]);
        }
        if (oRes.ok && oJson?.success) {
          setOptions((oJson.data ?? null) as PaymentFormOptionsDto | null);
        }
      })
      .catch(() => {
        // Non-blocking auxiliary metadata fetch
      });
    return () => controller.abort();
  }, [reloadTick]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      scope,
      page: String(page),
      limit: '20',
    });
    if (paymentType) params.set('paymentType', paymentType);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryId) params.set('categoryId', categoryId);
    if (budgetIdFilter) params.set('budgetId', budgetIdFilter);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedBranchId) params.set('branchId', String(selectedBranchId));

    const sumParams = new URLSearchParams();
    if (selectedBranchId) sumParams.set('branchId', String(selectedBranchId));

    Promise.all([
      fetch(`/api/v1/payments?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch(`/api/v1/payments/summary?${sumParams.toString()}`, {
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
              tr('Không thể tải danh sách đề nghị thanh toán.', 'Unable to load payment requests.'),
          );
          setViewState('error');
          return;
        }
        setItems((listJson.data ?? []) as PaymentListItemDto[]);
        setMeta((listJson.meta ?? null) as PaginationMeta | null);
        if (sumRes.ok && sumJson?.success) {
          setSummary((sumJson.data ?? null) as PaymentSummaryDto | null);
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
  }, [
    scope,
    paymentType,
    statusFilter,
    categoryId,
    budgetIdFilter,
    fromDate,
    toDate,
    debouncedSearch,
    selectedBranchId,
    page,
    reloadTick,
    tr,
  ]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  function resetFilters() {
    setScope('all');
    setPaymentType('');
    setStatusFilter('');
    setCategoryId('');
    setBudgetIdFilter('');
    setFromDate('');
    setToDate('');
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  }

  function openCreateModal() {
    setPresetProposalId(null);
    setFormKey((k) => k + 1);
    setIsFormOpen(true);
  }

  async function handleExportExcel() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ scope });
      if (paymentType) params.set('paymentType', paymentType);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryId) params.set('categoryId', categoryId);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedBranchId) params.set('branchId', String(selectedBranchId));

      const res = await fetch(`/api/v1/payments/export/excel?${params.toString()}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operon-payments-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const hasActiveFilters = Boolean(
    scope !== 'all' ||
      paymentType ||
      statusFilter ||
      categoryId ||
      budgetIdFilter ||
      fromDate ||
      toDate ||
      debouncedSearch,
  );

  return (
    <div className="w-full space-y-5">
      {/* Midnight Finance Hero Header */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#1E3A5F] p-6 text-white shadow-sm">
        <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold text-amber-200">
              <IconCreditCard size={14} />
              <span>{tr('Tài chính & Kế toán Nội bộ', 'Internal Finance & Treasury')}</span>
            </div>
            <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white">
              {tr('Đề nghị Thanh toán, Tạm ứng & Ngân sách', 'Payments, Advances & Budget Control')}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {tr(
                'Quản lý trọn vòng đời Tạm ứng, Hoàn ứng, Thanh toán hóa đơn VAT và kiểm soát Quỹ Ngân sách liên thông Đề xuất Nội bộ.',
                'End-to-end management for advances, reimbursements, vendor VAT invoices, and shared Budget Control across Proposals & Payments.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canManage && workspaceTab === 'payments' && (
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
              >
                <IconCategory size={16} />
                <span>{tr('Danh mục khoản chi', 'Categories')}</span>
              </button>
            )}
            {canExport && workspaceTab === 'payments' && (
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportExcel()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                <IconFileSpreadsheet size={16} />
                <span>
                  {isExporting
                    ? tr('Đang xuất...', 'Exporting...')
                    : tr('Xuất Excel', 'Export Excel')}
                </span>
              </button>
            )}
            {canCreate && workspaceTab === 'payments' && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/25 transition hover:bg-amber-400"
              >
                <IconPlus size={16} />
                <span>{tr('Tạo đề nghị thanh toán', 'New Payment Request')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Workspace Switcher: Payments | Budget Management */}
        {canViewBudgets && (
          <div className="relative z-10 mt-5 inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 p-1 backdrop-blur-xs">
            <button
              type="button"
              onClick={() => setWorkspaceTab('payments')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
                workspaceTab === 'payments'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <IconCreditCard size={15} />
              <span>{tr('Đề nghị Thanh toán & Tạm ứng', 'Payment & Advance Requests')}</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('budgets')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
                workspaceTab === 'budgets'
                  ? 'bg-emerald-400 text-slate-950 shadow-xs'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <IconCoins size={15} />
              <span>{tr('Quản lý Ngân sách (Dùng chung Đề xuất & Thanh toán)', 'Budget Management (Shared)')}</span>
            </button>
          </div>
        )}
      </section>

      {workspaceTab === 'budgets' && canViewBudgets ? (
        <BudgetsManagementPanel
          categories={categories}
          projects={options?.activeProjects ?? []}
          onBudgetsChanged={triggerReload}
        />
      ) : (
        <>

      {/* 5 Interactive Finance KPI Cards */}
      {viewState === 'loading' && !summary ? (
        <SkeletonKpiGrid
          count={5}
          compact
          columnsClass="grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5"
        />
      ) : (
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => {
            setScope('pending_my_approval');
            setPage(1);
          }}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            scope === 'pending_my_approval'
              ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
              : 'border-slate-200 bg-white hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Chờ tôi duyệt', 'Pending My Approval')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <IconClock size={17} />
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-extrabold tabular-nums text-slate-900">
            {summary?.pendingMyApprovalCount ?? 0}
          </div>
          <div className="mt-1 text-xs font-semibold tabular-nums text-amber-700">
            {formatVND(summary?.pendingMyApprovalAmount ?? 0)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setScope('ready_to_disburse');
            setPage(1);
          }}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            scope === 'ready_to_disburse'
              ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
              : 'border-slate-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Chờ giải ngân', 'Ready to Disburse')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconWallet size={17} />
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-extrabold tabular-nums text-slate-900">
            {summary?.readyToDisburseCount ?? 0}
          </div>
          <div className="mt-1 text-xs font-semibold tabular-nums text-blue-700">
            {formatVND(summary?.readyToDisburseAmount ?? 0)}
          </div>
        </button>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Đã chi trả tháng này', 'Paid This Month')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconCheck size={17} />
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-extrabold tabular-nums text-slate-900">
            {summary?.paidThisMonthCount ?? 0}
          </div>
          <div className="mt-1 text-xs font-semibold tabular-nums text-emerald-700">
            {formatVND(summary?.paidThisMonthAmount ?? 0)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setScope('unsettled_advances');
            setPage(1);
          }}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            scope === 'unsettled_advances'
              ? 'border-violet-500 bg-violet-50/50 ring-2 ring-violet-500/20'
              : 'border-slate-200 bg-white hover:border-violet-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Tạm ứng chưa quyết toán', 'Unsettled Advances')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <IconReceiptRefund size={17} />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tabular-nums text-slate-900">
              {summary?.unsettledAdvancesCount ?? 0}
            </span>
            {(summary?.overdueAdvancesCount ?? 0) > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                {tr(
                  `${summary?.overdueAdvancesCount} quá hạn`,
                  `${summary?.overdueAdvancesCount} overdue`,
                )}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs font-semibold tabular-nums text-violet-700">
            {formatVND(summary?.unsettledAdvancesAmount ?? 0)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setScope('overdue');
            setPage(1);
          }}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            scope === 'overdue'
              ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20'
              : 'border-slate-200 bg-white hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{tr('Quá hạn thanh toán', 'Overdue Payments')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <IconAlertTriangle size={17} />
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-extrabold tabular-nums text-rose-700">
            {summary?.overdueDueDateCount ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {tr(
              `${summary?.draftCount ?? 0} nháp • ${summary?.needsRevisionCount ?? 0} cần bổ sung`,
              `${summary?.draftCount ?? 0} drafts • ${summary?.needsRevisionCount ?? 0} revisions`,
            )}
          </div>
        </button>
      </section>
      )}

      {/* Scope Tabs + Filter Toolbar */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {SCOPE_TABS.map((tab) => {
              const active = scope === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setScope(tab.key);
                    setPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-[#0F172A] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {locale === 'en' ? tab.en : tab.vi}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
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
                'Tìm mã phiếu, tiêu đề, thụ hưởng, số hóa đơn VAT...',
                'Search code, title, beneficiary, VAT invoice...',
              )}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={paymentType}
            onChange={(e) => {
              setPaymentType(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">{tr('Tất cả loại chứng từ', 'All Voucher Types')}</option>
            <option value="CASH_ADVANCE">{tr('Đề nghị Tạm ứng', 'Cash Advance')}</option>
            <option value="REIMBURSEMENT">{tr('Hoàn ứng / Công tác phí', 'Reimbursement')}</option>
            <option value="VENDOR_PAYMENT">{tr('Thanh toán Nhà cung cấp', 'Vendor Payment')}</option>
            <option value="ADVANCE_SETTLEMENT">{tr('Quyết toán Tạm ứng', 'Advance Settlement')}</option>
          </select>

          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">{tr('Tất cả danh mục', 'All Categories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {ln(cat.name, cat.nameEn)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">{tr('Tất cả trạng thái', 'All Statuses')}</option>
            <option value="DRAFT">{tr('Nháp', 'Draft')}</option>
            <option value="PENDING_APPROVAL">{tr('Chờ phê duyệt', 'Pending Approval')}</option>
            <option value="NEEDS_REVISION">{tr('Cần bổ sung', 'Needs Revision')}</option>
            <option value="APPROVED">{tr('Chờ giải ngân', 'Ready to Disburse')}</option>
            <option value="PARTIALLY_PAID">{tr('Chi từng phần', 'Partially Paid')}</option>
            <option value="PAID">{tr('Đã hoàn tất chi', 'Paid')}</option>
            <option value="REJECTED">{tr('Từ chối', 'Rejected')}</option>
            <option value="CANCELLED">{tr('Đã hủy', 'Cancelled')}</option>
          </select>

          <div className="flex items-center gap-1.5">
            <select
              value={budgetIdFilter}
              onChange={(e) => {
                setBudgetIdFilter(e.target.value);
                setPage(1);
              }}
              aria-label={tr('Lọc theo quỹ ngân sách', 'Filter by budget fund')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">{tr('Tất cả quỹ ngân sách', 'All Budget Funds')}</option>
              {(options?.activeBudgets ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {ln(b.name, b.nameEn)}
                </option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                title={tr('Xóa bộ lọc', 'Reset Filters')}
                className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <IconFilterOff size={15} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content: 4 Mandatory States */}
      {viewState === 'loading' &&
        (viewMode === 'cards' ? (
          <SkeletonCardGrid
            count={6}
            columnsClass="grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          />
        ) : (
          <SkeletonTable rows={6} columns={7} showToolbar={false} showPagination={false} />
        ))}

      {viewState === 'error' && (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-2xs">
          <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={triggerReload}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconRefresh size={15} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      )}

      {viewState === 'success' && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <IconCreditCard size={24} />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">
            {tr('Chưa có đề nghị thanh toán nào phù hợp', 'No matching payment requests')}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {hasActiveFilters
              ? tr(
                  'Thử điều chỉnh lại bộ lọc hoặc xóa từ khóa tìm kiếm.',
                  'Try adjusting your filters or clearing the search query.',
                )
              : tr(
                  'Bắt đầu bằng cách lập đề nghị tạm ứng, hoàn ứng hoặc thanh toán hóa đơn nhà cung cấp.',
                  'Get started by creating a cash advance, reimbursement, or vendor invoice request.',
                )}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {tr('Xóa bộ lọc', 'Clear Filters')}
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <IconPlus size={15} />
                <span>{tr('Tạo đề nghị đầu tiên', 'Create First Request')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {viewState === 'success' && items.length > 0 && viewMode === 'table' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">{tr('Mã & Loại phiếu', 'Code & Type')}</th>
                  <th className="px-4 py-3">{tr('Nội dung đề nghị', 'Payment Details')}</th>
                  <th className="px-4 py-3">{tr('Người đề nghị / Thụ hưởng', 'Requester / Beneficiary')}</th>
                  <th className="px-4 py-3 text-right">{tr('Giá trị & Tiến độ chi', 'Amount & Payout')}</th>
                  <th className="px-4 py-3">{tr('Hạn chi', 'Due Date')}</th>
                  <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const typeMeta = PAYMENT_TYPE_META[item.paymentType];
                  const statusMeta = PAYMENT_STATUS_META[item.status];
                  const priorityMeta = PAYMENT_PRIORITY_META[item.priority];

                  return (
                    <tr key={item.id} className="transition hover:bg-slate-50/80">
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/services/payments/${item.id}`}
                          className="font-mono text-xs font-bold text-blue-700 hover:underline"
                        >
                          {item.code}
                        </Link>
                        <div className="mt-1">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${typeMeta.cls}`}
                          >
                            {locale === 'en' ? typeMeta.short.en : typeMeta.short.vi}
                          </span>
                        </div>
                      </td>

                      <td className="max-w-sm px-4 py-3 align-top">
                        <Link
                          href={`/services/payments/${item.id}`}
                          className="line-clamp-2 font-bold text-slate-900 hover:text-blue-700"
                        >
                          {item.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.categoryColor }}
                          />
                          <span>{ln(item.categoryName, item.categoryNameEn)}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityMeta.cls}`}>
                            {locale === 'en' ? priorityMeta.en : priorityMeta.vi}
                          </span>
                          {item.budgetCode && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                              {item.budgetCode}
                            </span>
                          )}
                          {item.proposalCode && (
                            <span className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] text-violet-700">
                              {item.proposalCode}
                            </span>
                          )}
                          {item.projectCode && (
                            <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-[10px] text-cyan-700">
                              {item.projectCode}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-800">{item.requesterName}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {tr('Thụ hưởng', 'Payee')}:{' '}
                          <span className="font-medium text-slate-700">{item.beneficiaryName}</span>
                        </div>
                        {item.departmentName && (
                          <div className="text-[11px] text-slate-400">
                            {ln(item.departmentName, item.departmentNameEn)}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right align-top">
                        <div className="text-sm font-extrabold tabular-nums text-slate-900">
                          {formatVND(item.totalAmount)}
                        </div>
                        {item.taxAmount > 0 && (
                          <div className="text-[10px] text-slate-400">
                            {tr('Gồm VAT', 'Incl. VAT')}: {formatVND(item.taxAmount)}
                          </div>
                        )}
                        {(item.status === 'PARTIALLY_PAID' || item.status === 'PAID') && (
                          <div className="mt-1.5 ml-auto w-28">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${item.disbursementProgressPercent}%` }}
                              />
                            </div>
                            <div className="mt-0.5 text-[10px] font-semibold text-emerald-700">
                              {item.disbursementProgressPercent}% • {formatVND(item.disbursedAmount)}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {item.dueDate ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                              item.isOverdue
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                                : 'text-slate-700'
                            }`}
                          >
                            {item.isOverdue && <IconAlertTriangle size={12} />}
                            {formatDateVN(item.dueDate)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {item.paymentType === 'CASH_ADVANCE' && item.status === 'PAID' && (
                          <div className="mt-1">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                item.isSettled
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-violet-50 text-violet-700'
                              }`}
                            >
                              {item.isSettled
                                ? tr('Đã quyết toán', 'Settled')
                                : tr('Chưa quyết toán', 'Unsettled')}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotCls}`} />
                          {locale === 'en' ? statusMeta.en : statusMeta.vi}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={`/api/v1/payments/${item.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            title={tr('Tải phiếu PDF', 'Download PDF')}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <IconFileDownload size={15} />
                          </a>
                          <Link
                            href={`/services/payments/${item.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
                          >
                            <span>{tr('Chi tiết', 'Details')}</span>
                            <IconArrowRight size={13} />
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

      {viewState === 'success' && items.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const typeMeta = PAYMENT_TYPE_META[item.paymentType];
            const statusMeta = PAYMENT_STATUS_META[item.status];
            return (
              <Link
                key={item.id}
                href={`/services/payments/${item.id}`}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-blue-400 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700">{item.code}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.cls}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotCls}`} />
                      {locale === 'en' ? statusMeta.en : statusMeta.vi}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${typeMeta.cls}`}
                    >
                      {locale === 'en' ? typeMeta.short.en : typeMeta.short.vi}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {ln(item.categoryName, item.categoryNameEn)}
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-blue-700">
                    {item.title}
                  </h3>
                  <div className="mt-2 text-xs text-slate-500">
                    {tr('Thụ hưởng', 'Payee')}:{' '}
                    <strong className="text-slate-800">{item.beneficiaryName}</strong>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">
                      {tr('Tổng tiền', 'Total Amount')}
                    </div>
                    <div className="text-base font-extrabold tabular-nums text-slate-900">
                      {formatVND(item.totalAmount)}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>{item.requesterName}</div>
                    {item.dueDate && (
                      <div className={item.isOverdue ? 'font-bold text-rose-600' : ''}>
                        {tr('Hạn', 'Due')}: {formatDateVN(item.dueDate)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {viewState === 'success' && meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <span>
            {tr(
              `Trang ${meta.page} / ${meta.totalPages} (${meta.total} phiếu)`,
              `Page ${meta.page} / ${meta.totalPages} (${meta.total} requests)`,
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
            >
              {tr('Trước', 'Prev')}
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
            >
              {tr('Sau', 'Next')}
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* Create Modal */}
      {isFormOpen && (
        <PaymentFormModal
          key={formKey}
          isOpen={isFormOpen}
          editingPayment={null}
          presetProposalId={presetProposalId}
          categories={categories}
          options={options}
          onClose={() => {
            setIsFormOpen(false);
            setPresetProposalId(null);
          }}
          onSaved={() => {
            setIsFormOpen(false);
            setPresetProposalId(null);
            triggerReload();
          }}
        />
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <PaymentCategoryModal
          isOpen={isCategoryModalOpen}
          categories={categories}
          onClose={() => setIsCategoryModalOpen(false)}
          onChanged={triggerReload}
        />
      )}
    </div>
  );
}
