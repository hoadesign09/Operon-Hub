'use client';

import { useState, type FormEvent } from 'react';
import { IconLoader2, IconX } from '@tabler/icons-react';

export interface WorkShiftRecord {
  id: number;
  branchId: number | null;
  branchName: string | null;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStartTime: string | null;
  breakEndTime: string | null;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  workingHours: number;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
  assignedEmployeeCount: number;
}

export interface BranchOption {
  id: number;
  code: string;
  name: string;
}

interface WorkShiftFormModalProps {
  initialData: WorkShiftRecord | null;
  branches: BranchOption[];
  onClose: () => void;
  onSuccess: () => void;
}

export function WorkShiftFormModal({
  initialData,
  branches,
  onClose,
  onSuccess,
}: WorkShiftFormModalProps) {
  const isEdit = Boolean(initialData);
  const [code, setCode] = useState(initialData?.code ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [branchId, setBranchId] = useState<string>(
    initialData?.branchId ? String(initialData.branchId) : '',
  );
  const [startTime, setStartTime] = useState(initialData?.startTime ?? '08:00');
  const [endTime, setEndTime] = useState(initialData?.endTime ?? '17:30');
  const [breakStartTime, setBreakStartTime] = useState(
    initialData?.breakStartTime ?? '12:00',
  );
  const [breakEndTime, setBreakEndTime] = useState(
    initialData?.breakEndTime ?? '13:30',
  );
  const [lateGraceMinutes, setLateGraceMinutes] = useState(
    String(initialData?.lateGraceMinutes ?? 10),
  );
  const [earlyLeaveGraceMinutes, setEarlyLeaveGraceMinutes] = useState(
    String(initialData?.earlyLeaveGraceMinutes ?? 10),
  );
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? false);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const payload = {
        ...(isEdit ? {} : { code: code.trim().toUpperCase() }),
        name: name.trim(),
        branchId: branchId ? Number(branchId) : null,
        startTime,
        endTime,
        breakStartTime: breakStartTime.trim() || null,
        breakEndTime: breakEndTime.trim() || null,
        lateGraceMinutes: Number(lateGraceMinutes) || 0,
        earlyLeaveGraceMinutes: Number(earlyLeaveGraceMinutes) || 0,
        isDefault,
        isActive,
        description: description.trim() || null,
      };

      const url = isEdit
        ? `/api/v1/hrm/attendance/shifts/${initialData!.id}`
        : '/api/v1/hrm/attendance/shifts';

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
        setErrorMsg(json.error?.message ?? 'Không thể lưu ca làm việc.');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ khi lưu ca làm việc.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            {isEdit ? `Cập nhật ca làm việc (${initialData?.code})` : 'Tạo ca làm việc mới'}
          </h3>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Mã ca <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isEdit || isSubmitting}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: HC, CA_CHIEU"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Chi nhánh áp dụng
              </label>
              <select
                value={branchId}
                disabled={isSubmitting}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Toàn công ty</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Tên ca làm việc <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Ca Hành chính chuẩn"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Giờ bắt đầu *
              </label>
              <input
                type="time"
                required
                disabled={isSubmitting}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Giờ kết thúc *
              </label>
              <input
                type="time"
                required
                disabled={isSubmitting}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Nghỉ trưa từ
              </label>
              <input
                type="time"
                disabled={isSubmitting}
                value={breakStartTime}
                onChange={(e) => setBreakStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Nghỉ trưa đến
              </label>
              <input
                type="time"
                disabled={isSubmitting}
                value={breakEndTime}
                onChange={(e) => setBreakEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Dung sai đi muộn (phút)
              </label>
              <input
                type="number"
                min={0}
                max={180}
                disabled={isSubmitting}
                value={lateGraceMinutes}
                onChange={(e) => setLateGraceMinutes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Dung sai về sớm (phút)
              </label>
              <input
                type="number"
                min={0}
                max={180}
                disabled={isSubmitting}
                value={earlyLeaveGraceMinutes}
                onChange={(e) => setEarlyLeaveGraceMinutes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Mô tả</label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú thêm về quy định áp dụng ca..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isDefault}
                disabled={isSubmitting}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Đặt làm ca mặc định</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                disabled={isSubmitting}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Đang hoạt động</span>
            </label>
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
              <span>{isEdit ? 'Lưu thay đổi' : 'Tạo ca làm việc'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
