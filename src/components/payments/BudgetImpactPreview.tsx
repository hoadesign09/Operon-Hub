'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconShieldLock,
} from '@tabler/icons-react';
import {
  computeBudgetSnapshot,
  computeProposalTransferReserve,
  evaluateBudgetImpact,
} from '@/lib/portable/budget-calculator';
import { formatVND } from '@/lib/portable/currency-utils';
import { useI18n } from '@/shared/i18n/I18nContext';
import { BUDGET_ENFORCEMENT_META, type BudgetOptionDto } from './budget-ui.helpers';

interface BudgetImpactPreviewProps {
  budget: BudgetOptionDto | null;
  requestedAmount: number;
  /** Optional reserve already held by a linked Proposal on this same budget (prevents double-counting). */
  proposalHeldReserve?: number;
  /** Optional positive refund amount returning to the budget (e.g., Advance Settlement refund). */
  refundAmount?: number;
  inheritedLabel?: string | null;
}

export function BudgetImpactPreview({
  budget,
  requestedAmount,
  proposalHeldReserve = 0,
  refundAmount = 0,
  inheritedLabel = null,
}: BudgetImpactPreviewProps) {
  const { locale, tr, ln } = useI18n();

  if (!budget) {
    return null;
  }

  const snapshot = computeBudgetSnapshot({
    allocatedAmount: budget.allocatedAmount,
    reservedAmount: budget.reservedAmount,
    spentAmount: budget.spentAmount,
    warningThresholdPercent: budget.warningThresholdPercent,
  });

  const split = computeProposalTransferReserve(requestedAmount, proposalHeldReserve);
  const netDelta = refundAmount > 0 ? 0 : split.extraReserveNeeded;
  const impact = evaluateBudgetImpact(snapshot, netDelta, budget.enforcementMode);
  const projectedAfterRefund =
    refundAmount > 0 ? snapshot.availableAmount + refundAmount : impact.projectedAvailable;

  const enfMeta = BUDGET_ENFORCEMENT_META[budget.enforcementMode];
  const spentBar = Math.min(100, Math.max(0, snapshot.spentPercent));
  const reservedBar = Math.min(100 - spentBar, Math.max(0, snapshot.reservedPercent));
  const newDeltaPct =
    snapshot.allocatedAmount > 0
      ? Math.min(100 - spentBar - reservedBar, (netDelta / snapshot.allocatedAmount) * 100)
      : 0;

  const isHardBlocked = !impact.allowed;
  const isWarnState = impact.allowed && (impact.isOverBudget || impact.projectedHealth === 'WARNING');

  const containerCls = isHardBlocked
    ? 'border-rose-300 bg-rose-50/70'
    : isWarnState
      ? 'border-amber-300 bg-amber-50/60'
      : 'border-emerald-200 bg-emerald-50/40';

  return (
    <div className={`space-y-2.5 rounded-xl border p-3.5 text-xs ${containerCls}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
            {budget.code}
          </span>
          <span className="font-bold text-slate-900">{ln(budget.name, budget.nameEn)}</span>
          <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
            {budget.periodLabel}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${enfMeta.cls}`}>
          <IconShieldLock size={12} />
          {locale === 'en' ? enfMeta.en : enfMeta.vi}
        </span>
      </div>

      {inheritedLabel && (
        <div className="flex items-start gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 py-1.5 text-[11px] font-medium text-blue-800">
          <IconInfoCircle size={14} className="mt-0.5 shrink-0" />
          <span>{inheritedLabel}</span>
        </div>
      )}

      {/* Dual-color stacked bar */}
      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
          <div className="flex h-full w-full">
            <div className="h-full bg-emerald-600" style={{ width: `${spentBar}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${reservedBar}%` }} />
            {newDeltaPct > 0 && (
              <div
                className={`h-full ${impact.isOverBudget ? 'bg-rose-500' : 'bg-blue-500'}`}
                style={{ width: `${newDeltaPct}%` }}
              />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <div>
            <span className="text-slate-500">{tr('Hạn mức cấp', 'Allocated')}:</span>
            <div className="font-bold tabular-nums text-slate-800">
              {formatVND(snapshot.allocatedAmount)}
            </div>
          </div>
          <div>
            <span className="text-slate-500">{tr('Khả dụng hiện tại', 'Available Now')}:</span>
            <div className="font-bold tabular-nums text-emerald-700">
              {formatVND(snapshot.availableAmount)}
            </div>
          </div>
          <div>
            <span className="text-slate-500">
              {refundAmount > 0
                ? tr('Hoàn về quỹ', 'Refund to Fund')
                : tr('Giữ chỗ mới', 'New Hold')}
              :
            </span>
            <div
              className={`font-bold tabular-nums ${
                refundAmount > 0 ? 'text-emerald-700' : 'text-blue-700'
              }`}
            >
              {refundAmount > 0 ? `+${formatVND(refundAmount)}` : formatVND(netDelta)}
            </div>
          </div>
          <div>
            <span className="text-slate-500">{tr('Dự kiến sau phiếu', 'Projected Left')}:</span>
            <div
              className={`font-extrabold tabular-nums ${
                projectedAfterRefund < 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {formatVND(projectedAfterRefund)} ({impact.projectedUtilizationPercent}%)
            </div>
          </div>
        </div>
      </div>

      {split.fromProposalReserve > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-800">
          <IconCheck size={14} className="shrink-0 text-teal-600" />
          <span>
            {tr(
              `Không trừ trùng: kế thừa ${formatVND(split.fromProposalReserve)} từ phần Đề xuất đã giữ chỗ${split.extraReserveNeeded > 0 ? ` + giữ thêm ${formatVND(split.extraReserveNeeded)}` : ''}.`,
              `Zero double-counting: inherits ${formatVND(split.fromProposalReserve)} from Proposal reserve${split.extraReserveNeeded > 0 ? ` + ${formatVND(split.extraReserveNeeded)} extra hold` : ''}.`,
            )}
          </span>
        </div>
      )}

      {isHardBlocked && (
        <div className="flex items-start gap-1.5 rounded-lg bg-rose-100/90 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800">
          <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {tr(
              `Vượt ngân sách ${formatVND(impact.shortfallAmount)}! Quỹ áp dụng Chặn cứng nên sẽ không thể gửi phê duyệt cho tới khi giảm giá trị hoặc bổ sung ngân sách.`,
              `Exceeds budget by ${formatVND(impact.shortfallAmount)}! Hard Block is enabled — submission will be blocked until reduced or topped up.`,
            )}
          </span>
        </div>
      )}

      {!isHardBlocked && impact.isOverBudget && (
        <div className="flex items-start gap-1.5 rounded-lg bg-amber-100/90 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900">
          <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {tr(
              `Cảnh báo mềm: vượt ngân sách ${formatVND(impact.shortfallAmount)}. Phiếu vẫn có thể gửi duyệt nhưng sẽ gắn cờ cảnh báo tới Chủ quỹ & Cấp duyệt.`,
              `Soft warning: exceeds budget by ${formatVND(impact.shortfallAmount)}. Submission is allowed with an overrun flag sent to the fund owner & approvers.`,
            )}
          </span>
        </div>
      )}
    </div>
  );
}
