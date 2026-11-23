'use client';

import { useState, type FormEvent } from 'react';
import { IconLoader2, IconX } from '@tabler/icons-react';
import type { AttendanceStatus } from '@/config/database';
import type { SimpleEmployeeOption } from '@/components/hrm/ShiftAssignmentModal';
import type { WorkShiftRecord } from '@/components/hrm/WorkShiftFormModal';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface AttendanceLogRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string;
  departmentId: number;
  departmentName: string;
  workDate: string;
  shiftId: number | null;
  shiftCode: string | null;
  shiftName: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  source: 'WEB' | 'IMPORT' | 'MANUAL';
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedHours: number;
  status: AttendanceStatus;
  note: string | null;
}

interface ManualAttendanceModalProps {
  initialData: AttendanceLogRecord | null;
  employees: SimpleEmployeeOption[];
  shifts: WorkShiftRecord[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualAttendanceModal({
  initialData,
  employees,
  shifts,
  onClose,
  onSuccess,
}: ManualAttendanceModalProps) {
  const { tr } = useI18n();
  const isEdit = Boolean(initialData);
  const [employeeId, setEmployeeId] = useState<string>(
    initialData ? String(initialData.employeeId) : employees[0] ? String(employees[0].id) : '',
  );
  const [workDate, setWorkDate] = useState(
    initialData?.workDate ?? new Date().toISOString().slice(0, 10),
  );
  const [shiftId, setShiftId] = useState<string>(
    initialData?.shiftId ? String(initialData.shiftId) : '',
  );
  const [checkInTime, setCheckInTime] = useState(initialData?.checkInTime ?? '08:00');
  const [checkOutTime, setCheckOutTime] = useState(initialData?.checkOutTime ?? '17:30');
  const [status, setStatus] = useState<string>('');
  const [note, setNote] = useState(initialData?.note ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (note.trim().length < 3) {
      setErrorMsg(
        tr(
          'Vui lòng nhập lý do điều chỉnh chấm công (tối thiểu 3 ký tự).',
          'Please enter a reason for the attendance adjustment (at least 3 characters).',
        ),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEdit
        ? `/api/v1/hrm/attendance/logs/${initialData!.id}`
        : '/api/v1/hrm/attendance/logs';

      const payload = isEdit
        ? {
            shiftId: shiftId ? Number(shiftId) : null,
            checkInTime: checkInTime || null,
            checkOutTime: checkOutTime || null,
            status: status || null,
            note: note.trim(),
          }
        : {
            employeeId: Number(employeeId),
            workDate,
            shiftId: shiftId ? Number(shiftId) : null,
            checkInTime: checkInTime || null,
            checkOutTime: checkOutTime || null,
            status: status || null,
            note: note.trim(),
          };

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
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
            tr('Không thể lưu điều chỉnh chấm công.', 'Unable to save attendance adjustment.'),
        );
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setErrorMsg(
        tr(
          'Lỗi kết nối máy chủ khi lưu chấm công.',
          'Server connection error while saving attendance.',
        ),
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            {isEdit
              ? tr(
                  `Điều chỉnh chấm công — ${initialData?.employeeCode}`,
                  `Adjust Attendance — ${initialData?.employeeCode}`,
                )
              : tr('Chấm công tay (Ghi nhận Audit Log)', 'Manual Attendance (Audit Logged)')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={tr('Đóng', 'Close')}
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

          {isEdit ? (
            <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
              <span className="font-semibold">{initialData?.employeeCode}</span> —{' '}
              {initialData?.employeeName} • {tr('Ngày', 'Date')}{' '}
              <span className="font-semibold">{initialData?.workDate}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Nhân viên *', 'Employee *')}
                </label>
                <select
                  required
                  disabled={isSubmitting}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">{tr('-- Chọn nhân viên --', '-- Select employee --')}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} - {emp.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Ngày công *', 'Work date *')}
                </label>
                <input
                  type="date"
                  required
                  disabled={isSubmitting}
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Ca làm việc (để trống = tự động)', 'Work shift (leave blank = auto)')}
              </label>
              <select
                disabled={isSubmitting}
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">
                  {tr('Tự động theo phân ca NV', 'Auto from employee shift assignment')}
                </option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name} ({s.startTime}–{s.endTime})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Ghi đè trạng thái (tùy chọn)', 'Override status (optional)')}
              </label>
              <select
                disabled={isSubmitting}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">
                  {tr('Tự động tính từ giờ vào/ra', 'Auto-calculate from check-in/out')}
                </option>
                <option value="PRESENT">{tr('Đúng giờ (PRESENT)', 'Present (PRESENT)')}</option>
                <option value="LATE">{tr('Đi muộn (LATE)', 'Late (LATE)')}</option>
                <option value="ABSENT">{tr('Vắng mặt (ABSENT)', 'Absent (ABSENT)')}</option>
                <option value="LEAVE">{tr('Nghỉ phép (LEAVE)', 'On Leave (LEAVE)')}</option>
                <option value="HOLIDAY">{tr('Ngày lễ (HOLIDAY)', 'Holiday (HOLIDAY)')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Giờ vào', 'Check-in time')}
              </label>
              <input
                type="time"
                disabled={isSubmitting}
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Giờ ra', 'Check-out time')}
              </label>
              <input
                type="time"
                disabled={isSubmitting}
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {tr(
                'Lý do điều chỉnh (bắt buộc lưu Audit Log) *',
                'Adjustment reason (required for Audit Log) *',
              )}
            </label>
            <textarea
              rows={2}
              required
              minLength={3}
              disabled={isSubmitting}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr(
                'VD: Quên bấm check-out, đã xác nhận với trưởng bộ phận',
                'e.g. Forgot to check out, confirmed with department manager',
              )}
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
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>{tr('Lưu chấm công', 'Save Attendance')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
