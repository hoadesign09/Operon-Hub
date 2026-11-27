'use client';

import { useState, type FormEvent } from 'react';
import { IconArrowDownRight, IconArrowUpRight, IconX } from '@tabler/icons-react';
import { formatVND } from '@/lib/portable/currency-utils';
import { useI18n } from '@/shared/i18n/I18nContext';
import type { BudgetListItemDto } from './budget-ui.helpers';

interface BudgetAdjustModalProps {
  budget: BudgetListItemDto | null;
  onClose: () => void;
  onAdjusted: () => void;
}

export function BudgetAdjustModal({ budget, onClose, onAdjusted }: BudgetAdjustModalProps) {
  const { tr, ln } = useI18n();
  const [action, setAction] = useState<'TOP_UP' | 'REDUCE'>('TOP_UP');
  const [amount, setAmount] = useState('20000000');
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!budget) return null;

  const numericAmount = Math.max(0, Number(amount) || 0);
  const nextAllocated =
    action === 'TOP_UP'
      ? budget.allocatedAmount + numericAmount
      : budget.allocatedAmount - numericAmount;
  const nextAvailable = nextAllocated - budget.reservedAmount - budget.spentAmount;
  const isInvalidReduce = action === 'REDUCE' && nextAllocated < budget.committedTotal;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!budget || isSubmitting) return;
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/payments/budgets/${budget.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          amount: numericAmount,
          reason: reason.trim(),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể điều chỉnh hạn mức ngân sách.', 'Unable to adjust budget allocation.'),
        );
        return;
      }
      onAdjusted();
    } catch {
      setErrorMessage(tr('Lỗi kết nối máy chủ.', 'Network error.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F172A] px-5 py-4 text-white">
          <div>
            <h2 className="text-sm font-bold">
              {tr('Điều chỉnh Hạn mức Ngân sách', 'Adjust Budget Allocation')}
            </h2>
            <p className="text-[11px] text-slate-300">
              {budget.code} — {ln(budget.name, budget.nameEn)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setAction('TOP_UP')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                action === 'TOP_UP'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <IconArrowUpRight size={16} />
              <span>{tr('Bổ sung hạn mức', 'Top Up Allocation')}</span>
            </button>
            <button
              type="button"
              onClick={() => setAction('REDUCE')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                action === 'REDUCE'
                  ? 'border-orange-600 bg-orange-50 text-orange-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <IconArrowDownRight size={16} />
              <span>{tr('Cắt giảm hạn mức', 'Reduce Allocation')}</span>
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Số tiền điều chỉnh (VNĐ) *', 'Adjustment Amount (VND) *')}
            </label>
            <input
              type="number"
              required
              min={1000}
              step={100000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right font-bold text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">{tr('Hạn mức hiện tại', 'Current Allocation')}</span>
              <span className="font-semibold tabular-nums">{formatVND(budget.allocatedAmount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">{tr('Đã giữ chỗ + Thực chi', 'Reserved + Spent')}</span>
              <span className="font-semibold tabular-nums text-amber-700">
                {formatVND(budget.committedTotal)}
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-800">{tr('Hạn mức sau điều chỉnh', 'New Allocation')}</span>
              <span
                className={`font-extrabold tabular-nums ${
                  isInvalidReduce ? 'text-rose-700' : 'text-blue-700'
                }`}
              >
                {formatVND(nextAllocated)}
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">{tr('Khả dụng dự kiến', 'Projected Available')}</span>
              <span
                className={`font-bold tabular-nums ${
                  nextAvailable < 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {formatVND(nextAvailable)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Lý do / Quyết định điều chỉnh *', 'Reason / Approval Reference *')}
            </label>
            <textarea
              required
              minLength={3}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tr(
                'VD: Bổ sung ngân sách hạ tầng cloud theo tờ trình Ban Giám đốc...',
                'e.g. Top up cloud infrastructure budget per executive approval...',
              )}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInvalidReduce || numericAmount <= 0}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting
                ? tr('Đang ghi sổ...', 'Saving...')
                : tr('Xác nhận Điều chỉnh', 'Confirm Adjustment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
