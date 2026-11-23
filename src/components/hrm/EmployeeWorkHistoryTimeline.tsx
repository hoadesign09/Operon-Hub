'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  IconArrowRight,
  IconHistory,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import type {
  BranchOption,
  DepartmentOption,
  PositionOption,
} from '@/components/hrm/EmployeeFormModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';

export interface WorkHistoryView {
  id: number;
  employeeId: number;
  changeType: 'HIRE' | 'PROMOTION' | 'TRANSFER' | 'SALARY_ADJUST' | 'TERMINATION';
  effectiveDate: string;
  decisionNo: string | null;
  fromBranchName: string | null;
  toBranchName: string | null;
  fromDepartmentName: string | null;
  toDepartmentName: string | null;
  fromPositionName: string | null;
  toPositionName: string | null;
  fromSalary: number | null;
  toSalary: number | null;
  note: string | null;
}

const CHANGE_TYPE_META: Record<
  WorkHistoryView['changeType'],
  { label: string; badgeClass: string; dotClass: string }
> = {
  HIRE: {
    label: 'Tuyển dụng',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    dotClass: 'bg-emerald-500',
  },
  PROMOTION: {
    label: 'Bổ nhiệm / Thăng chức',
    badgeClass: 'bg-blue-50 text-blue-700',
    dotClass: 'bg-blue-600',
  },
  TRANSFER: {
    label: 'Điều chuyển công tác',
    badgeClass: 'bg-indigo-50 text-indigo-700',
    dotClass: 'bg-indigo-600',
  },
  SALARY_ADJUST: {
    label: 'Điều chỉnh lương',
    badgeClass: 'bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-500',
  },
  TERMINATION: {
    label: 'Quyết định thôi việc',
    badgeClass: 'bg-rose-50 text-rose-700',
    dotClass: 'bg-rose-600',
  },
};

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface EmployeeWorkHistoryTimelineProps {
  employeeId: number;
  canManage: boolean;
  branches?: BranchOption[];
  departments?: DepartmentOption[];
  positions?: PositionOption[];
  onProfileSynced?: () => void;
}

export function EmployeeWorkHistoryTimeline({
  employeeId,
  canManage,
  branches = [],
  departments = [],
  positions = [],
  onProfileSynced,
}: EmployeeWorkHistoryTimelineProps) {
  const [items, setItems] = useState<WorkHistoryView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [changeType, setChangeType] = useState<WorkHistoryView['changeType']>('PROMOTION');
  const [effectiveDate, setEffectiveDate] = useState(getTodayIso);
  const [decisionNo, setDecisionNo] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [toDepartmentId, setToDepartmentId] = useState('');
  const [toPositionId, setToPositionId] = useState('');
  const [fromSalary, setFromSalary] = useState('');
  const [toSalary, setToSalary] = useState('');
  const [note, setNote] = useState('');
  const [syncToEmployeeProfile, setSyncToEmployeeProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingItem, setDeletingItem] = useState<WorkHistoryView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/hrm/employees/${employeeId}/work-histories`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: WorkHistoryView[];
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? 'Không thể tải quá trình công tác.');
        }
        setItems(json.data ?? []);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [employeeId, reloadTick]);

  function reload() {
    setIsLoading(true);
    setReloadTick((t) => t + 1);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/v1/hrm/employees/${employeeId}/work-histories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeType,
          effectiveDate,
          decisionNo: decisionNo.trim() || null,
          toBranchId: toBranchId ? Number(toBranchId) : null,
          toDepartmentId: toDepartmentId ? Number(toDepartmentId) : null,
          toPositionId: toPositionId ? Number(toPositionId) : null,
          fromSalary: fromSalary ? Number(fromSalary) : null,
          toSalary: toSalary ? Number(toSalary) : null,
          note: note.trim() || null,
          syncToEmployeeProfile,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setFormError(json.error?.message ?? 'Không thể ghi nhận quyết định công tác.');
        return;
      }

      setShowForm(false);
      setDecisionNo('');
      setNote('');
      setFromSalary('');
      setToSalary('');
      reload();
      if (syncToEmployeeProfile && onProfileSynced) {
        onProfileSynced();
      }
    } catch {
      setFormError('Lỗi kết nối khi lưu quyết định.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingItem || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/hrm/work-histories/${deletingItem.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeletingItem(null);
        reload();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  const filteredDepts = toBranchId
    ? departments.filter((d) => d.branchId === Number(toBranchId))
    : departments;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((n) => (
          <div key={n} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 text-center">
        <p className="text-sm text-rose-700">{errorMessage}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <IconRefresh size={14} />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconPlus size={15} />
            <span>{showForm ? 'Ẩn biểu mẫu' : 'Ghi nhận quyết định mới'}</span>
          </button>
        </div>
      )}

      {canManage && showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
        >
          <div className="text-sm font-bold text-slate-900">
            Tạo Quyết định Biến động Công tác
          </div>
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Loại biến động</label>
              <select
                value={changeType}
                onChange={(e) =>
                  setChangeType(e.target.value as WorkHistoryView['changeType'])
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                {Object.entries(CHANGE_TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Ngày hiệu lực</label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Số quyết định</label>
              <input
                type="text"
                value={decisionNo}
                onChange={(e) => setDecisionNo(e.target.value)}
                placeholder="VD: QD-BN-2026-01"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>

            {(changeType === 'PROMOTION' || changeType === 'TRANSFER') && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Chi nhánh mới
                  </label>
                  <select
                    value={toBranchId}
                    onChange={(e) => {
                      setToBranchId(e.target.value);
                      setToDepartmentId('');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Giữ nguyên --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Phòng ban mới
                  </label>
                  <select
                    value={toDepartmentId}
                    onChange={(e) => setToDepartmentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Giữ nguyên --</option>
                    {filteredDepts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Chức danh mới
                  </label>
                  <select
                    value={toPositionId}
                    onChange={(e) => setToPositionId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Giữ nguyên --</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {(changeType === 'SALARY_ADJUST' || changeType === 'PROMOTION') && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Mức lương cũ (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={fromSalary}
                    onChange={(e) => setFromSalary(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Mức lương mới (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={toSalary}
                    onChange={(e) => setToSalary(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">Ghi chú</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mô tả lý do điều chuyển / bổ nhiệm / tăng lương..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={syncToEmployeeProfile}
              onChange={(e) => setSyncToEmployeeProfile(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <span>
              Tự động đồng bộ Chi nhánh / Phòng ban / Chức danh (hoặc trạng thái Thôi việc) về Hồ
              sơ nhân viên
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu quyết định'}</span>
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <IconHistory size={32} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Chưa có lịch sử quá trình công tác nào
          </p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6">
          {items.map((item) => {
            const meta = CHANGE_TYPE_META[item.changeType];
            return (
              <li key={item.id} className="relative rounded-2xl border border-slate-200 bg-white p-4">
                <span
                  className={`absolute top-5 -left-[33px] h-3.5 w-3.5 rounded-full ring-4 ring-white ${meta.dotClass}`}
                />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        Hiệu lực: {formatDateVN(item.effectiveDate)}
                      </span>
                      {item.decisionNo && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                          {item.decisionNo}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {(item.fromDepartmentName || item.toDepartmentName) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-400">Phòng ban:</span>
                          {item.fromDepartmentName && <span>{item.fromDepartmentName}</span>}
                          {item.fromDepartmentName && item.toDepartmentName && (
                            <IconArrowRight size={13} className="text-slate-400" />
                          )}
                          {item.toDepartmentName && (
                            <strong className="text-slate-900">{item.toDepartmentName}</strong>
                          )}
                        </div>
                      )}
                      {(item.fromPositionName || item.toPositionName) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-400">Chức danh:</span>
                          {item.fromPositionName && <span>{item.fromPositionName}</span>}
                          {item.fromPositionName && item.toPositionName && (
                            <IconArrowRight size={13} className="text-slate-400" />
                          )}
                          {item.toPositionName && (
                            <strong className="text-slate-900">{item.toPositionName}</strong>
                          )}
                        </div>
                      )}
                      {(item.fromSalary !== null || item.toSalary !== null) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-400">Mức lương:</span>
                          {item.fromSalary !== null && <span>{formatVND(item.fromSalary)}</span>}
                          {item.fromSalary !== null && item.toSalary !== null && (
                            <IconArrowRight size={13} className="text-slate-400" />
                          )}
                          {item.toSalary !== null && (
                            <strong className="text-emerald-700">{formatVND(item.toSalary)}</strong>
                          )}
                        </div>
                      )}
                      {item.note && <p className="pt-1 text-slate-500">{item.note}</p>}
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                      title="Xóa bản ghi"
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmModal
        isOpen={deletingItem !== null}
        title="Xác nhận xóa quyết định công tác"
        description="Bạn có chắc muốn xóa mềm bản ghi quá trình công tác này?"
        confirmLabel="Xóa bản ghi"
        isProcessing={isDeleting}
        onCancel={() => setDeletingItem(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
