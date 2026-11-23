'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCalendarPlus, IconLoader2, IconX } from '@tabler/icons-react';

interface InitializeBalancesModalProps {
  defaultYear: number;
  selectedBranchId: number | null;
  onClose: () => void;
  onCompleted: (summary: { year: number; createdCount: number; skippedCount: number }) => void;
}

export function InitializeBalancesModal({
  defaultYear,
  selectedBranchId,
  onClose,
  onCompleted,
}: InitializeBalancesModalProps) {
  const [year, setYear] = useState<string>(String(defaultYear));
  const [includeCarryOver, setIncludeCarryOver] = useState(true);
  const [includeSeniorityBonus, setIncludeSeniorityBonus] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/v1/hrm/requests/leave-balances/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: Number(year),
          branchId: selectedBranchId,
          includeCarryOver,
          includeSeniorityBonus,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { year: number; createdCount: number; skippedCount: number };
        error?: { message?: string };
      };

      if (!res.ok || !json.success || !json.data) {
        setErrorMsg(json.error?.message ?? 'Không thể khởi tạo quỹ phép năm.');
        setIsSubmitting(false);
        return;
      }

      onCompleted(json.data);
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconCalendarPlus size={20} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Khởi tạo quỹ phép năm</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
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

          <p className="text-xs leading-relaxed text-slate-600">
            Hệ thống sẽ tạo mới bản ghi quỹ phép cho tất cả nhân viên đang làm việc chưa có quỹ
            trong năm đã chọn (không ghi đè bản ghi đã tồn tại).
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Năm áp dụng <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={2020}
              max={2100}
              required
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeCarryOver}
              onChange={(e) => setIncludeCarryOver(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <span>
              <strong className="block text-slate-900">Kết chuyển phép tồn năm trước</strong>
              <span className="text-xs text-slate-500">
                Tự động lấy số dư năm {Number(year) - 1} tối đa theo hạn mức kết chuyển của loại phép
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeSeniorityBonus}
              onChange={(e) => setIncludeSeniorityBonus(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <span>
              <strong className="block text-slate-900">Cộng thưởng phép thâm niên</strong>
              <span className="text-xs text-slate-500">
                Cộng +1 ngày phép năm cho mỗi đủ 5 năm làm việc (Điều 114 BLLĐ)
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>Khởi tạo quỹ phép</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
