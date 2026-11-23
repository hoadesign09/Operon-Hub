'use client';

import { useState, type FormEvent } from 'react';
import {
  IconFileCertificate,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

export interface ContractEmployeeOption {
  id: number;
  employeeCode: string;
  fullName: string;
}

export interface AllowanceDraft {
  code: string;
  label: string;
  amount: string;
}

export interface EditableContractData {
  id: number;
  employeeId: number;
  contractNo: string;
  contractType: 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'PART_TIME';
  startDate: string;
  endDate: string | null;
  baseSalary: number;
  insuranceSalary: number;
  allowances: Array<{ code: string; label: string; amount: number }>;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  signedDate: string | null;
  note: string | null;
}

interface ContractFormModalProps {
  isOpen: boolean;
  employees?: ContractEmployeeOption[];
  fixedEmployeeId?: number;
  editingContract?: EditableContractData | null;
  onClose: () => void;
  onSaved: () => void;
}

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function ContractFormModal({
  isOpen,
  employees = [],
  fixedEmployeeId,
  editingContract = null,
  onClose,
  onSaved,
}: ContractFormModalProps) {
  const isEdit = editingContract !== null;
  const [employeeId, setEmployeeId] = useState<number>(
    editingContract?.employeeId ?? fixedEmployeeId ?? employees[0]?.id ?? 0,
  );
  const [contractNo, setContractNo] = useState(editingContract?.contractNo ?? '');
  const [contractType, setContractType] = useState<
    'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'PART_TIME'
  >(editingContract?.contractType ?? 'FIXED_TERM');
  const [startDate, setStartDate] = useState(editingContract?.startDate ?? getTodayIso());
  const [endDate, setEndDate] = useState(editingContract?.endDate ?? '');
  const [baseSalary, setBaseSalary] = useState(
    editingContract ? String(editingContract.baseSalary) : '15000000',
  );
  const [insuranceSalary, setInsuranceSalary] = useState(
    editingContract ? String(editingContract.insuranceSalary) : '10000000',
  );
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED'>(
    editingContract?.status ?? 'ACTIVE',
  );
  const [signedDate, setSignedDate] = useState(editingContract?.signedDate ?? '');
  const [note, setNote] = useState(editingContract?.note ?? '');
  const [autoClosePreviousActive, setAutoClosePreviousActive] = useState(true);
  const [allowances, setAllowances] = useState<AllowanceDraft[]>(
    editingContract
      ? editingContract.allowances.map((a) => ({
          code: a.code,
          label: a.label,
          amount: String(a.amount),
        }))
      : [{ code: 'MEAL', label: 'Phụ cấp ăn trưa', amount: '1000000' }],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const effectiveEmployeeId =
    fixedEmployeeId ??
    (employeeId && employees.some((e) => e.id === employeeId)
      ? employeeId
      : (employees[0]?.id ?? 0));

  function addAllowanceRow() {
    setAllowances((prev) => [...prev, { code: '', label: '', amount: '0' }]);
  }

  function removeAllowanceRow(idx: number) {
    setAllowances((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const cleanedAllowances = allowances
        .filter((a) => a.code.trim().length > 0 && a.label.trim().length > 0)
        .map((a) => ({
          code: a.code.trim().toUpperCase(),
          label: a.label.trim(),
          amount: Number(a.amount) || 0,
        }));

      const payload: Record<string, unknown> = {
        contractNo: contractNo.trim().toUpperCase(),
        contractType,
        startDate,
        endDate: contractType === 'INDEFINITE' ? null : endDate || null,
        baseSalary: Number(baseSalary) || 0,
        insuranceSalary: Number(insuranceSalary) || 0,
        allowances: cleanedAllowances,
        status,
        signedDate: signedDate || null,
        note: note.trim() || null,
        autoClosePreviousActive,
      };

      if (!isEdit) {
        payload.employeeId = effectiveEmployeeId;
      }

      const url = isEdit
        ? `/api/v1/hrm/contracts/${editingContract.id}`
        : fixedEmployeeId
          ? `/api/v1/hrm/employees/${fixedEmployeeId}/contracts`
          : '/api/v1/hrm/contracts';

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
        setErrorMessage(json.error?.message ?? 'Không thể lưu hợp đồng lao động.');
        return;
      }

      onSaved();
    } catch {
      setErrorMessage('Lỗi kết nối khi lưu hợp đồng lao động.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconFileCertificate size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isEdit ? 'Cập nhật Hợp đồng Lao động' : 'Tạo Hợp đồng Lao động mới'}
              </h2>
              <p className="text-xs text-slate-500">
                Thiết lập thời hạn, lương cơ bản, lương đóng BHXH và các khoản phụ cấp
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
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
            {!fixedEmployeeId && !isEdit && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Nhân viên <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={effectiveEmployeeId}
                  onChange={(e) => setEmployeeId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} — {emp.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Số hợp đồng <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={contractNo}
                onChange={(e) => setContractNo(e.target.value.toUpperCase())}
                placeholder="VD: HDLD-2026-004"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Loại hợp đồng <span className="text-rose-500">*</span>
              </label>
              <select
                value={contractType}
                onChange={(e) =>
                  setContractType(
                    e.target.value as 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'PART_TIME',
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="PROBATION">Thử việc</option>
                <option value="FIXED_TERM">Xác định thời hạn</option>
                <option value="INDEFINITE">Không xác định thời hạn</option>
                <option value="PART_TIME">Bán thời gian / CTV</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Ngày bắt đầu <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            {contractType !== 'INDEFINITE' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Ngày kết thúc{' '}
                  {(contractType === 'PROBATION' || contractType === 'FIXED_TERM') && (
                    <span className="text-rose-500">*</span>
                  )}
                </label>
                <input
                  type="date"
                  required={contractType === 'PROBATION' || contractType === 'FIXED_TERM'}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Lương cơ bản (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step="1000"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Lương đóng BHXH (VNĐ)
              </label>
              <input
                type="number"
                min={0}
                step="1000"
                value={insuranceSalary}
                onChange={(e) => setInsuranceSalary(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Trạng thái</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED')
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="DRAFT">Nháp</option>
                <option value="ACTIVE">Đang hiệu lực</option>
                <option value="EXPIRED">Hết hạn</option>
                <option value="TERMINATED">Đã chấm dứt</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Ngày ký</label>
              <input
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-600">
                Các khoản phụ cấp hàng tháng
              </span>
              <button
                type="button"
                onClick={addAllowanceRow}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <IconPlus size={13} />
                <span>Thêm phụ cấp</span>
              </button>
            </div>

            {allowances.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có khoản phụ cấp nào.</p>
            ) : (
              <div className="space-y-2">
                {allowances.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Mã (MEAL)"
                      value={item.code}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setAllowances((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, code: val } : row)),
                        );
                      }}
                      className="col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase"
                    />
                    <input
                      type="text"
                      placeholder="Tên phụ cấp"
                      value={item.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAllowances((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, label: val } : row)),
                        );
                      }}
                      className="col-span-5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Số tiền"
                      value={item.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAllowances((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, amount: val } : row)),
                        );
                      }}
                      className="col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeAllowanceRow(idx)}
                      className="col-span-1 flex items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                      title="Xóa dòng"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Ghi chú</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {status === 'ACTIVE' && (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={autoClosePreviousActive}
                onChange={(e) => setAutoClosePreviousActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>
                Tự động chuyển hợp đồng <strong>Đang hiệu lực</strong> trước đó của nhân viên sang{' '}
                <strong>Hết hạn</strong>
              </span>
            </label>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isEdit && effectiveEmployeeId === 0)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>{isSubmitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo hợp đồng'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
