'use client';

import { useEffect, useRef, useState } from 'react';
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
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface EmployeeContractView extends EditableContractData {
  totalAllowances: number;
  expiryLevel: 'NONE' | 'OVERDUE' | 'URGENT_15D' | 'WARNING_30D' | 'SAFE';
  daysRemaining: number | null;
}

const TYPE_LABELS: Record<EmployeeContractView['contractType'], { vi: string; en: string }> = {
  PROBATION: { vi: 'Thử việc', en: 'Probation' },
  FIXED_TERM: { vi: 'Xác định thời hạn', en: 'Fixed-Term' },
  INDEFINITE: { vi: 'Không thời hạn', en: 'Indefinite' },
  PART_TIME: { vi: 'Bán thời gian / CTV', en: 'Part-Time / Contractor' },
};

const STATUS_STYLES: Record<
  EmployeeContractView['status'],
  { vi: string; en: string; className: string }
> = {
  DRAFT: { vi: 'Nháp', en: 'Draft', className: 'bg-slate-100 text-slate-600' },
  ACTIVE: { vi: 'Đang hiệu lực', en: 'Active', className: 'bg-emerald-50 text-emerald-700' },
  EXPIRED: { vi: 'Hết hạn', en: 'Expired', className: 'bg-amber-50 text-amber-700' },
  TERMINATED: { vi: 'Đã chấm dứt', en: 'Terminated', className: 'bg-rose-50 text-rose-700' },
};

interface EmployeeContractsPanelProps {
  employeeId: number;
  canManage: boolean;
}

export function EmployeeContractsPanel({
  employeeId,
  canManage,
}: EmployeeContractsPanelProps) {
  const { locale, tr } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

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
          throw new Error(
            json.error?.message ??
              trRef.current(
                'Không thể tải danh sách hợp đồng.',
                'Failed to load labor contracts.',
              ),
          );
        }
        setContracts(json.data ?? []);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi kết nối.', 'Connection error.'),
        );
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
      <SkeletonCardGrid
        count={2}
        columnsClass="grid-cols-1 gap-3"
        lines={2}
        showBadge
        showFooter
      />
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
          <span>{tr('Thử lại', 'Retry')}</span>
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
            <span>{tr('Thêm hợp đồng mới', 'Add Labor Contract')}</span>
          </button>
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <IconFileCertificate size={32} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            {tr(
              'Chưa có hợp đồng lao động nào được ghi nhận',
              'No labor contracts recorded yet',
            )}
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
                        {locale === 'en'
                          ? TYPE_LABELS[contract.contractType].en
                          : TYPE_LABELS[contract.contractType].vi}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.className}`}>
                        {locale === 'en' ? st.en : st.vi}
                      </span>
                      {contract.expiryLevel === 'OVERDUE' && (
                        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                          {tr(
                            `Quá hạn ${Math.abs(contract.daysRemaining ?? 0)} ngày`,
                            `Overdue by ${Math.abs(contract.daysRemaining ?? 0)} days`,
                          )}
                        </span>
                      )}
                      {contract.expiryLevel === 'URGENT_15D' && (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                          {tr(
                            `Sắp hết hạn (${contract.daysRemaining} ngày)`,
                            `Expiring soon (${contract.daysRemaining} days)`,
                          )}
                        </span>
                      )}
                      {contract.expiryLevel === 'WARNING_30D' && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          {tr(
                            `Còn ${contract.daysRemaining} ngày`,
                            `${contract.daysRemaining} days left`,
                          )}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500">
                      {tr('Hiệu lực:', 'Effective:')}{' '}
                      <strong>{formatDateVN(contract.startDate)}</strong> →{' '}
                      <strong>
                        {contract.endDate
                          ? formatDateVN(contract.endDate)
                          : tr('Không xác định thời hạn', 'Indefinite')}
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
                        <span>{tr('Sửa', 'Edit')}</span>
                      </button>
                      <button
                        type="button"
                        title={tr('Xóa hợp đồng', 'Delete contract')}
                        aria-label={tr('Xóa hợp đồng', 'Delete contract')}
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
                    <span className="text-slate-500">
                      {tr('Lương cơ bản: ', 'Base Salary: ')}
                    </span>
                    <strong className="text-slate-900">{formatVND(contract.baseSalary)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      {tr('Lương đóng BHXH: ', 'Insurance Salary: ')}
                    </span>
                    <strong className="text-slate-900">
                      {formatVND(contract.insuranceSalary)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      {tr('Tổng phụ cấp: ', 'Total Allowances: ')}
                    </span>
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
        title={tr('Xác nhận xóa hợp đồng lao động', 'Confirm Contract Deletion')}
        description={
          deletingContract
            ? tr(
                `Bạn có chắc muốn xóa mềm hợp đồng "${deletingContract.contractNo}"?`,
                `Are you sure you want to delete contract "${deletingContract.contractNo}"?`,
              )
            : ''
        }
        confirmLabel={tr('Xóa hợp đồng', 'Delete Contract')}
        isProcessing={isDeleting}
        onCancel={() => setDeletingContract(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
