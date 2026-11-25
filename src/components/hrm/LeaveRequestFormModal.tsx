'use client';

import { useMemo, useState } from 'react';
import { IconAlertCircle, IconCalendarEvent, IconLoader2, IconSend, IconX } from '@tabler/icons-react';
import { countWorkingDays } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

export type LeaveSessionOption = 'FULL' | 'AM' | 'PM';

export interface LeaveTypeOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
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
  tr: (vi: string, en: string) => string,
): { days: number; error: string | null } {
  if (!startDate || !endDate) {
    return { days: 0, error: null };
  }
  if (endDate < startDate) {
    return {
      days: 0,
      error: tr(
        'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.',
        'End date cannot be earlier than start date.',
      ),
    };
  }
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
    return {
      days: 0,
      error: tr(
        'Đơn nghỉ phép phải nằm trong cùng 1 năm dương lịch (hãy tách thành 2 đơn riêng).',
        'Leave request must fall within a single calendar year (please split into 2 separate requests).',
      ),
    };
  }
  if (startDate === endDate && startSession === 'PM' && endSession === 'AM') {
    return {
      days: 0,
      error: tr(
        'Trong cùng ngày, buổi kết thúc (Sáng) không thể trước buổi bắt đầu (Chiều).',
        'On the same day, the end session (AM) cannot be earlier than the start session (PM).',
      ),
    };
  }

  const baseDays = countWorkingDays(startDate, endDate);
  if (baseDays === 0) {
    return {
      days: 0,
      error: tr(
        'Khoảng ngày chọn toàn bộ rơi vào Thứ 7 / Chủ nhật.',
        'The selected date range falls entirely on weekends (Sat / Sun).',
      ),
    };
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
  return {
    days: rounded,
    error:
      rounded <= 0
        ? tr('Số ngày nghỉ phải lớn hơn 0.', 'Number of leave days must be greater than 0.')
        : null,
  };
}

export function LeaveRequestFormModal({
  leaveTypes,
  balances,
  editingRequest = null,
  onClose,
  onSaved,
}: LeaveRequestFormModalProps) {
  const { tr, ln } = useI18n();
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
    () => previewLeaveDays(startDate, endDate, startSession, endSession, tr),
    [startDate, endDate, startSession, endSession, tr],
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
      setErrorMsg(tr('Vui lòng chọn loại nghỉ phép.', 'Please select a leave type.'));
      return;
    }
    if (reason.trim().length < 3) {
      setErrorMsg(
        tr(
          'Vui lòng nhập lý do nghỉ tối thiểu 3 ký tự.',
          'Please enter a leave reason of at least 3 characters.',
        ),
      );
      return;
    }
    if (submitNow && selectedType?.requiresAttachment && !attachmentUrl.trim()) {
      const leaveTypeLabel = ln(selectedType.name, selectedType.nameEn);
      setErrorMsg(
        tr(
          `Loại phép "${leaveTypeLabel}" yêu cầu nhập đường dẫn minh chứng đính kèm.`,
          `Leave type "${leaveTypeLabel}" requires an attachment URL.`,
        ),
      );
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
        setErrorMsg(
          json.error?.message ?? tr('Không thể lưu đơn nghỉ phép.', 'Unable to save leave request.'),
        );
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
          setErrorMsg(
            submitJson.error?.message ??
              tr(
                'Đã lưu nháp nhưng gửi duyệt thất bại.',
                'Saved as draft, but failed to submit for approval.',
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
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconCalendarEvent size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editingRequest
                  ? tr('Chỉnh sửa đơn nghỉ phép', 'Edit Leave Request')
                  : tr('Tạo đơn xin nghỉ phép', 'New Leave Request')}
              </h2>
              <p className="text-xs text-slate-500">
                {tr(
                  'Hệ thống tự động loại trừ Thứ 7, Chủ nhật và kiểm tra quỹ phép',
                  'Automatically excludes weekends (Sat/Sun) and checks leave balance',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submittingMode !== null}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
              {tr('Loại nghỉ phép', 'Leave type')} <span className="text-rose-500">*</span>
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
                    ? tr(` (Còn ${bal.remainingDays} ngày)`, ` (${bal.remainingDays} days left)`)
                    : tr(' (Chưa khởi tạo quỹ)', ' (Balance not initialized)')
                  : tr(' (Không giới hạn quỹ)', ' (Unlimited balance)');
                return (
                  <option key={lt.id} value={lt.id}>
                    {ln(lt.name, lt.nameEn)} —{' '}
                    {lt.isPaid ? tr('Hưởng lương', 'Paid') : tr('Không lương', 'Unpaid')}
                    {balSuffix}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {tr('Từ ngày', 'Start date')} <span className="text-rose-500">*</span>
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
                {tr('Buổi bắt đầu', 'Start session')}
              </label>
              <select
                value={startSession}
                onChange={(e) => setStartSession(e.target.value as LeaveSessionOption)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="FULL">{tr('Cả ngày', 'Full day')}</option>
                <option value="AM">{tr('Buổi sáng (AM)', 'Morning (AM)')}</option>
                <option value="PM">{tr('Buổi chiều (PM)', 'Afternoon (PM)')}</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {tr('Đến ngày', 'End date')} <span className="text-rose-500">*</span>
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
                {tr('Buổi kết thúc', 'End session')}
              </label>
              <select
                value={endSession}
                onChange={(e) => setEndSession(e.target.value as LeaveSessionOption)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="FULL">{tr('Cả ngày', 'Full day')}</option>
                <option value="AM">{tr('Buổi sáng (AM)', 'Morning (AM)')}</option>
                <option value="PM">{tr('Buổi chiều (PM)', 'Afternoon (PM)')}</option>
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
              <span>{tr('Số ngày nghỉ dự kiến (trừ T7/CN):', 'Estimated leave days (excl. Sat/Sun):')}</span>
              <span className="text-base">
                {preview.days} {tr('ngày', 'days')}
              </span>
            </div>
            {preview.error && <p className="mt-1 text-xs text-rose-700">{preview.error}</p>}
            {!preview.error && selectedType?.tracksBalance && matchingBalance && (
              <p className="mt-1 text-xs">
                {tr(
                  `Quỹ phép còn lại năm ${matchingBalance.year}:`,
                  `Remaining balance for ${matchingBalance.year}:`,
                )}{' '}
                <strong>
                  {matchingBalance.remainingDays} {tr('ngày', 'days')}
                </strong>
                {exceedsBalance &&
                  tr(
                    ' — Cảnh báo: Vượt quá số ngày phép còn lại!',
                    ' — Warning: Exceeds remaining leave balance!',
                  )}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {tr('Lý do xin nghỉ', 'Reason for leave')} <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tr(
                'Nhập rõ lý do nghỉ phép và người bàn giao công việc (nếu có)...',
                'Describe the reason for leave and work handover contact (if any)...',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {tr('Đường dẫn tài liệu / minh chứng', 'Supporting document / attachment URL')}{' '}
              {selectedType?.requiresAttachment ? (
                <span className="text-rose-500">{tr('* (Bắt buộc)', '* (Required)')}</span>
              ) : (
                <span className="font-normal text-slate-400">{tr('(Tùy chọn)', '(Optional)')}</span>
              )}
            </label>
            <input
              type="text"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder={tr(
                'Ví dụ: https://drive.company.vn/giay-nghi-om.pdf',
                'e.g., https://drive.company.com/medical-certificate.pdf',
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
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
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
