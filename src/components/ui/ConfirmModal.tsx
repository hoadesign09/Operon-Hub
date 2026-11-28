'use client';

import { IconAlertTriangle, IconX } from '@tabler/icons-react';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  isProcessing = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t, tr } = useI18n();

  if (!isOpen) {
    return null;
  }

  const resolvedConfirmLabel = confirmLabel ?? tr('Xác nhận', 'Confirm');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');

  const confirmClass =
    variant === 'danger'
      ? 'border border-red-300 bg-red-600 text-white hover:bg-red-700'
      : 'bg-[#1D4E89] text-white hover:bg-[#163D6B]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded border border-[#BFC8D4] bg-white shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[#CFD6DF] bg-[#F8F9FB] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600">
              <IconAlertTriangle size={17} />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-[13px] font-bold text-slate-900">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            aria-label={t('common.close')}
            className="rounded border border-transparent p-1 text-slate-500 hover:border-[#CFD6DF] hover:bg-white hover:text-slate-900 disabled:opacity-50"
          >
            <IconX size={15} />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-xs leading-relaxed text-slate-700">{description}</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#CFD6DF] bg-[#F1F4F8] px-4 py-2.5">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            className="rounded border border-[#BFC8D4] bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onConfirm}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {isProcessing ? tr('Đang xử lý...', 'Processing...') : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
