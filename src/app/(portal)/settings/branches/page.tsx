'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  IconBuilding,
  IconEdit,
  IconInbox,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { PaginationMeta } from '@/lib/portable/pagination';
import { useI18n } from '@/shared/i18n/I18nContext';

interface BranchRow {
  id: number;
  code: string;
  name: string;
  taxCode: string | null;
  address: string | null;
  phone: string | null;
  isHeadquarters: boolean;
  isActive: boolean;
}

interface BranchFormState {
  code: string;
  name: string;
  taxCode: string;
  address: string;
  phone: string;
  isHeadquarters: boolean;
  isActive: boolean;
}

const ERR_LOAD_BRANCHES = '__ERR_LOAD_BRANCHES__';
const ERR_NETWORK_BRANCHES = '__ERR_NETWORK_BRANCHES__';

const EMPTY_FORM: BranchFormState = {
  code: '',
  name: '',
  taxCode: '',
  address: '',
  phone: '',
  isHeadquarters: false,
  isActive: true,
};

export default function BranchesSettingsPage() {
  const { tr } = useI18n();
  const { hasPermission } = usePortalAuth();
  const canCreate = hasPermission('core.branches.create');
  const canUpdate = hasPermission('core.branches.update');
  const canDelete = hasPermission('core.branches.delete');

  const [items, setItems] = useState<BranchRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
  const [form, setForm] = useState<BranchFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [deletingBranch, setDeletingBranch] = useState<BranchRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    }
    if (activeFilter) {
      params.set('isActive', activeFilter);
    }

    fetch(`/api/v1/core/branches?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: BranchRow[];
          meta?: PaginationMeta;
          error?: { message?: string };
        } | null;
        if (controller.signal.aborted) {
          return;
        }
        if (!res.ok || !json?.success) {
          setErrorMessage(json?.error?.message ?? ERR_LOAD_BRANCHES);
          setViewState('error');
          return;
        }
        setItems(json.data ?? []);
        setMeta(json.meta ?? null);
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(ERR_NETWORK_BRANCHES);
        setViewState('error');
      });

    return () => controller.abort();
  }, [page, debouncedSearch, activeFilter, reloadTick]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  function openCreateModal() {
    setEditingBranch(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  }

  function openEditModal(branch: BranchRow) {
    setEditingBranch(branch);
    setForm({
      code: branch.code,
      name: branch.name,
      taxCode: branch.taxCode ?? '',
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      isHeadquarters: branch.isHeadquarters,
      isActive: branch.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  }

  async function handleSaveBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);

    try {
      const url = editingBranch
        ? `/api/v1/core/branches/${editingBranch.id}`
        : '/api/v1/core/branches';
      const method = editingBranch ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          taxCode: form.taxCode.trim() || null,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          isHeadquarters: form.isHeadquarters,
          isActive: form.isActive,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setFormError(
          json?.error?.message ?? tr('Không thể lưu chi nhánh.', 'Unable to save branch.'),
        );
        return;
      }

      setIsModalOpen(false);
      triggerReload();
    } catch {
      setFormError(
        tr(
          'Lỗi kết nối máy chủ khi lưu chi nhánh.',
          'Server connection error while saving branch.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingBranch) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/core/branches/${deletingBranch.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ?? tr('Không thể xóa chi nhánh.', 'Unable to delete branch.'),
        );
        setViewState('error');
        setDeletingBranch(null);
        return;
      }
      setDeletingBranch(null);
      triggerReload();
    } catch {
      setErrorMessage(
        tr(
          'Lỗi kết nối máy chủ khi xóa chi nhánh.',
          'Server connection error while deleting branch.',
        ),
      );
      setViewState('error');
      setDeletingBranch(null);
    } finally {
      setIsDeleting(false);
    }
  }

  const resolvedErrorMessage =
    errorMessage === ERR_LOAD_BRANCHES
      ? tr('Không thể tải danh sách chi nhánh.', 'Unable to load branches.')
      : errorMessage === ERR_NETWORK_BRANCHES
        ? tr(
            'Lỗi kết nối khi tải danh sách chi nhánh.',
            'Connection error while loading branches.',
          )
        : errorMessage;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Quản lý Chi nhánh', 'Branches')}
          </h1>
          <p className="text-sm text-slate-500">
            {tr(
              'Cấu hình trụ sở chính và các chi nhánh/văn phòng thuộc doanh nghiệp.',
              'Configure company headquarters and branch offices.',
            )}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <IconPlus size={18} />
            <span>{tr('Thêm chi nhánh', 'Add Branch')}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder={tr('Tìm theo mã hoặc tên chi nhánh...', 'Search by branch code or name...')}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
            setViewState('loading');
          }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="">{tr('Tất cả trạng thái', 'All statuses')}</option>
          <option value="true">{tr('Đang hoạt động', 'Active')}</option>
          <option value="false">{tr('Ngừng hoạt động', 'Inactive')}</option>
        </select>
      </div>

      {viewState === 'loading' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {viewState === 'error' && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-6 sm:flex-row">
          <p className="text-sm font-medium text-rose-700">{resolvedErrorMessage}</p>
          <button
            type="button"
            onClick={triggerReload}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            <IconRefresh size={16} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      )}

      {viewState === 'success' && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <IconInbox size={36} className="text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-800">
            {tr('Không tìm thấy chi nhánh nào', 'No branches found')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tr(
              'Thử đổi bộ lọc tìm kiếm hoặc thêm chi nhánh mới cho doanh nghiệp.',
              'Try adjusting your search filters or add a new branch.',
            )}
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <IconPlus size={15} />
              <span>{tr('Thêm chi nhánh', 'Add Branch')}</span>
            </button>
          )}
        </div>
      )}

      {viewState === 'success' && items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('Mã', 'Code')}</th>
                  <th className="px-4 py-3">{tr('Tên chi nhánh', 'Branch Name')}</th>
                  <th className="px-4 py-3">{tr('MST / Điện thoại', 'Tax ID / Phone')}</th>
                  <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                      {branch.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <IconBuilding size={16} className="shrink-0 text-slate-400" />
                        <span>{branch.name}</span>
                        {branch.isHeadquarters && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            {tr('Trụ sở chính', 'Headquarters')}
                          </span>
                        )}
                      </div>
                      {branch.address && (
                        <div className="mt-0.5 truncate text-xs text-slate-500" title={branch.address}>
                          {branch.address}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      <div>
                        {tr('MST', 'Tax ID')}: {branch.taxCode ?? '-'}
                      </div>
                      <div>
                        {tr('ĐT', 'Phone')}: {branch.phone ?? '-'}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          branch.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {branch.isActive
                          ? tr('Đang hoạt động', 'Active')
                          : tr('Ngừng hoạt động', 'Inactive')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => openEditModal(branch)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                            title={tr('Chỉnh sửa', 'Edit')}
                          >
                            <IconEdit size={16} />
                          </button>
                        )}
                        {canDelete && !branch.isHeadquarters && (
                          <button
                            type="button"
                            onClick={() => setDeletingBranch(branch)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                            title={tr('Xóa mềm', 'Soft delete')}
                          >
                            <IconTrash size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
              <span>
                {tr(
                  `Trang ${meta.page}/${meta.totalPages} (Tổng ${meta.total} chi nhánh)`,
                  `Page ${meta.page}/${meta.totalPages} (${meta.total} branches)`,
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!meta.hasPrev}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    setViewState('loading');
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
                >
                  {tr('Trước', 'Previous')}
                </button>
                <button
                  type="button"
                  disabled={!meta.hasNext}
                  onClick={() => {
                    setPage((p) => p + 1);
                    setViewState('loading');
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
                >
                  {tr('Sau', 'Next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingBranch
                  ? tr('Cập nhật Chi nhánh', 'Edit Branch')
                  : tr('Thêm Chi nhánh mới', 'Add New Branch')}
              </h2>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveBranch(e)} className="mt-4 space-y-3.5">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Mã chi nhánh *', 'Branch Code *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tr('VD: HN-01', 'e.g. HQ-01')}
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Tên chi nhánh *', 'Branch Name *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tr('VD: Chi nhánh Hà Nội', 'e.g. Hanoi Branch')}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Mã số thuế', 'Tax ID')}
                  </label>
                  <input
                    type="text"
                    value={form.taxCode}
                    onChange={(e) => setForm((f) => ({ ...f, taxCode: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Điện thoại', 'Phone')}
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Địa chỉ', 'Address')}
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-5 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isHeadquarters}
                    onChange={(e) => setForm((f) => ({ ...f, isHeadquarters: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{tr('Đặt làm Trụ sở chính', 'Set as Headquarters')}</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{tr('Đang hoạt động', 'Active')}</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving ? tr('Đang lưu...', 'Saving...') : tr('Lưu chi nhánh', 'Save Branch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingBranch)}
        title={tr('Xác nhận xóa mềm chi nhánh', 'Confirm Branch Deletion')}
        description={tr(
          `Bạn có chắc chắn muốn ngừng và ẩn chi nhánh "${deletingBranch?.name ?? ''}" (${deletingBranch?.code ?? ''})?`,
          `Are you sure you want to deactivate and archive branch "${deletingBranch?.name ?? ''}" (${deletingBranch?.code ?? ''})?`,
        )}
        confirmLabel={tr('Xóa chi nhánh', 'Delete Branch')}
        isProcessing={isDeleting}
        onCancel={() => setDeletingBranch(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
