'use client';

import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { IconAlertCircle, IconClockPlus, IconLoader2, IconSend, IconX } from '@tabler/icons-react';

export interface EditableOvertimeRequest {
  id: number;
  workDate: string;
  startTime: string;
  endTime: string;
  isHoliday: boolean;
  reason: string;
}

interface OvertimeRequestFormModalProps {
  editingRequest?: EditableOvertimeRequest | null;
  onClose: () => void;
  onSaved: () => void;
}

function previewOvertime(workDate: string, startTime: string, endTime: string, isHoliday: boolean) {
  const rateLabel = (() => {
    if (isHoliday) {
      return { code: 'HOLIDAY_300', label: 'Ngày lễ (300%)', color: 'text-rose-700 bg-rose-50' };
    }
    const day = dayjs(workDate).day();
    if (day === 0 || day === 6) {
      return { code: 'WEEKEND_200', label: 'Cuối tuần (200%)', color: 'text-amber-700 bg-amber-50' };
    }
    return { code: 'WEEKDAY_150', label: 'Ngày thường (150%)', color: 'text-blue-700 bg-blue-50' };
  })();

  const parseMin = (t: string): number | null => {
    const m = /^(\d{2}):(\d{2})$/.exec(t.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h === 24 && min === 0) return 1440;
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  };

  const s = parseMin(startTime);
  const e = parseMin(endTime);
  if (s === null || e === null) {
    return { hours: 0, rate: rateLabel, error: 'Định dạng giờ không hợp lệ (HH:mm).' };
  }
  if (e <= s) {
    return { hours: 0, rate: rateLabel, error: 'Giờ kết thúc phải lớn hơn giờ bắt đầu.' };
  }

  const hours = Math.round(((e - s) / 60 + Number.EPSILON) * 100) / 100;
  if (hours < 0.5 || hours > 12) {
    return {
      hours,
      rate: rateLabel,
      error: 'Thời lượng tăng ca mỗi đơn phải từ 0.5 giờ đến tối đa 12 giờ.',
    };
  }

  return { hours, rate: rateLabel, error: null };
}

export function OvertimeRequestFormModal({
  editingRequest = null,
  onClose,
  onSaved,
}: OvertimeRequestFormModalProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [workDate, setWorkDate] = useState(editingRequest?.workDate ?? todayIso);
  const [startTime, setStartTime] = useState(editingRequest?.startTime ?? '18:00');
  const [endTime, setEndTime] = useState(editingRequest?.endTime ?? '20:00');
  const [isHoliday, setIsHoliday] = useState(editingRequest?.isHoliday ?? false);
  const [reason, setReason] = useState(editingRequest?.reason ?? '');
  const [submittingMode, setSubmittingMode] = useState<'DRAFT' | 'SUBMIT' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const preview = useMemo(
    () => previewOvertime(workDate, startTime, endTime, isHoliday),
    [workDate, startTime, endTime, isHoliday],
  );

  async function handleSubmit(submitNow: boolean) {
    if (preview.error) {
      setErrorMsg(preview.error);
      return;
    }
    if (reason.trim().length < 3) {
      setErrorMsg('Vui lòng nhập lý do tăng ca tối thiểu 3 ký tự.');
      return;
    }

    setErrorMsg(null);
    setSubmittingMode(submitNow ? 'SUBMIT' : 'DRAFT');

    try {
      const endpoint = editingRequest
        ? `/api/v1/hrm/requests/overtimes/${editingRequest.id}`
        : '/api/v1/hrm/requests/overtimes';
      const method = editingRequest ? 'PATCH' : 'POST';
      const payload = editingRequest
        ? { workDate, startTime, endTime, isHoliday, reason: reason.trim() }
        : { workDate, startTime, endTime, isHoliday, reason: reason.trim(), submitNow };

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
        setErrorMsg(json.error?.message ?? 'Không thể lưu đơn tăng ca.');
        setSubmittingMode(null);
        return;
      }

      if (editingRequest && submitNow) {
        const submitRes = await fetch(
          `/api/v1/hrm/requests/overtimes/${editingRequest.id}/submit`,
          { method: 'POST' },
        );
        const submitJson = (await submitRes.json()) as {
          success: boolean;
          error?: { message?: string };
        };
        if (!submitRes.ok || !submitJson.success) {
          setErrorMsg(submitJson.error?.message ?? 'Đã lưu nháp nhưng gửi duyệt thất bại.');
          setSubmittingMode(null);
          return;
        }
      }

      onSaved();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      setSubmittingMode(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <IconClockPlus size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editingRequest ? 'Chỉnh sửa đơn tăng ca (OT)' : 'Tạo đơn làm thêm giờ (OT)'}
              </h2>
              <p className="text-xs text-slate-500">
                Tự động phân loại hệ số 150% / 200% / 300% theo ngày làm việc
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submittingMode !== null}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Ngày tăng ca <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-end">
              <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isHoliday}
                  onChange={(e) => setIsHoliday(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>Làm việc ngày Lễ (300%)</span>
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Giờ bắt đầu <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Giờ kết thúc <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              preview.error
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Tổng giờ OT dự kiến: {preview.hours} giờ</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${preview.rate.color}`}
              >
                {preview.rate.label}
              </span>
            </div>
            {preview.error && <p className="mt-1 text-xs text-rose-700">{preview.error}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Nội dung công việc / Lý do tăng ca <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mô tả hạng mục công việc cần xử lý ngoài giờ..."
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
            Đóng
          </button>
          <button
            type="button"
            disabled={submittingMode !== null}
            onClick={() => void handleSubmit(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            {submittingMode === 'DRAFT' && <IconLoader2 size={16} className="animate-spin" />}
            <span>Lưu nháp</span>
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
            <span>Gửi duyệt ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
}
