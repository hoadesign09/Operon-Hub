'use client';

import { useState, type FormEvent } from 'react';
import {
  IconBuildingBank,
  IconCash,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import type { PaymentMethod } from '@/config/database';
import { formatVND } from '@/lib/portable/currency-utils';
import { useI18n } from '@/shared/i18n/I18nContext';
import type { PaymentDetailDto } from './payment-ui.helpers';

interface PaymentDisbursementModalProps {
  isOpen: boolean;
  payment: PaymentDetailDto;
  isRefundMode: boolean;
  onClose: () => void;
  onCompleted: (updated: PaymentDetailDto) => void;
}

export function PaymentDisbursementModal({
  isOpen,
  payment,
  isRefundMode,
  onClose,
  onCompleted,
}: PaymentDisbursementModalProps) {
  const { tr } = useI18n();
  const [disbursementDate, setDisbursementDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState(String(payment.remainingAmount));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(payment.paymentMethod);
  const [bankTransactionRef, setBankTransactionRef] = useState('');
  const [sourceAccount, setSourceAccount] = useState(
    'VCB — 0071000889900 (Operon Hub)',
  );
  const [note, setNote] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setErrorMessage('');
    setIsSaving(true);

    try {
      const res = await fetch(`/api/v1/payments/${payment.id}/disbursements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: isRefundMode ? 'INCOMING_REFUND' : 'OUTGOING',
          disbursementDate,
          amount: Number(amount),
          paymentMethod,
          bankTransactionRef: bankTransactionRef.trim() || null,
          sourceAccount: sourceAccount.trim() || null,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: PaymentDetailDto;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success || !json.data) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể ghi nhận giao dịch giải ngân.', 'Unable to record disbursement.'),
        );
        return;
      }

      onCompleted(json.data);
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Network error. Please try again.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F172A] px-5 py-4 text-white">
          <div>
            <h3 className="text-sm font-bold">
              {isRefundMode
                ? tr('Xác nhận Thu hồi Hoàn quỹ Tạm ứng', 'Confirm Advance Refund Collection')
                : tr('Ghi nhận Giải ngân Thanh toán', 'Record Payment Disbursement')}
            </h3>
            <p className="mt-0.5 text-xs text-slate-300">
              {payment.code} • {tr('Còn lại', 'Remaining')}:{' '}
              <strong className="text-cyan-300">{formatVND(payment.remainingAmount)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {!isRefundMode && payment.paymentMethod === 'BANK_TRANSFER' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-950">
              <div className="font-bold">{payment.beneficiaryName}</div>
              <div className="mt-0.5 text-blue-800">
                {payment.bankName ?? '—'} •{' '}
                <span className="font-mono font-bold">{payment.bankAccountNo ?? '—'}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Ngày giao dịch *', 'Transaction Date *')}
              </label>
              <input
                type="date"
                required
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Số tiền đợt này (VNĐ) *', 'Amount (VND) *')}
              </label>
              <input
                type="number"
                required
                min="1"
                max={payment.remainingAmount}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right font-bold tabular-nums outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Hình thức thực hiện *', 'Method *')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  paymentMethod === 'BANK_TRANSFER'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <IconBuildingBank size={15} />
                <span>{tr('Chuyển khoản', 'Bank Transfer')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  paymentMethod === 'CASH'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <IconCash size={15} />
                <span>{tr('Tiền mặt', 'Cash')}</span>
              </button>
            </div>
          </div>

          {paymentMethod === 'BANK_TRANSFER' && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Mã giao dịch / Số bút toán *', 'Bank Reference No. *')}
                </label>
                <input
                  type="text"
                  required
                  value={bankTransactionRef}
                  onChange={(e) => setBankTransactionRef(e.target.value)}
                  placeholder="FT26330xxxx"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Tài khoản nguồn công ty', 'Company Source Account')}
                </label>
                <input
                  type="text"
                  value={sourceAccount}
                  onChange={(e) => setSourceAccount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Ghi chú kế toán', 'Accounting Note')}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr('VD: Đã chuyển khoản đợt 1 theo lịch chi thứ Năm...', 'e.g. Disbursed batch 1 per Thursday payout run...')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <IconCheck size={15} />
              <span>
                {isSaving
                  ? tr('Đang xác nhận...', 'Recording...')
                  : isRefundMode
                    ? tr('Xác nhận Đã thu hồi quỹ', 'Confirm Refund Received')
                    : tr('Xác nhận Giải ngân', 'Confirm Disbursement')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
