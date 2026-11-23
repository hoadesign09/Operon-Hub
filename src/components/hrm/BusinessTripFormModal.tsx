'use client';

import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { IconAlertCircle, IconBriefcase, IconLoader2, IconSend, IconX } from '@tabler/icons-react';
import { formatVND } from '@/lib/portable/currency-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface EditableBusinessTripRequest {
  id: number;
  destination: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  purpose: string;
}

interface BusinessTripFormModalProps {
  editingRequest?: EditableBusinessTripRequest | null;
  onClose: () => void;
  onSaved: () => void;
}

export function BusinessTripFormModal({
  editingRequest = null,
  onClose,
  onSaved,
}: BusinessTripFormModalProps) {
  const { tr } = useI18n();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [destination, setDestination] = useState(editingRequest?.destination ?? '');
  const [startDate, setStartDate] = useState(editingRequest?.startDate ?? todayIso);
  const [endDate, setEndDate] = useState(editingRequest?.endDate ?? todayIso);
  const [estimatedCost, setEstimatedCost] = useState(
    String(editingRequest?.estimatedCost ?? 0),
  );
  const [purpose, setPurpose] = useState(editingRequest?.purpose ?? '');
  const [submittingMode, setSubmittingMode] = useState<'DRAFT' | 'SUBMIT' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tripPreview = useMemo(() => {
    const s = dayjs(startDate).startOf('day');
    const e = dayjs(endDate).startOf('day');
    if (!s.isValid() || !e.isValid()) {
      return { days: 0, error: tr('Ngày công tác không hợp lệ.', 'Invalid business trip dates.') };
    }
    if (e.isBefore(s, 'day')) {
      return {
        days: 0,
        error: tr(
          'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.',
          'End date cannot be earlier than start date.',
        ),
      };
    }
    return { days: e.diff(s, 'day') + 1, error: null };
  }, [startDate, endDate, tr]);

  const numericCost = Number(estimatedCost);

  async function handleSubmit(submitNow: boolean) {
    if (tripPreview.error) {
      setErrorMsg(tripPreview.error);
      return;
    }
    if (destination.trim().length < 2) {
      setErrorMsg(
        tr('Vui lòng nhập địa điểm công tác.', 'Please enter the business trip destination.'),
      );
      return;
    }
    if (Number.isNaN(numericCost) || numericCost < 0) {
      setErrorMsg(tr('Chi phí dự kiến phải là số >= 0.', 'Estimated cost must be a number >= 0.'));
      return;
    }
    if (purpose.trim().length < 3) {
      setErrorMsg(
        tr(
          'Vui lòng nhập mục đích công tác tối thiểu 3 ký tự.',
          'Please enter the trip purpose (at least 3 characters).',
        ),
      );
      return;
    }

    setErrorMsg(null);
    setSubmittingMode(submitNow ? 'SUBMIT' : 'DRAFT');

    try {
      const endpoint = editingRequest
        ? `/api/v1/hrm/requests/business-trips/${editingRequest.id}`
        : '/api/v1/hrm/requests/business-trips';
      const method = editingRequest ? 'PATCH' : 'POST';
      const payload = editingRequest
        ? {
            destination: destination.trim(),
            startDate,
            endDate,
            estimatedCost: numericCost,
            purpose: purpose.trim(),
          }
        : {
            destination: destination.trim(),
            startDate,
            endDate,
            estimatedCost: numericCost,
            purpose: purpose.trim(),
            submitNow,
          };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        setErrorMsg(
          json.error?.message ??
            tr('Không thể lưu đơn công tác.', 'Unable to save business trip request.'),
        );
        setSubmittingMode(null);
        return;
      }

      if (editingRequest && submitNow) {
        const submitRes = await fetch(
          `/api/v1/hrm/requests/business-trips/${editingRequest.id}/submit`,
          { method: 'POST' },
        );
        const submitJson = (await submitRes.json()) as {
          success: boolean;
          error?: { message?: string };
        };
        if (!submitRes.ok || !submitJson.success) {
          setErrorMsg(
            submitJson.error?.message ??
              tr(
                'Đã lưu nháp nhưng gửi duyệt thất bại.',
                'Draft saved, but submitting for approval failed.',
              ),
          );
          setSubmittingMode(null);
          return;
        }
      }

      onSaved();
    } catch {
      setErrorMsg(
        tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Server connection error. Please try again.'),
      );
      setSubmittingMode(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <IconBriefcase size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editingRequest
                  ? tr('Chỉnh sửa đơn công tác', 'Edit Business Trip Request')
                  : tr('Tạo đơn đăng ký công tác', 'Create Business Trip Request')}
              </h2>
              <p className="text-xs text-slate-500">
                {tr(
                  'Khai báo lịch trình, địa điểm và dự trù công tác phí',
                  'Declare schedule, destination, and estimated travel expenses',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submittingMode !== null}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              <IconAlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {tr('Địa điểm công tác', 'Destination')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={tr(
                'Ví dụ: Chi nhánh Đà Nẵng / Khách hàng ABC tại TP.HCM',
                'e.g. Da Nang Branch / Client ABC in HCMC',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {tr('Từ ngày', 'Start Date')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {tr('Đến ngày', 'End Date')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {tr('Chi phí dự kiến (VNĐ)', 'Estimated Cost (VND)')}
            </label>
            <input
              type="number"
              min="0"
              step="100000"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              {tr('Hiển thị:', 'Preview:')}{' '}
              <strong className="text-slate-800">{formatVND(numericCost || 0)}</strong>
            </p>
          </div>

          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              tripPreview.error
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-indigo-200 bg-indigo-50 text-indigo-800'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span>{tr('Tổng thời gian công tác:', 'Total trip duration:')}</span>
              <span>{tr(`${tripPreview.days} ngày`, `${tripPreview.days} days`)}</span>
            </div>
            {tripPreview.error && <p className="mt-1 text-xs text-rose-700">{tripPreview.error}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {tr('Mục đích & Lịch trình công tác', 'Trip Purpose & Itinerary')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={tr(
                'Mô tả mục tiêu chuyến công tác, khách hàng/đối tác làm việc...',
                'Describe trip objectives, clients/partners to meet...',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submittingMode !== null}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {tr('Đóng', 'Close')}
          </button>
          <button
            type="button"
            disabled={submittingMode !== null}
            onClick={() => void handleSubmit(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            {submittingMode === 'DRAFT' && <IconLoader2 size={16} className="animate-spin" />}
            <span>{tr('Lưu nháp', 'Save Draft')}</span>
          </button>
          <button
            type="button"
            disabled={submittingMode !== null}
            onClick={() => void handleSubmit(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submittingMode === 'SUBMIT' ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : (
              <IconSend size={16} />
            )}
            <span>{tr('Gửi duyệt ngay', 'Submit Now')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
