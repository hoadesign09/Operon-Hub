'use client';

import { useMemo, useState } from 'react';
import { IconAlertCircle, IconCalendarEvent, IconLoader2, IconSend, IconX } from '@tabler/icons-react';
import { countWorkingDays } from '@/lib/portable/date-utils';

export type LeaveSessionOption = 'FULL' | 'AM' | 'PM';

export interface LeaveTypeOption {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
  defaultDaysPerYear: number;
  requiresAttachment: boolean;
  tracksBalance: boolean;
}

export interface LeaveBalanceOption {
  leaveTypeId: number;
  year: number;
  remainingDays: number;
  entitledDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
}

export interface EditableLeaveRequest {
  id: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  startSession: LeaveSessionOption;
  endSession: LeaveSessionOption;
  reason: string;
  attachmentUrl: string | null;
}

interface LeaveRequestFormModalProps {
  leaveTypes: LeaveTypeOption[];
  balances: LeaveBalanceOption[];
  editingRequest?: EditableLeaveRequest | null;
  onClose: () => void;
  onSaved: () => void;
}

function previewLeaveDays(
  startDate: string,
  endDate: string,
  startSession: LeaveSessionOption,
  endSession: LeaveSessionOption,
): { days: number; error: string | null } {
  if (!startDate || !endDate) {
    return { days: 0, error: null };
  }
  if (endDate < startDate) {
    return { days: 0, error: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.' };
  }
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
    return {
      days: 0,
      error: 'Đơn nghỉ phép phải nằm trong cùng 1 năm dương lịch (hãy tách thành 2 đơn riêng).',
    };
  }
  if (startDate === endDate && startSession === 'PM' && endSession === 'AM') {
    return {
      days: 0,
      error: 'Trong cùng ngày, buổi kết thúc (Sáng) không thể trước buổi bắt đầu (Chiều).',
    };
  }

  const baseDays = countWorkingDays(startDate, endDate);
  if (baseDays === 0) {
    return { days: 0, error: 'Khoảng ngày chọn toàn bộ rơi vào Thứ 7 / Chủ nhật.' };
  }

  const isStartWork = countWorkingDays(startDate, startDate) === 1;
  const isEndWork = countWorkingDays(endDate, endDate) === 1;
  let total = baseDays;
  if (isStartWork && startSession === 'PM') {
    total -= 0.5;
  }
  if (isEndWork && endSession === 'AM') {
    total -= 0.5;
  }
  const rounded = Math.round(Math.max(0, total) * 100) / 100;
  return { days: rounded, error: rounded <= 0 ? 'Số ngày nghỉ phải lớn hơn 0.' : null };
}

export function LeaveRequestFormModal({
  leaveTypes,
  balances,
  editingRequest = null,
  onClose,
  onSaved,
}: LeaveRequestFormModalProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [leaveTypeId, setLeaveTypeId] = useState<number>(
    editingRequest?.leaveTypeId ?? leaveTypes[0]?.id ?? 0,
  );
  const [startDate, setStartDate] = useState<string>(editingRequest?.startDate ?? todayIso);
  const [endDate, setEndDate] = useState<string>(editingRequest?.endDate ?? todayIso);
  const [startSession, setStartSession] = useState<LeaveSessionOption>(
    editingRequest?.startSession ?? 'FULL',
  );
  const [endSession, setEndSession] = useState<LeaveSessionOption>(
    editingRequest?.endSession ?? 'FULL',
  );
  const [reason, setReason] = useState<string>(editingRequest?.reason ?? '');
  const [attachmentUrl, setAttachmentUrl] = useState<string>(editingRequest?.attachmentUrl ?? '');
  const [submittingMode, setSubmittingMode] = useState<'DRAFT' | 'SUBMIT' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedType = useMemo(
    () => leaveTypes.find((t) => t.id === leaveTypeId) ?? null,
    [leaveTypes, leaveTypeId],
  );

  const preview = useMemo(
    () => previewLeaveDays(startDate, endDate, startSession, endSession),
    [startDate, endDate, startSession, endSession],
  );

  const matchingBalance = useMemo(() => {
    const year = Number(startDate.slice(0, 4));
    return balances.find((b) => b.leaveTypeId === leaveTypeId && b.year === year) ?? null;
  }, [balances, leaveTypeId, startDate]);

  const exceedsBalance = Boolean(
    selectedType?.tracksBalance &&
      matchingBalance &&
      preview.days > matchingBalance.remainingDays,
  );

  async function handleSubmit(submitNow: boolean) {
    if (preview.error) {
      setErrorMsg(preview.error);
      return;
    }
    if (!leaveTypeId) {
      setErrorMsg('Vui lòng chọn loại nghỉ phép.');
      return;
    }
    if (reason.trim().length < 3) {
      setErrorMsg('Vui lòng nhập lý do nghỉ tối thiểu 3 ký tự.');
      return;
    }
    if (submitNow && selectedType?.requiresAttachment && !attachmentUrl.trim()) {
      setErrorMsg(`Loại phép "${selectedType.name}" yêu cầu nhập đường dẫn minh chứng đính kèm.`);
      return;
    }

    setErrorMsg(null);
    setSubmittingMode(submitNow ? 'SUBMIT' : 'DRAFT');

    try {
      const endpoint = editingRequest
        ? `/api/v1/hrm/requests/leaves/${editingRequest.id}`
        : '/api/v1/hrm/requests/leaves';
      const method = editingRequest ? 'PATCH' : 'POST';

      const payload = editingRequest
        ? {
            leaveTypeId,
            startDate,
            endDate,
            startSession,
            endSession,
            reason: reason.trim(),
            attachmentUrl: attachmentUrl.trim() || null,
          }
        : {
            leaveTypeId,
            startDate,
            endDate,
            startSession,
            endSession,
            reason: reason.trim(),
            attachmentUrl: attachmentUrl.trim() || null,
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
        setErrorMsg(json.error?.message ?? 'Không thể lưu đơn nghỉ phép.');
        setSubmittingMode(null);
        return;
      }

      if (editingRequest && submitNow) {
        const submitRes = await fetch(`/api/v1/hrm/requests/leaves/${editingRequest.id}/submit`, {
          method: 'POST',
        });
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
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconCalendarEvent size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editingRequest ? 'Chỉnh sửa đơn nghỉ phép' : 'Tạo đơn xin nghỉ phép'}
              </h2>
              <p className="text-xs text-slate-500">
                Hệ thống tự động loại trừ Thứ 7, Chủ nhật và kiểm tra quỹ phép
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submittingMode !== null}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Loại nghỉ phép <span className="text-rose-500">*</span>
            </label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            >
              {leaveTypes.map((lt) => {
                const bal = balances.find(
                  (b) => b.leaveTypeId === lt.id && b.year === Number(startDate.slice(0, 4)),
                );
                const balSuffix = lt.tracksBalance
                  ? bal
                    ? ` (Còn ${bal.remainingDays} ngày)`
                    : ' (Chưa khởi tạo quỹ)'
                  : ' (Không giới hạn quỹ)';
                return (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} — {lt.isPaid ? 'Hưởng lương' : 'Không lương'}
                    {balSuffix}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Từ ngày <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Buổi bắt đầu
              </label>
              <select
                value={startSession}
                onChange={(e) => setStartSession(e.target.value as LeaveSessionOption)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="FULL">Cả ngày</option>
                <option value="AM">Buổi sáng (AM)</option>
                <option value="PM">Buổi chiều (PM)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Đến ngày <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Buổi kết thúc
              </label>
              <select
                value={endSession}
                onChange={(e) => setEndSession(e.target.value as LeaveSessionOption)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="FULL">Cả ngày</option>
                <option value="AM">Buổi sáng (AM)</option>
                <option value="PM">Buổi chiều (PM)</option>
              </select>
            </div>
          </div>

          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              preview.error || exceedsBalance
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span>Số ngày nghỉ dự kiến (trừ T7/CN):</span>
              <span className="text-base">{preview.days} ngày</span>
            </div>
            {preview.error && <p className="mt-1 text-xs text-rose-700">{preview.error}</p>}
            {!preview.error && selectedType?.tracksBalance && matchingBalance && (
              <p className="mt-1 text-xs">
                Quỹ phép còn lại năm {matchingBalance.year}:{' '}
                <strong>{matchingBalance.remainingDays} ngày</strong>
                {exceedsBalance && ' — Cảnh báo: Vượt quá số ngày phép còn lại!'}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Lý do xin nghỉ <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập rõ lý do nghỉ phép và người bàn giao công việc (nếu có)..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Đường dẫn tài liệu / minh chứng{' '}
              {selectedType?.requiresAttachment ? (
                <span className="text-rose-500">* (Bắt buộc)</span>
              ) : (
                <span className="font-normal text-slate-400">(Tùy chọn)</span>
              )}
            </label>
            <input
              type="text"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="Ví dụ: https://drive.company.vn/giay-nghi-om.pdf"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submittingMode !== null}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
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
