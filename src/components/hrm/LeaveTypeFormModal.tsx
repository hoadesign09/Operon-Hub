'use client';

import { useState } from 'react';
import { IconAlertCircle, IconLoader2, IconX } from '@tabler/icons-react';

export interface LeaveTypeFormItem {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
  defaultDaysPerYear: number;
  allowCarryOver: boolean;
  maxCarryOverDays: number;
  requiresAttachment: boolean;
  description: string | null;
  isActive: boolean;
}

interface LeaveTypeFormModalProps {
  editingItem?: LeaveTypeFormItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function LeaveTypeFormModal({
  editingItem = null,
  onClose,
  onSaved,
}: LeaveTypeFormModalProps) {
  const [code, setCode] = useState(editingItem?.code ?? '');
  const [name, setName] = useState(editingItem?.name ?? '');
  const [isPaid, setIsPaid] = useState(editingItem?.isPaid ?? true);
  const [defaultDaysPerYear, setDefaultDaysPerYear] = useState(
    String(editingItem?.defaultDaysPerYear ?? 12),
  );
  const [allowCarryOver, setAllowCarryOver] = useState(editingItem?.allowCarryOver ?? false);
  const [maxCarryOverDays, setMaxCarryOverDays] = useState(
    String(editingItem?.maxCarryOverDays ?? 0),
  );
  const [requiresAttachment, setRequiresAttachment] = useState(
    editingItem?.requiresAttachment ?? false,
  );
  const [description, setDescription] = useState(editingItem?.description ?? '');
  const [isActive, setIsActive] = useState(editingItem?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);

    try {
      const url = editingItem
        ? `/api/v1/hrm/requests/leave-types/${editingItem.id}`
        : '/api/v1/hrm/requests/leave-types';
      const method = editingItem ? 'PATCH' : 'POST';

      const payload = editingItem
        ? {
            name: name.trim(),
            isPaid,
            defaultDaysPerYear: Number(defaultDaysPerYear),
            allowCarryOver,
            maxCarryOverDays: allowCarryOver ? Number(maxCarryOverDays) : 0,
            requiresAttachment,
            description: description.trim() || null,
            isActive,
          }
        : {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            isPaid,
            defaultDaysPerYear: Number(defaultDaysPerYear),
            allowCarryOver,
            maxCarryOverDays: allowCarryOver ? Number(maxCarryOverDays) : 0,
            requiresAttachment,
            description: description.trim() || null,
            isActive,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message ?? 'Không thể lưu loại nghỉ phép.');
        setIsSaving(false);
        return;
      }

      onSaved();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">
            {editingItem ? 'Cập nhật loại nghỉ phép' : 'Thêm loại nghỉ phép mới'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              <IconAlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Mã loại phép <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingItem)}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: ANNUAL"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Số ngày tiêu chuẩn / năm
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="365"
                value={defaultDaysPerYear}
                onChange={(e) => setDefaultDaysPerYear(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Nhập 0 nếu không giới hạn quỹ phép năm
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Tên loại nghỉ phép <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Nghỉ phép năm"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Hưởng nguyên lương</span>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={requiresAttachment}
                onChange={(e) => setRequiresAttachment(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Bắt buộc đính kèm</span>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allowCarryOver}
                onChange={(e) => setAllowCarryOver(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Cho phép kết chuyển</span>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Đang áp dụng</span>
            </label>
          </div>

          {allowCarryOver && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Số ngày kết chuyển tối đa sang năm sau
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="365"
                value={maxCarryOverDays}
                onChange={(e) => setMaxCarryOverDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Mô tả</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú chính sách áp dụng..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving && <IconLoader2 size={16} className="animate-spin" />}
              <span>{editingItem ? 'Lưu thay đổi' : 'Tạo loại phép'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
