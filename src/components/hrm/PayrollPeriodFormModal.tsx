'use client';

import { useState, type FormEvent } from 'react';
import { IconX } from '@tabler/icons-react';
import { useI18n } from '@/shared/i18n/I18nContext';

interface BranchOption {
  id: number;
  code: string;
  name: string;
}

interface PayrollPeriodFormModalProps {
  defaultYear: number;
  defaultMonth: number;
  defaultBranchId: number | null;
  hasAllBranches: boolean;
  branches: BranchOption[];
  onClose: () => void;
  onSuccess: (createdPeriodId: number) => void;
}

export function PayrollPeriodFormModal({
  defaultYear,
  defaultMonth,
  defaultBranchId,
  hasAllBranches,
  branches,
  onClose,
  onSuccess,
}: PayrollPeriodFormModalProps) {
  const { tr } = useI18n();
  const initialBranchId =
    defaultBranchId !== null
      ? String(defaultBranchId)
      : hasAllBranches
        ? ''
        : String(branches[0]?.id ?? '');

  const [year, setYear] = useState(String(defaultYear));
  const [month, setMonth] = useState(String(defaultMonth));
  const [branchId, setBranchId] = useState(initialBranchId);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedBranch = branches.find((b) => String(b.id) === branchId);
  const paddedMonth = String(Number(month) || 1).padStart(2, '0');
  const suggestedCode = `BL-${year}-${paddedMonth}-${selectedBranch ? selectedBranch.code : 'ALL'}`;
  const suggestedName = tr(
    `Bảng lương tháng ${paddedMonth}/${year} - ${selectedBranch ? selectedBranch.name : 'Toàn công ty'}`,
    `Payroll ${paddedMonth}/${year} - ${selectedBranch ? selectedBranch.name : 'All Branches'}`,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/hrm/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: Number(year),
          month: Number(month),
          branchId: branchId ? Number(branchId) : null,
          code: code.trim() || undefined,
          name: name.trim() || undefined,
          note: note.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: { period?: { id: number } };
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data?.period) {
        setErrorMessage(
          payload.error?.message ??
            tr('Không thể tạo kỳ lương mới.', 'Unable to create payroll period.'),
        );
        setIsSubmitting(false);
        return;
      }

      onSuccess(payload.data.period.id);
    } catch {
      setErrorMessage(
        tr(
          'Lỗi kết nối máy chủ khi tạo kỳ lương.',
          'Server connection error while creating payroll period.',
        ),
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {tr('Tạo Kỳ tính lương mới', 'Create New Payroll Period')}
            </h2>
            <p className="text-xs text-slate-500">
              {tr(
                'Khởi tạo kỳ lương theo tháng và chi nhánh để tổng hợp thu nhập, BHXH & thuế TNCN.',
                'Initialize a monthly payroll period by branch to aggregate earnings, social insurance & PIT.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Tháng *', 'Month *')}
              </span>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m}>
                    {tr(`Tháng ${m}`, `Month ${m}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Năm *', 'Year *')}
              </span>
              <input
                type="number"
                min={2020}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {tr('Phạm vi chi nhánh', 'Branch scope')}
            </span>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            >
              {hasAllBranches && (
                <option value="">
                  {tr('Toàn công ty (tất cả chi nhánh)', 'Company-wide (all branches)')}
                </option>
              )}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {tr(
                'Mã kỳ lương (để trống để tự sinh)',
                'Period code (leave blank to auto-generate)',
              )}
            </span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={suggestedCode}
              maxLength={50}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {tr(
                'Tên kỳ lương (để trống để tự sinh)',
                'Period name (leave blank to auto-generate)',
              )}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestedName}
              maxLength={200}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">{tr('Ghi chú', 'Notes')}</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr(
                'Ghi chú kỳ trả lương, thưởng lễ...',
                'Notes on payout schedule, holiday bonuses...',
              )}
              maxLength={2000}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting
                ? tr('Đang khởi tạo...', 'Creating...')
                : tr('Tạo kỳ lương', 'Create Period')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
