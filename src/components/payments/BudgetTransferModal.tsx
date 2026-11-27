'use client';

import { useState, type FormEvent } from 'react';
import { IconArrowsExchange, IconX } from '@tabler/icons-react';
import { formatVND } from '@/lib/portable/currency-utils';
import { useI18n } from '@/shared/i18n/I18nContext';
import type { BudgetListItemDto } from './budget-ui.helpers';

interface BudgetTransferModalProps {
  isOpen: boolean;
  budgets: BudgetListItemDto[];
  presetFromBudgetId?: number | null;
  onClose: () => void;
  onTransferred: () => void;
}

export function BudgetTransferModal({
  isOpen,
  budgets,
  presetFromBudgetId,
  onClose,
  onTransferred,
}: BudgetTransferModalProps) {
  const { tr, ln } = useI18n();
  const activeBudgets = budgets.filter((b) => b.status === 'ACTIVE');

  const [fromId, setFromId] = useState<string>(
    presetFromBudgetId ? String(presetFromBudgetId) : String(activeBudgets[0]?.id ?? ''),
  );
  const [toId, setToId] = useState<string>(
    String(activeBudgets.find((b) => String(b.id) !== String(presetFromBudgetId ?? activeBudgets[0]?.id))?.id ?? ''),
  );
  const [amount, setAmount] = useState('15000000');
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const fromBudget = activeBudgets.find((b) => String(b.id) === fromId) ?? null;
  const toBudget = activeBudgets.find((b) => String(b.id) === toId) ?? null;
  const numericAmount = Math.max(0, Number(amount) || 0);
  const exceedsSource = Boolean(fromBudget && numericAmount > fromBudget.availableAmount);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/payments/budgets/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromBudgetId: Number(fromId),
          toBudgetId: Number(toId),
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
            tr('Không thể điều chuyển ngân sách.', 'Unable to transfer budget.'),
        );
        return;
      }
      onTransferred();
    } catch {
      setErrorMessage(tr('Lỗi kết nối máy chủ.', 'Network error.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F172A] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
              <IconArrowsExchange size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold">
                {tr('Điều chuyển Ngân sách giữa 2 Quỹ', 'Inter-Budget Fund Transfer')}
              </h2>
              <p className="text-[11px] text-slate-300">
                {tr(
                  'Hạch toán nguyên tử (atomic) và ghi nhận cặp bút toán TRANSFER_OUT / TRANSFER_IN.',
                  'Atomic transfer recording paired TRANSFER_OUT and TRANSFER_IN ledger entries.',
                )}
              </p>
            </div>
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

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Quỹ nguồn (trừ hạn mức) *', 'Source Fund (Debit) *')}
              </label>
              <select
                required
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('-- Chọn quỹ nguồn --', '-- Select source --')}</option>
                {activeBudgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {ln(b.name, b.nameEn)} ({formatVND(b.availableAmount)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Quỹ đích (nhận hạn mức) *', 'Target Fund (Credit) *')}
              </label>
              <select
                required
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('-- Chọn quỹ đích --', '-- Select target --')}</option>
                {activeBudgets
                  .filter((b) => String(b.id) !== fromId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {ln(b.name, b.nameEn)} ({formatVND(b.availableAmount)})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Số tiền điều chuyển (VNĐ) *', 'Transfer Amount (VND) *')}
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

          {fromBudget && toBudget && (
            <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:grid-cols-2">
              <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                <div className="font-mono text-[11px] font-bold text-slate-700">
                  {fromBudget.code}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {tr('Khả dụng sau chuyển', 'Available After')}:{' '}
                  <strong className={exceedsSource ? 'text-rose-700' : 'text-slate-900'}>
                    {formatVND(fromBudget.availableAmount - numericAmount)}
                  </strong>
                </div>
              </div>
              <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                <div className="font-mono text-[11px] font-bold text-emerald-700">
                  {toBudget.code}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {tr('Khả dụng sau nhận', 'Available After')}:{' '}
                  <strong className="text-emerald-700">
                    {formatVND(toBudget.availableAmount + numericAmount)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Lý do điều chuyển *', 'Transfer Reason *')}
            </label>
            <textarea
              required
              minLength={3}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tr(
                'VD: Điều chuyển phần dự phòng sự kiện sang hạ tầng Cloud Q4...',
                'e.g. Reallocate surplus event reserve to Q4 Cloud infrastructure...',
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
              disabled={isSubmitting || exceedsSource || !fromBudget || !toBudget || numericAmount <= 0}
              className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isSubmitting
                ? tr('Đang điều chuyển...', 'Transferring...')
                : tr('Xác nhận Điều chuyển', 'Confirm Transfer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
