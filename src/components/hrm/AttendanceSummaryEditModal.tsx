'use client';

import { useState, type FormEvent } from 'react';
import { IconLoader2, IconX } from '@tabler/icons-react';

export interface AttendanceSummaryRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string;
  departmentId: number;
  departmentName: string;
  year: number;
  month: number;
  standardWorkDays: number;
  actualWorkDays: number;
  businessTripDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  holidayDays: number;
  payableDays: number;
  otHours150: number;
  otHours200: number;
  otHours300: number;
  lateCount: number;
  totalLateMinutes: number;
  earlyLeaveCount: number;
  totalEarlyLeaveMinutes: number;
  status: 'DRAFT' | 'LOCKED';
  lockedBy: number | null;
  lockedByName: string | null;
  lockedAt: string | null;
  adjustmentNote: string | null;
}

interface AttendanceSummaryEditModalProps {
  summary: AttendanceSummaryRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export function AttendanceSummaryEditModal({
  summary,
  onClose,
  onSuccess,
}: AttendanceSummaryEditModalProps) {
  const [standardWorkDays, setStandardWorkDays] = useState(String(summary.standardWorkDays));
  const [actualWorkDays, setActualWorkDays] = useState(String(summary.actualWorkDays));
  const [businessTripDays, setBusinessTripDays] = useState(String(summary.businessTripDays));
  const [paidLeaveDays, setPaidLeaveDays] = useState(String(summary.paidLeaveDays));
  const [unpaidLeaveDays, setUnpaidLeaveDays] = useState(String(summary.unpaidLeaveDays));
  const [holidayDays, setHolidayDays] = useState(String(summary.holidayDays));
  const [otHours150, setOtHours150] = useState(String(summary.otHours150));
  const [otHours200, setOtHours200] = useState(String(summary.otHours200));
  const [otHours300, setOtHours300] = useState(String(summary.otHours300));
  const [lateCount, setLateCount] = useState(String(summary.lateCount));
  const [adjustmentNote, setAdjustmentNote] = useState(summary.adjustmentNote ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewPayable = (
    (Number(actualWorkDays) || 0) +
    (Number(paidLeaveDays) || 0) +
    (Number(holidayDays) || 0)
  ).toFixed(2);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (adjustmentNote.trim().length < 3) {
      setErrorMsg('Vui lòng nhập lý do điều chỉnh bảng công (tối thiểu 3 ký tự).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/hrm/attendance/summaries/${summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standardWorkDays: Number(standardWorkDays) || 0,
          actualWorkDays: Number(actualWorkDays) || 0,
          businessTripDays: Number(businessTripDays) || 0,
          paidLeaveDays: Number(paidLeaveDays) || 0,
          unpaidLeaveDays: Number(unpaidLeaveDays) || 0,
          holidayDays: Number(holidayDays) || 0,
          otHours150: Number(otHours150) || 0,
          otHours200: Number(otHours200) || 0,
          otHours300: Number(otHours300) || 0,
          lateCount: Number(lateCount) || 0,
          adjustmentNote: adjustmentNote.trim(),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message ?? 'Không thể lưu điều chỉnh bảng công.');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ khi cập nhật bảng công.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Điều chỉnh Bảng công Tháng {summary.month}/{summary.year}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {summary.employeeCode} — {summary.employeeName} ({summary.departmentName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Công chuẩn</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={31}
                disabled={isSubmitting}
                value={standardWorkDays}
                onChange={(e) => setStandardWorkDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Công thực tế</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={31}
                disabled={isSubmitting}
                value={actualWorkDays}
                onChange={(e) => setActualWorkDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Trong đó công tác</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={31}
                disabled={isSubmitting}
                value={businessTripDays}
                onChange={(e) => setBusinessTripDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Phép hưởng lương</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={31}
                disabled={isSubmitting}
                value={paidLeaveDays}
                onChange={(e) => setPaidLeaveDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Phép không lương</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={31}
                disabled={isSubmitting}
                value={unpaidLeaveDays}
                onChange={(e) => setUnpaidLeaveDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Ngày lễ hưởng lương</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={31}
                disabled={isSubmitting}
                value={holidayDays}
                onChange={(e) => setHolidayDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-2.5 text-xs text-blue-900">
            Tổng ngày công hưởng lương dự kiến (Thực tế + Phép hưởng lương + Lễ):{' '}
            <span className="font-mono text-sm font-bold text-blue-700">{previewPayable} công</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">OT 150% (giờ)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={200}
                disabled={isSubmitting}
                value={otHours150}
                onChange={(e) => setOtHours150(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">OT 200% (giờ)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={200}
                disabled={isSubmitting}
                value={otHours200}
                onChange={(e) => setOtHours200(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">OT 300% (giờ)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={200}
                disabled={isSubmitting}
                value={otHours300}
                onChange={(e) => setOtHours300(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Số lần đi muộn</label>
              <input
                type="number"
                min={0}
                max={31}
                disabled={isSubmitting}
                value={lateCount}
                onChange={(e) => setLateCount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Lý do điều chỉnh (bắt buộc lưu Audit Log) *
            </label>
            <textarea
              rows={2}
              required
              minLength={3}
              disabled={isSubmitting}
              value={adjustmentNote}
              onChange={(e) => setAdjustmentNote(e.target.value)}
              placeholder="VD: Bổ sung 0.5 công đi gặp khách hàng có xác nhận của trưởng bộ phận"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>Lưu điều chỉnh</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
