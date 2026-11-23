'use client';

import { useEffect, useState } from 'react';
import {
  IconEdit,
  IconFileCertificate,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import {
  ContractFormModal,
  type EditableContractData,
} from '@/components/hrm/ContractFormModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';

export interface EmployeeContractView extends EditableContractData {
  totalAllowances: number;
  expiryLevel: 'NONE' | 'OVERDUE' | 'URGENT_15D' | 'WARNING_30D' | 'SAFE';
  daysRemaining: number | null;
}

const TYPE_LABELS: Record<EmployeeContractView['contractType'], string> = {
  PROBATION: 'Thử việc',
  FIXED_TERM: 'Xác định thời hạn',
  INDEFINITE: 'Không thời hạn',
  PART_TIME: 'Bán thời gian / CTV',
};

const STATUS_STYLES: Record<
  EmployeeContractView['status'],
  { label: string; className: string }
> = {
  DRAFT: { label: 'Nháp', className: 'bg-slate-100 text-slate-600' },
  ACTIVE: { label: 'Đang hiệu lực', className: 'bg-emerald-50 text-emerald-700' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-amber-50 text-amber-700' },
  TERMINATED: { label: 'Đã chấm dứt', className: 'bg-rose-50 text-rose-700' },
};

interface EmployeeContractsPanelProps {
  employeeId: number;
  canManage: boolean;
}

export function EmployeeContractsPanel({
  employeeId,
  canManage,
}: EmployeeContractsPanelProps) {
  const [contracts, setContracts] = useState<EmployeeContractView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<EditableContractData | null>(null);
  const [deletingContract, setDeletingContract] = useState<EmployeeContractView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/hrm/employees/${employeeId}/contracts`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: EmployeeContractView[];
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? 'Không thể tải danh sách hợp đồng.');
        }
        setContracts(json.data ?? []);
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

  async function handleDelete() {
    if (!deletingContract || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/hrm/contracts/${deletingContract.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeletingContract(null);
        reload();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((n) => (
          <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />
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
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditingContract(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconPlus size={15} />
            <span>Thêm hợp đồng mới</span>
          </button>
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <IconFileCertificate size={32} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Chưa có hợp đồng lao động nào được ghi nhận
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => {
            const st = STATUS_STYLES[contract.status];
            return (
              <div
                key={contract.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {contract.contractNo}
                      </span>
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {TYPE_LABELS[contract.contractType]}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.className}`}>
                        {st.label}
                      </span>
                      {contract.expiryLevel === 'OVERDUE' && (
                        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                          Quá hạn {Math.abs(contract.daysRemaining ?? 0)} ngày
                        </span>
                      )}
                      {contract.expiryLevel === 'URGENT_15D' && (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                          Sắp hết hạn ({contract.daysRemaining} ngày)
                        </span>
                      )}
                      {contract.expiryLevel === 'WARNING_30D' && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Còn {contract.daysRemaining} ngày
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500">
                      Hiệu lực: <strong>{formatDateVN(contract.startDate)}</strong> →{' '}
                      <strong>
                        {contract.endDate ? formatDateVN(contract.endDate) : 'Không xác định thời hạn'}
                      </strong>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingContract(contract);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <IconEdit size={14} />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingContract(contract)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
                  <div>
                    <span className="text-slate-500">Lương cơ bản: </span>
                    <strong className="text-slate-900">{formatVND(contract.baseSalary)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Lương đóng BHXH: </span>
                    <strong className="text-slate-900">
                      {formatVND(contract.insuranceSalary)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Tổng phụ cấp: </span>
                    <strong className="text-emerald-700">
                      {formatVND(contract.totalAllowances)}
                    </strong>
                  </div>
                </div>

                {contract.allowances.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {contract.allowances.map((a, idx) => (
                      <span
                        key={`${a.code}-${idx}`}
                        className="rounded-lg bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {a.label}: <strong>{formatVND(a.amount)}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <ContractFormModal
          key={editingContract ? `edit-${editingContract.id}` : 'create-new'}
          isOpen={isModalOpen}
          fixedEmployeeId={employeeId}
          editingContract={editingContract}
          onClose={() => {
            setIsModalOpen(false);
            setEditingContract(null);
          }}
          onSaved={() => {
            setIsModalOpen(false);
            setEditingContract(null);
            reload();
          }}
        />
      )}

      <ConfirmModal
        isOpen={deletingContract !== null}
        title="Xác nhận xóa hợp đồng lao động"
        description={
          deletingContract
            ? `Bạn có chắc muốn xóa mềm hợp đồng "${deletingContract.contractNo}"?`
            : ''
        }
        confirmLabel="Xóa hợp đồng"
        isProcessing={isDeleting}
        onCancel={() => setDeletingContract(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
