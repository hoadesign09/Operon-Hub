'use client';

import { useState, type FormEvent } from 'react';
import { IconLoader2, IconX } from '@tabler/icons-react';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface MeetingRoomFormData {
  id?: number;
  branchId: number;
  code: string;
  name: string;
  floor: string | null;
  capacity: number;
  equipment: string[];
  description: string | null;
  isActive: boolean;
}

interface BranchOption {
  id: number;
  code: string;
  name: string;
}

interface MeetingRoomFormModalProps {
  branches: BranchOption[];
  defaultBranchId: number | null;
  initialData?: MeetingRoomFormData | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MeetingRoomFormModal({
  branches,
  defaultBranchId,
  initialData,
  onClose,
  onSaved,
}: MeetingRoomFormModalProps) {
  const { tr } = useI18n();
  const isEdit = Boolean(initialData?.id);
  const [branchId, setBranchId] = useState<string>(
    String(initialData?.branchId ?? defaultBranchId ?? branches[0]?.id ?? ''),
  );
  const [code, setCode] = useState(initialData?.code ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [floor, setFloor] = useState(initialData?.floor ?? '');
  const [capacity, setCapacity] = useState(String(initialData?.capacity ?? 6));
  const [equipmentText, setEquipmentText] = useState(
    initialData?.equipment?.join(', ') ?? tr('TV 55 inch, Bảng trắng', '55-inch TV, Whiteboard'),
  );
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [isActive, setIsActive] = useState<boolean>(initialData?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const parsedBranchId = Number(branchId);
    const parsedCapacity = Number(capacity);
    if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
      setErrorMessage(
        tr(
          'Vui lòng chọn chi nhánh quản lý phòng họp.',
          'Please select the branch managing this meeting room.',
        ),
      );
      return;
    }
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 500) {
      setErrorMessage(
        tr(
          'Sức chứa phải là số nguyên từ 1 đến 500 người.',
          'Capacity must be an integer between 1 and 500 people.',
        ),
      );
      return;
    }

    const equipment = equipmentText
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    setIsSubmitting(true);
    try {
      const url = isEdit
        ? `/api/v1/hrm/admin-ops/meeting-rooms/${initialData?.id}`
        : '/api/v1/hrm/admin-ops/meeting-rooms';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: parsedBranchId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          floor: floor.trim() || null,
          capacity: parsedCapacity,
          equipment,
          description: description.trim() || null,
          isActive,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể lưu thông tin phòng họp.', 'Unable to save meeting room details.'),
        );
        return;
      }

      onSaved();
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Server connection error. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit
              ? tr('Cập nhật phòng họp', 'Update Meeting Room')
              : tr('Thêm phòng họp mới', 'Add New Meeting Room')}
          </h2>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Chi nhánh', 'Branch')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Mã phòng họp', 'Room code')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                placeholder={tr('VD: PH-04', 'e.g. MR-04')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Tên phòng họp', 'Room name')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={tr('VD: Phòng họp Sáng tạo Tầng 5', 'e.g. Innovation Room - Floor 5')}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Vị trí / Tầng', 'Location / Floor')}
              </label>
              <input
                type="text"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder={tr('VD: Tầng 5 - Khu A', 'e.g. Floor 5 - Zone A')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Sức chứa (người)', 'Capacity (people)')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr(
                'Trang thiết bị sẵn có (cách nhau bằng dấu phẩy)',
                'Available equipment (comma-separated)',
              )}
            </label>
            <input
              type="text"
              value={equipmentText}
              onChange={(e) => setEquipmentText(e.target.value)}
              placeholder={tr(
                'VD: TV 65 inch, Bảng kính trắng, Micro không dây, Polycom',
                'e.g. 65-inch TV, Glass whiteboard, Wireless mic, Polycom',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Mô tả / Lưu ý', 'Description / Notes')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr(
                'Ghi chú hướng dẫn sử dụng phòng họp...',
                'Usage guidelines or room notes...',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <span>
              {tr(
                'Đang hoạt động (cho phép nhân viên đặt lịch)',
                'Active (available for employee booking)',
              )}
            </span>
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>
                {isEdit ? tr('Lưu thay đổi', 'Save Changes') : tr('Tạo phòng họp', 'Create Room')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
