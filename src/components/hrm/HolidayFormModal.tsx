'use client';

import { useState, type FormEvent } from 'react';
import { IconLoader2, IconX } from '@tabler/icons-react';
import type { BranchOption } from '@/components/hrm/WorkShiftFormModal';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface HolidayRecord {
  id: number;
  branchId: number | null;
  branchName: string | null;
  holidayDate: string;
  name: string;
  isPaid: boolean;
  note: string | null;
}

interface HolidayFormModalProps {
  initialData: HolidayRecord | null;
  branches: BranchOption[];
  defaultYear: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function HolidayFormModal({
  initialData,
  branches,
  defaultYear,
  onClose,
  onSuccess,
}: HolidayFormModalProps) {
  const { tr } = useI18n();
  const isEdit = Boolean(initialData);
  const [holidayDate, setHolidayDate] = useState(
    initialData?.holidayDate ?? `${defaultYear}-01-01`,
  );
  const [name, setName] = useState(initialData?.name ?? '');
  const [branchId, setBranchId] = useState<string>(
    initialData?.branchId ? String(initialData.branchId) : '',
  );
  const [isPaid, setIsPaid] = useState(initialData?.isPaid ?? true);
  const [note, setNote] = useState(initialData?.note ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const url = isEdit
        ? `/api/v1/hrm/attendance/holidays/${initialData!.id}`
        : '/api/v1/hrm/attendance/holidays';

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holidayDate,
          name: name.trim(),
          branchId: branchId ? Number(branchId) : null,
          isPaid,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setErrorMsg(
          json.error?.message ?? tr('Không thể lưu ngày lễ.', 'Unable to save holiday.'),
        );
        setIsSubmitting(false);
        return;
      }
      onSuccess();
    } catch {
      setErrorMsg(
        tr(
          'Lỗi kết nối máy chủ khi lưu ngày lễ.',
          'Server connection error while saving holiday.',
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
              ? tr('Cập nhật ngày lễ', 'Edit Holiday')
              : tr('Thêm ngày lễ mới', 'Add New Holiday')}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Ngày lễ *', 'Holiday Date *')}
              </label>
              <input
                type="date"
                required
                disabled={isSubmitting}
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Phạm vi chi nhánh', 'Branch Scope')}
              </label>
              <select
                disabled={isSubmitting}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">{tr('Toàn công ty', 'Company-wide')}</option>
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
              {tr('Tên ngày lễ *', 'Holiday Name *')}
            </label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr('VD: Ngày Quốc khánh 2/9', 'e.g. National Day (Sep 2)')}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {tr('Ghi chú', 'Notes')}
            </label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr(
                'Ghi chú chế độ nghỉ bù / áp dụng...',
                'Notes on compensatory leave / applicability...',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPaid}
              disabled={isSubmitting}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <span>{tr('Nghỉ lễ hưởng nguyên lương', 'Paid public holiday')}</span>
          </label>

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
              <span>
                {isEdit ? tr('Lưu thay đổi', 'Save Changes') : tr('Thêm ngày lễ', 'Add Holiday')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
