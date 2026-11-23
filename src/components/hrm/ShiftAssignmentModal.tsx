'use client';

import { useState, type FormEvent } from 'react';
import { IconLoader2, IconX } from '@tabler/icons-react';
import type { WorkShiftRecord } from '@/components/hrm/WorkShiftFormModal';

export interface SimpleEmployeeOption {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentName: string;
}

interface ShiftAssignmentModalProps {
  shifts: WorkShiftRecord[];
  employees: SimpleEmployeeOption[];
  onClose: () => void;
  onSuccess: () => void;
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
] as const;

export function ShiftAssignmentModal({
  shifts,
  employees,
  onClose,
  onSuccess,
}: ShiftAssignmentModalProps) {
  const activeShifts = shifts.filter((s) => s.isActive);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [shiftId, setShiftId] = useState<string>(
    activeShifts[0] ? String(activeShifts[0].id) : '',
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [effectiveTo, setEffectiveTo] = useState('');
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredEmployees = employees.filter((emp) => {
    const q = empSearch.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (
      emp.employeeCode.toLowerCase().includes(q) ||
      emp.fullName.toLowerCase().includes(q) ||
      emp.departmentName.toLowerCase().includes(q)
    );
  });

  function toggleEmployee(id: number) {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleWorkDay(day: number) {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedEmpIds.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 nhân viên để phân ca.');
      return;
    }
    if (!shiftId) {
      setErrorMsg('Vui lòng chọn ca làm việc.');
      return;
    }
    if (workDays.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 ngày làm việc trong tuần.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/hrm/attendance/shift-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: selectedEmpIds,
          shiftId: Number(shiftId),
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          workDays,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message ?? 'Không thể phân ca làm việc.');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ khi phân ca.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Phân ca làm việc cho Nhân viên</h3>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Ca làm việc *
              </label>
              <select
                required
                disabled={isSubmitting}
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">-- Chọn ca --</option>
                {activeShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name} ({s.startTime}–{s.endTime})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Hiệu lực từ ngày *
              </label>
              <input
                type="date"
                required
                disabled={isSubmitting}
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Đến ngày (tùy chọn)
              </label>
              <input
                type="date"
                disabled={isSubmitting}
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Ngày làm việc trong tuần *
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((item) => {
                const active = workDays.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => toggleWorkDay(item.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">
                Chọn nhân viên ({selectedEmpIds.length} đã chọn) *
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedEmpIds(filteredEmployees.map((e) => e.id))}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedEmpIds([])}
                  className="font-medium text-slate-500 hover:underline"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
            <input
              type="text"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="Tìm theo mã NV, họ tên hoặc phòng ban..."
              className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
            />
            <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Không tìm thấy nhân viên phù hợp.
                </div>
              ) : (
                filteredEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedEmpIds.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span className="font-semibold text-slate-800">{emp.employeeCode}</span>
                      <span className="text-slate-700">{emp.fullName}</span>
                    </span>
                    <span className="text-slate-400">{emp.departmentName}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Ghi chú</label>
            <input
              type="text"
              disabled={isSubmitting}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Áp dụng lịch làm việc mới Q4/2026"
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
              <span>Lưu phân ca ({selectedEmpIds.length})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
