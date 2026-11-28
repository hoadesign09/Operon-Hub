'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { IconX } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AssetListItem } from '@/modules/hrm/office/assets.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  employmentStatus: string;
}

interface AssetAssignReturnModalProps {
  mode: 'assign' | 'return';
  asset: AssetListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssetAssignReturnModal({
  mode,
  asset,
  onClose,
  onSuccess,
}: AssetAssignReturnModalProps) {
  const { tr } = useI18n();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(mode === 'assign');
  const [employeeId, setEmployeeId] = useState('');
  const [actionDate, setActionDate] = useState(todayIso);
  const [expectedReturnAt, setExpectedReturnAt] = useState('');
  const [condition, setCondition] = useState(
    mode === 'assign'
      ? tr(
          'Mới / Hoạt động bình thường, đầy đủ phụ kiện',
          'New / Working normally, all accessories included',
        )
      : tr(
          'Hoạt động ổn định, đầy đủ phụ kiện bàn giao',
          'Working properly, all handed-over accessories intact',
        ),
  );
  const [nextStatus, setNextStatus] = useState<'AVAILABLE' | 'MAINTENANCE' | 'RETIRED'>(
    'AVAILABLE',
  );
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'assign') return;
    const controller = new AbortController();

    fetch('/api/v1/hrm/employees?limit=100', { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { items: EmployeeOption[] };
        };
        if (res.ok && json.success && json.data?.items) {
          const activeList = json.data.items.filter(
            (e) =>
              e.employmentStatus !== 'RESIGNED' &&
              e.employmentStatus !== 'TERMINATED',
          );
          setEmployees(activeList);
        }
      })
      .catch(() => {
        // Bỏ qua lỗi abort; nếu lỗi mạng người dùng vẫn thấy dropdown trống
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingEmployees(false);
        }
      });

    return () => controller.abort();
  }, [mode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const endpoint =
        mode === 'assign'
          ? `/api/v1/hrm/admin-ops/assets/${asset.id}/assign`
          : `/api/v1/hrm/admin-ops/assets/${asset.id}/return`;

      const body =
        mode === 'assign'
          ? {
              employeeId: Number(employeeId),
              assignedAt: actionDate || null,
              expectedReturnAt: expectedReturnAt || null,
              conditionOnAssign: condition.trim(),
              note: note.trim() || null,
            }
          : {
              returnedAt: actionDate || null,
              conditionOnReturn: condition.trim(),
              nextStatus,
              note: note.trim() || null,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        setErrorMessage(
          json.error?.message ??
            (mode === 'assign'
              ? tr('Không thể cấp phát tài sản.', 'Unable to assign asset.')
              : tr('Không thể thu hồi tài sản.', 'Unable to return asset.')),
        );
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setErrorMessage(tr('Lỗi kết nối máy chủ.', 'Server connection error.'));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {mode === 'assign'
                ? tr('Cấp phát Tài sản cho Nhân viên', 'Assign Asset to Employee')
                : tr('Thu hồi Tài sản về Kho', 'Return Asset to Inventory')}
            </h2>
            <p className="text-xs text-slate-500">
              {asset.assetCode} — {asset.name}
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

          {mode === 'assign' ? (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Nhân viên tiếp nhận *', 'Recipient Employee *')}
              </span>
              {isLoadingEmployees ? (
                <div role="status" aria-busy="true" aria-label="Loading employees">
                  <Skeleton className="h-10 w-full" rounded="sm" />
                  <span className="sr-only">Loading</span>
                </div>
              ) : (
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">
                    {tr('-- Chọn nhân viên đang làm việc --', '-- Select active employee --')}
                  </option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} — {emp.fullName} ({emp.departmentName})
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div>
                <span className="font-semibold">
                  {tr('Người đang sử dụng:', 'Current holder:')}
                </span>{' '}
                {asset.holderEmployeeCode} — {asset.holderEmployeeName}
              </div>
              {asset.assignedAt && (
                <div className="mt-0.5 text-slate-500">
                  {tr('Ngày cấp phát:', 'Assigned date:')} {asset.assignedAt}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {mode === 'assign'
                  ? tr('Ngày bàn giao', 'Handover Date')
                  : tr('Ngày thu hồi', 'Return Date')}
              </span>
              <input
                type="date"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            {mode === 'assign' ? (
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">
                  {tr('Ngày dự kiến trả (nếu mượn)', 'Expected Return Date (if borrowed)')}
                </span>
                <input
                  type="date"
                  value={expectedReturnAt}
                  onChange={(e) => setExpectedReturnAt(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
            ) : (
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">
                  {tr('Trạng thái sau thu hồi *', 'Status After Return *')}
                </span>
                <select
                  value={nextStatus}
                  onChange={(e) =>
                    setNextStatus(
                      e.target.value as 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED',
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="AVAILABLE">
                    {tr('Sẵn sàng cấp phát lại', 'Available for reassignment')}
                  </option>
                  <option value="MAINTENANCE">
                    {tr('Chuyển bảo trì / Sửa chữa', 'Send to Maintenance / Repair')}
                  </option>
                  <option value="RETIRED">
                    {tr('Thanh lý / Hỏng không dùng nữa', 'Retired / Damaged beyond use')}
                  </option>
                </select>
              </label>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {mode === 'assign'
                ? tr('Tình trạng thiết bị lúc bàn giao *', 'Asset Condition on Assignment *')
                : tr('Tình trạng thiết bị lúc thu hồi *', 'Asset Condition on Return *')}
            </span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={300}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {tr('Ghi chú bàn giao', 'Handover Notes')}
            </span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr(
                'Ghi chú thêm về phụ kiện, cam kết...',
                'Additional notes on accessories, commitments...',
              )}
              maxLength={2000}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (mode === 'assign' && isLoadingEmployees)}
              className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                mode === 'assign'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting
                ? tr('Đang xử lý...', 'Processing...')
                : mode === 'assign'
                  ? tr('Xác nhận cấp phát', 'Confirm Assignment')
                  : tr('Xác nhận thu hồi', 'Confirm Return')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
