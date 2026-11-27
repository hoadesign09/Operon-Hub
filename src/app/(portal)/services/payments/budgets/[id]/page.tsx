'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  IconAdjustments,
  IconArrowLeft,
  IconCheck,
  IconCoins,
  IconCreditCard,
  IconEdit,
  IconFileDescription,
  IconHistory,
  IconLock,
  IconRefresh,
  IconShieldLock,
  IconSnowflake,
  IconWallet,
} from '@tabler/icons-react';
import { BudgetAdjustModal } from '@/components/payments/BudgetAdjustModal';
import { BudgetFormModal } from '@/components/payments/BudgetFormModal';
import {
  BUDGET_ENFORCEMENT_META,
  BUDGET_HEALTH_META,
  BUDGET_PERIOD_META,
  BUDGET_STATUS_META,
  BUDGET_TX_TYPE_META,
  type BudgetDetailDto,
} from '@/components/payments/budget-ui.helpers';
import type { PaymentCategoryDto } from '@/components/payments/payment-ui.helpers';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

interface RefOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  branchId?: number;
}

type DetailTab = 'ledger' | 'proposals' | 'payments';

export default function BudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const { locale, tr, ln } = useI18n();
  const budgetId = Number(params?.id);

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [detail, setDetail] = useState<BudgetDetailDto | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('ledger');
  const [reloadTick, setReloadTick] = useState(0);

  const [branches, setBranches] = useState<RefOption[]>([]);
  const [departments, setDepartments] = useState<RefOption[]>([]);
  const [categories, setCategories] = useState<PaymentCategoryDto[]>([]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [confirmStatusTarget, setConfirmStatusTarget] = useState<
    'ACTIVE' | 'FROZEN' | 'CLOSED' | null
  >(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!Number.isInteger(budgetId) || budgetId <= 0) return;
    const controller = new AbortController();

    Promise.all([
      fetch(`/api/v1/payments/budgets/${budgetId}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/core/branches?limit=100&isActive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/hrm/departments?limit=200', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/payments/categories?includeInactive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([dRes, bRes, depRes, cRes]) => {
        if (controller.signal.aborted) return;
        const [dJson, bJson, depJson, cJson] = await Promise.all([
          dRes.json().catch(() => null),
          bRes.json().catch(() => null),
          depRes.json().catch(() => null),
          cRes.json().catch(() => null),
        ]);
        if (!dRes.ok || !dJson?.success || !dJson.data) {
          setErrorMessage(
            dJson?.error?.message ??
              tr('Không thể tải chi tiết quỹ ngân sách.', 'Unable to load budget fund details.'),
          );
          setViewState('error');
          return;
        }
        setDetail(dJson.data as BudgetDetailDto);
        if (bRes.ok && bJson?.success) setBranches((bJson.data ?? []) as RefOption[]);
        if (depRes.ok && depJson?.success) setDepartments((depJson.data ?? []) as RefOption[]);
        if (cRes.ok && cJson?.success) setCategories((cJson.data ?? []) as PaymentCategoryDto[]);
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
  }, [budgetId, reloadTick, tr]);

  async function handleConfirmStatusChange() {
    if (!detail || !confirmStatusTarget || isUpdatingStatus) return;
    setActionError('');
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/v1/payments/budgets/${detail.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: confirmStatusTarget }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ??
            tr('Không thể cập nhật trạng thái quỹ.', 'Unable to update budget status.'),
        );
        setConfirmStatusTarget(null);
        return;
      }
      setConfirmStatusTarget(null);
      setReloadTick((t) => t + 1);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  if (viewState === 'loading') {
    return (
      <div className="w-full space-y-4">
        <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (viewState === 'error' || !detail) {
    return (
      <div className="w-full rounded-2xl border border-rose-200 bg-white p-10 text-center">
        <p className="text-sm font-bold text-rose-700">{errorMessage}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/services/payments?tab=budgets"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {tr('Quay lại Quản lý Ngân sách', 'Back to Budget Management')}
          </Link>
          <button
            type="button"
            onClick={() => {
              setViewState('loading');
              setReloadTick((t) => t + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconRefresh size={14} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      </div>
    );
  }

  const stMeta = BUDGET_STATUS_META[detail.status];
  const enfMeta = BUDGET_ENFORCEMENT_META[detail.enforcementMode];
  const hlMeta = BUDGET_HEALTH_META[detail.health];
  const periodMeta = BUDGET_PERIOD_META[detail.periodType];
  const spentW = Math.min(100, Math.max(0, detail.spentPercent));
  const reservedW = Math.min(100 - spentW, Math.max(0, detail.reservedPercent));

  return (
    <div className="w-full space-y-5">
      {/* Top Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#1E3A5F] p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Link
              href="/services/payments?tab=budgets"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <IconArrowLeft size={15} />
              <span>{tr('Quay lại Quản lý Ngân sách', 'Back to Budget Management')}</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-white/15 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-200">
                {detail.code}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stMeta.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${stMeta.dotCls}`} />
                {locale === 'en' ? stMeta.en : stMeta.vi}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${enfMeta.cls}`}>
                <IconShieldLock size={12} />
                {locale === 'en' ? enfMeta.en : enfMeta.vi}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${hlMeta.cls}`}>
                {locale === 'en' ? hlMeta.en : hlMeta.vi} ({detail.utilizationPercent}%)
              </span>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {ln(detail.name, detail.nameEn)}
            </h1>
            {detail.description && (
              <p className="max-w-3xl text-xs leading-relaxed text-slate-300">
                {detail.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {detail.actions.canAdjust && (
              <button
                type="button"
                onClick={() => setIsAdjustOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                <IconAdjustments size={15} />
                <span>{tr('Bổ sung / Cắt giảm', 'Top Up / Reduce')}</span>
              </button>
            )}
            {detail.actions.canEdit && (
              <button
                type="button"
                onClick={() => {
                  setEditKey((k) => k + 1);
                  setIsEditOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"
              >
                <IconEdit size={15} />
                <span>{tr('Chỉnh sửa', 'Edit')}</span>
              </button>
            )}
            {detail.actions.canFreeze && (
              <button
                type="button"
                onClick={() => setConfirmStatusTarget('FROZEN')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-500/20 px-3.5 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
              >
                <IconSnowflake size={15} />
                <span>{tr('Tạm khóa', 'Freeze')}</span>
              </button>
            )}
            {detail.actions.canActivate && (
              <button
                type="button"
                onClick={() => setConfirmStatusTarget('ACTIVE')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-400"
              >
                <IconCheck size={15} />
                <span>{tr('Kích hoạt lại', 'Activate')}</span>
              </button>
            )}
            {detail.actions.canClose && (
              <button
                type="button"
                onClick={() => setConfirmStatusTarget('CLOSED')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/40 bg-rose-500/20 px-3.5 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/30"
              >
                <IconLock size={15} />
                <span>{tr('Đóng sổ', 'Close Fund')}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {actionError}
        </div>
      )}

      {/* 4 Financial Cards + Utilization Bar */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{tr('Hạn mức ngân sách cấp', 'Allocated Budget')}</span>
              <IconCoins size={16} className="text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">
              {formatVND(detail.allocatedAmount)}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
              <span>{tr('Đang giữ chỗ (Cam kết)', 'Reserved / Encumbered')}</span>
              <IconLock size={16} className="text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums text-amber-700">
              {formatVND(detail.reservedAmount)}
            </div>
            <div className="mt-1 text-[11px] text-amber-700/80">{detail.reservedPercent}%</div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
              <span>{tr('Đã thực chi (Giải ngân)', 'Actual Spent')}</span>
              <IconCheck size={16} className="text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-700">
              {formatVND(detail.spentAmount)}
            </div>
            <div className="mt-1 text-[11px] text-emerald-700/80">{detail.spentPercent}%</div>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-teal-800">
              <span>{tr('Khả dụng còn lại', 'Remaining Available')}</span>
              <IconWallet size={16} className="text-teal-600" />
            </div>
            <div
              className={`mt-2 text-2xl font-extrabold tabular-nums ${
                detail.availableAmount < 0 ? 'text-rose-700' : 'text-teal-800'
              }`}
            >
              {formatVND(detail.availableAmount)}
            </div>
            <div className="mt-1 text-[11px] text-teal-700/80">
              {tr(
                `Ngưỡng cảnh báo: ${detail.warningThresholdPercent}%`,
                `Warning threshold: ${detail.warningThresholdPercent}%`,
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="flex h-full w-full">
              <div className="h-full bg-emerald-500" style={{ width: `${spentW}%` }} />
              <div className="h-full bg-amber-400" style={{ width: `${reservedW}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong>{tr('Kỳ', 'Period')}:</strong> {detail.periodLabel} (
                {locale === 'en' ? periodMeta.en : periodMeta.vi})
              </span>
              <span>
                <strong>{tr('Hiệu lực', 'Effective')}:</strong> {formatDateVN(detail.startDate)} –{' '}
                {formatDateVN(detail.endDate)}
              </span>
              <span>
                <strong>{tr('Phạm vi', 'Scope')}:</strong>{' '}
                {[
                  detail.branchName ? ln(detail.branchName, detail.branchNameEn) : null,
                  detail.departmentName ? ln(detail.departmentName, detail.departmentNameEn) : null,
                  detail.categoryName ? ln(detail.categoryName, detail.categoryNameEn) : null,
                ]
                  .filter(Boolean)
                  .join(' / ') || tr('Toàn công ty', 'Company-wide')}
              </span>
              {detail.ownerName && (
                <span>
                  <strong>{tr('Chủ quỹ', 'Owner')}:</strong> {detail.ownerName}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tabs: Ledger | Linked Proposals | Linked Payments */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 pb-3 text-xs font-bold transition ${
              activeTab === 'ledger'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <IconHistory size={15} />
            <span>
              {tr('Sổ cái Biến động', 'Budget Ledger')} ({detail.transactions.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 pb-3 text-xs font-bold transition ${
              activeTab === 'proposals'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <IconFileDescription size={15} />
            <span>
              {tr('Đề xuất dùng quỹ', 'Linked Proposals')} ({detail.linkedProposals.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 pb-3 text-xs font-bold transition ${
              activeTab === 'payments'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <IconCreditCard size={15} />
            <span>
              {tr('Thanh toán dùng quỹ', 'Linked Payments')} ({detail.linkedPayments.length})
            </span>
          </button>
        </div>

        <div className="overflow-x-auto p-5">
          {activeTab === 'ledger' && (
            <table className="w-full min-w-[960px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2.5">{tr('Thời gian', 'Timestamp')}</th>
                  <th className="px-3 py-2.5">{tr('Loại bút toán', 'Transaction')}</th>
                  <th className="px-3 py-2.5">{tr('Chứng từ nguồn', 'Source Ref')}</th>
                  <th className="px-3 py-2.5 text-right">{tr('Δ Hạn mức', 'Δ Alloc')}</th>
                  <th className="px-3 py-2.5 text-right">{tr('Δ Giữ chỗ', 'Δ Reserve')}</th>
                  <th className="px-3 py-2.5 text-right">{tr('Δ Thực chi', 'Δ Spent')}</th>
                  <th className="px-3 py-2.5 text-right">{tr('Khả dụng sau GD', 'Available After')}</th>
                  <th className="px-3 py-2.5">{tr('Diễn giải & Người thao tác', 'Note & Actor')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.transactions.map((tx) => {
                  const txMeta = BUDGET_TX_TYPE_META[tx.txType];
                  const sourceHref =
                    tx.sourceType === 'PROPOSAL' && tx.sourceId
                      ? `/services/proposals/${tx.sourceId}`
                      : (tx.sourceType === 'PAYMENT' || tx.sourceType === 'DISBURSEMENT') &&
                          tx.sourceId
                        ? `/services/payments/${tx.sourceId}`
                        : tx.relatedBudgetId
                          ? `/services/payments/budgets/${tx.relatedBudgetId}`
                          : null;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                        {formatDateTimeVN(tx.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${txMeta.cls}`}>
                          {locale === 'en' ? txMeta.en : txMeta.vi}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono font-bold">
                        {sourceHref && tx.sourceCode ? (
                          <Link href={sourceHref} className="text-blue-700 hover:underline">
                            {tx.sourceCode}
                          </Link>
                        ) : (
                          <span className="text-slate-600">{tx.sourceCode ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {tx.allocatedDelta !== 0 ? (
                          <span className={tx.allocatedDelta > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {tx.allocatedDelta > 0 ? '+' : ''}
                            {formatVND(tx.allocatedDelta)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {tx.reservedDelta !== 0 ? (
                          <span className={tx.reservedDelta > 0 ? 'text-amber-700' : 'text-teal-700'}>
                            {tx.reservedDelta > 0 ? '+' : ''}
                            {formatVND(tx.reservedDelta)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {tx.spentDelta !== 0 ? (
                          <span className={tx.spentDelta > 0 ? 'text-indigo-700' : 'text-emerald-700'}>
                            {tx.spentDelta > 0 ? '+' : ''}
                            {formatVND(tx.spentDelta)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">
                        {formatVND(tx.balanceAvailableAfter)}
                      </td>
                      <td className="max-w-xs px-3 py-2.5 text-slate-600">
                        <div>{tx.note ?? '—'}</div>
                        {tx.actorName && (
                          <div className="text-[10px] text-slate-400">{tx.actorName}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'proposals' &&
            (detail.linkedProposals.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                {tr('Chưa có Đề xuất Nội bộ nào gắn quỹ ngân sách này.', 'No linked internal proposals yet.')}
              </div>
            ) : (
              <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">{tr('Mã đề xuất', 'Code')}</th>
                    <th className="px-3 py-2.5">{tr('Tiêu đề', 'Title')}</th>
                    <th className="px-3 py-2.5">{tr('Người lập', 'Requester')}</th>
                    <th className="px-3 py-2.5">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-3 py-2.5 text-right">{tr('Dự toán', 'Estimated')}</th>
                    <th className="px-3 py-2.5 text-right">{tr('Đang giữ chỗ', 'Held Reserve')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.linkedProposals.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 font-mono font-bold">
                        <Link href={`/services/proposals/${p.id}`} className="text-blue-700 hover:underline">
                          {p.proposalCode}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{p.title}</td>
                      <td className="px-3 py-2.5 text-slate-600">{p.requesterName}</td>
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {formatVND(p.approvedBudget ?? p.estimatedBudget)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-amber-700">
                        {formatVND(p.budgetReservedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {activeTab === 'payments' &&
            (detail.linkedPayments.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                {tr('Chưa có Phiếu Thanh toán nào gắn quỹ ngân sách này.', 'No linked payment requests yet.')}
              </div>
            ) : (
              <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">{tr('Mã phiếu', 'Code')}</th>
                    <th className="px-3 py-2.5">{tr('Tiêu đề', 'Title')}</th>
                    <th className="px-3 py-2.5">{tr('Đề xuất gốc', 'Proposal')}</th>
                    <th className="px-3 py-2.5">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-3 py-2.5 text-right">{tr('Đang giữ chỗ', 'Reserved')}</th>
                    <th className="px-3 py-2.5 text-right">{tr('Đã thực chi', 'Spent')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.linkedPayments.map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 font-mono font-bold">
                        <Link href={`/services/payments/${pr.id}`} className="text-blue-700 hover:underline">
                          {pr.code}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{pr.title}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-violet-700">
                        {pr.proposalCode ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {pr.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-amber-700">
                        {formatVND(pr.budgetReservedAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700">
                        {formatVND(pr.budgetSpentAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </section>

      <BudgetFormModal
        key={editKey}
        isOpen={isEditOpen}
        editingBudget={detail}
        branches={branches}
        departments={departments}
        categories={categories}
        projects={[]}
        onClose={() => setIsEditOpen(false)}
        onSaved={() => {
          setIsEditOpen(false);
          setReloadTick((t) => t + 1);
        }}
      />

      <BudgetAdjustModal
        budget={isAdjustOpen ? detail : null}
        onClose={() => setIsAdjustOpen(false)}
        onAdjusted={() => {
          setIsAdjustOpen(false);
          setReloadTick((t) => t + 1);
        }}
      />

      <ConfirmModal
        isOpen={Boolean(confirmStatusTarget)}
        title={
          confirmStatusTarget === 'CLOSED'
            ? tr('Xác nhận Đóng sổ Quỹ Ngân sách', 'Confirm Close Budget Fund')
            : confirmStatusTarget === 'FROZEN'
              ? tr('Xác nhận Tạm khóa Quỹ Ngân sách', 'Confirm Freeze Budget Fund')
              : tr('Kích hoạt lại Quỹ Ngân sách', 'Reactivate Budget Fund')
        }
        description={
          confirmStatusTarget === 'CLOSED'
            ? tr(
                'Sau khi đóng sổ, quỹ không thể mở lại và không nhận chi tiêu mới. Yêu cầu không còn phiếu Chờ phê duyệt.',
                'Once closed, this fund cannot be reopened or accept new spend. Requires no pending approvals.',
              )
            : confirmStatusTarget === 'FROZEN'
              ? tr(
                  'Quỹ tạm khóa sẽ chặn các Đề xuất & Thanh toán mới, nhưng các phiếu đã duyệt vẫn có thể giải ngân.',
                  'Frozen funds block new reservations while already-approved payments can still disburse.',
                )
              : tr(
                  'Mở lại hiệu lực để Đề xuất và Thanh toán tiếp tục sử dụng quỹ ngân sách này.',
                  'Reactivate so Proposals and Payments can resume using this fund.',
                )
        }
        confirmLabel={tr('Xác nhận', 'Confirm')}
        isProcessing={isUpdatingStatus}
        onCancel={() => setConfirmStatusTarget(null)}
        onConfirm={() => void handleConfirmStatusChange()}
      />
    </div>
  );
}
