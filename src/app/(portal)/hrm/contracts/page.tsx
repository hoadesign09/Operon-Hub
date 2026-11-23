'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconAlertTriangle,
  IconClockExclamation,
  IconEdit,
  IconFileCertificate,
  IconFileSpreadsheet,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import {
  ContractFormModal,
  type ContractEmployeeOption,
  type EditableContractData,
} from '@/components/hrm/ContractFormModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';

interface ContractRow extends EditableContractData {
  employeeCode: string;
  employeeName: string;
  branchName: string;
  departmentName: string;
  totalAllowances: number;
  expiryLevel: 'NONE' | 'OVERDUE' | 'URGENT_15D' | 'WARNING_30D' | 'SAFE';
  daysRemaining: number | null;
}

interface ExpirySummary {
  overdueCount: number;
  urgent15Count: number;
  warning30Count: number;
  totalAlertCount: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TYPE_LABELS: Record<ContractRow['contractType'], string> = {
  PROBATION: 'Thử việc',
  FIXED_TERM: 'Xác định thời hạn',
  INDEFINITE: 'Không thời hạn',
  PART_TIME: 'Bán thời gian',
};

const STATUS_BADGES: Record<ContractRow['status'], { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-slate-100 text-slate-600' },
  ACTIVE: { label: 'Đang hiệu lực', className: 'bg-emerald-50 text-emerald-700' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-amber-50 text-amber-700' },
  TERMINATED: { label: 'Đã chấm dứt', className: 'bg-rose-50 text-rose-700' },
};

export default function ContractsPage() {
  const { selectedBranchId, hasPermission } = usePortalAuth();
  const canManage = hasPermission('hrm.contracts.manage');
  const canExport = hasPermission('hrm.contracts.export');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expiryAlertFilter, setExpiryAlertFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<ExpirySummary>({
    overdueCount: 0,
    urgent15Count: 0,
    warning30Count: 0,
    totalAlertCount: 0,
  });
  const [employees, setEmployees] = useState<ContractEmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<EditableContractData | null>(null);
  const [deletingContract, setDeletingContract] = useState<ContractRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    fetch('/api/v1/hrm/employees?limit=100', { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.data)) {
          setEmployees(json.data as ContractEmployeeOption[]);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [canManage]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedBranchId) params.set('branchId', String(selectedBranchId));
    if (typeFilter) params.set('contractType', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (expiryAlertFilter) params.set('expiryAlert', expiryAlertFilter);

    const expParams = new URLSearchParams();
    expParams.set('days', '30');
    if (selectedBranchId) expParams.set('branchId', String(selectedBranchId));

    Promise.all([
      fetch(`/api/v1/hrm/contracts?${params.toString()}`, { signal: controller.signal }).then(
        async (res) => {
          const json = (await res.json()) as {
            success: boolean;
            data?: ContractRow[];
            meta?: PaginationMeta;
            error?: { message?: string };
          };
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message ?? 'Không thể tải danh sách hợp đồng.');
          }
          return json;
        },
      ),
      fetch(`/api/v1/hrm/contracts/expiring?${expParams.toString()}`, {
        signal: controller.signal,
      }).then((r) => r.json()),
    ])
      .then(([listJson, expJson]) => {
        setContracts(listJson.data ?? []);
        if (listJson.meta) setMeta(listJson.meta);
        if (expJson?.success && expJson.data?.summary) {
          setSummary(expJson.data.summary as ExpirySummary);
        }
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
  }, [
    page,
    debouncedSearch,
    selectedBranchId,
    typeFilter,
    statusFilter,
    expiryAlertFilter,
    reloadTick,
  ]);

  function reload() {
    setIsLoading(true);
    setReloadTick((t) => t + 1);
  }

  function toggleAlertFilter(level: string) {
    setIsLoading(true);
    setExpiryAlertFilter((prev) => (prev === level ? '' : level));
    setPage(1);
  }

  async function handleExportExcel() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedBranchId) params.set('branchId', String(selectedBranchId));
      if (typeFilter) params.set('contractType', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (expiryAlertFilter) params.set('expiryAlert', expiryAlertFilter);

      const res = await fetch(`/api/v1/hrm/contracts/export?${params.toString()}`);
      if (!res.ok) {
        setErrorMessage('Không thể xuất file Excel hợp đồng.');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? 'danh-sach-hop-dong.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleConfirmDelete() {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <IconFileCertificate size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hợp đồng Lao động</h1>
            <p className="text-sm text-slate-500">
              Theo dõi thời hạn hợp đồng, cảnh báo sắp hết hạn (15/30 ngày) và mức lương cơ bản
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canExport && (
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleExportExcel()}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              {isExporting ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconFileSpreadsheet size={16} />
              )}
              <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel (.xlsx)'}</span>
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingContract(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>Tạo hợp đồng</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => toggleAlertFilter('OVERDUE')}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
            expiryAlertFilter === 'OVERDUE'
              ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200'
              : 'border-rose-200 bg-white hover:bg-rose-50/40'
          }`}
        >
          <div>
            <div className="text-xs font-semibold uppercase text-rose-600">Đã quá hạn</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{summary.overdueCount}</div>
            <div className="text-xs text-slate-500">HĐ đang hiệu lực vượt ngày kết thúc</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <IconAlertTriangle size={20} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleAlertFilter('URGENT_15D')}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
            expiryAlertFilter === 'URGENT_15D'
              ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
              : 'border-orange-200 bg-white hover:bg-orange-50/40'
          }`}
        >
          <div>
            <div className="text-xs font-semibold uppercase text-orange-600">
              Khẩn cấp (≤ 15 ngày)
            </div>
            <div className="mt-1 text-2xl font-bold text-orange-700">{summary.urgent15Count}</div>
            <div className="text-xs text-slate-500">Cần làm thủ tục tái ký ngay</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <IconClockExclamation size={20} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleAlertFilter('WARNING_30D')}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
            expiryAlertFilter === 'WARNING_30D'
              ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
              : 'border-amber-200 bg-white hover:bg-amber-50/40'
          }`}
        >
          <div>
            <div className="text-xs font-semibold uppercase text-amber-600">
              Sắp hết hạn (16–30 ngày)
            </div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{summary.warning30Count}</div>
            <div className="text-xs text-slate-500">Chuẩn bị đánh giá gia hạn hợp đồng</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <IconFileCertificate size={20} />
          </div>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <IconSearch
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setIsLoading(true);
                setSearchInput(e.target.value);
              }}
              placeholder="Tìm số HĐ, Mã NV, Họ tên..."
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setIsLoading(true);
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Tất cả loại hợp đồng</option>
            <option value="PROBATION">Thử việc</option>
            <option value="FIXED_TERM">Xác định thời hạn</option>
            <option value="INDEFINITE">Không thời hạn</option>
            <option value="PART_TIME">Bán thời gian</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setIsLoading(true);
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hiệu lực</option>
            <option value="DRAFT">Nháp</option>
            <option value="EXPIRED">Hết hạn</option>
            <option value="TERMINATED">Đã chấm dứt</option>
          </select>

          <select
            value={expiryAlertFilter}
            onChange={(e) => {
              setIsLoading(true);
              setExpiryAlertFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Tất cả mức cảnh báo</option>
            <option value="ALL_ALERTS">Mọi HĐ quá hạn / sắp hết hạn ≤ 30 ngày</option>
            <option value="OVERDUE">Chỉ HĐ đã quá hạn</option>
            <option value="URGENT_15D">Chỉ HĐ ≤ 15 ngày</option>
            <option value="WARNING_30D">Chỉ HĐ 16–30 ngày</option>
          </select>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>Thử lại</span>
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <IconFileCertificate size={38} className="mx-auto text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            Không có hợp đồng lao động nào phù hợp bộ lọc
          </h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Số HĐ / Loại</th>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Thời hạn</th>
                  <th className="px-4 py-3 text-right">Lương cơ bản</th>
                  <th className="px-4 py-3 text-right">Phụ cấp</th>
                  <th className="px-4 py-3">Trạng thái & Cảnh báo</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((item) => {
                  const st = STATUS_BADGES[item.status];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-slate-900">
                          {item.contractNo}
                        </div>
                        <div className="text-xs text-slate-500">
                          {TYPE_LABELS[item.contractType]}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/hrm/employees/${item.employeeId}`}
                          className="font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {item.employeeName}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {item.employeeCode} • {item.departmentName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div>{formatDateVN(item.startDate)}</div>
                        <div className="text-slate-500">
                          → {item.endDate ? formatDateVN(item.endDate) : 'Không thời hạn'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatVND(item.baseSalary)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-emerald-700">
                        {formatVND(item.totalAllowances)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.className}`}
                          >
                            {st.label}
                          </span>
                          {item.expiryLevel === 'OVERDUE' && (
                            <span className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              Quá hạn {Math.abs(item.daysRemaining ?? 0)} ngày
                            </span>
                          )}
                          {item.expiryLevel === 'URGENT_15D' && (
                            <span className="rounded bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                              Còn {item.daysRemaining} ngày
                            </span>
                          )}
                          {item.expiryLevel === 'WARNING_30D' && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              Còn {item.daysRemaining} ngày
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContract(item);
                                setIsModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <IconEdit size={14} />
                              <span>Sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingContract(item)}
                              className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
            <div>
              Hiển thị <strong>{contracts.length}</strong> / <strong>{meta.total}</strong> hợp đồng
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setIsLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 disabled:opacity-50"
              >
                Trang trước
              </button>
              <span>
                Trang <strong>{meta.page}</strong> / {meta.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                onClick={() => {
                  setIsLoading(true);
                  setPage((p) => p + 1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 disabled:opacity-50"
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <ContractFormModal
          key={editingContract ? `edit-${editingContract.id}` : 'create-new'}
          isOpen={isModalOpen}
          employees={employees}
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
            ? `Bạn có chắc muốn xóa mềm hợp đồng "${deletingContract.contractNo}" của ${deletingContract.employeeName}?`
            : ''
        }
        confirmLabel="Xóa hợp đồng"
        isProcessing={isDeleting}
        onCancel={() => setDeletingContract(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
