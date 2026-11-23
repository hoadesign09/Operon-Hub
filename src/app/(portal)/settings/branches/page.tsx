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
          setErrorMessage(json?.error?.message ?? 'Không thể tải danh sách chi nhánh.');
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
        setErrorMessage('Lỗi kết nối khi tải danh sách chi nhánh.');
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
        setFormError(json?.error?.message ?? 'Không thể lưu chi nhánh.');
        return;
      }

      setIsModalOpen(false);
      triggerReload();
    } catch {
      setFormError('Lỗi kết nối máy chủ khi lưu chi nhánh.');
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
        setErrorMessage(json?.error?.message ?? 'Không thể xóa chi nhánh.');
        setViewState('error');
        setDeletingBranch(null);
        return;
      }
      setDeletingBranch(null);
      triggerReload();
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ khi xóa chi nhánh.');
      setViewState('error');
      setDeletingBranch(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý Chi nhánh</h1>
          <p className="text-sm text-slate-500">
            Cấu hình trụ sở chính và các chi nhánh/văn phòng thuộc doanh nghiệp.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <IconPlus size={18} />
            <span>Thêm chi nhánh</span>
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
            placeholder="Tìm theo mã hoặc tên chi nhánh..."
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
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Ngừng hoạt động</option>
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
          <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={triggerReload}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            <IconRefresh size={16} />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {viewState === 'success' && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <IconInbox size={36} className="text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Không tìm thấy chi nhánh nào</p>
          <p className="mt-1 text-xs text-slate-500">
            Thử đổi bộ lọc tìm kiếm hoặc thêm chi nhánh mới cho doanh nghiệp.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <IconPlus size={15} />
              <span>Thêm chi nhánh</span>
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
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Tên chi nhánh</th>
                  <th className="px-4 py-3">MST / Điện thoại</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
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
                            Trụ sở chính
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
                      <div>MST: {branch.taxCode ?? '-'}</div>
                      <div>ĐT: {branch.phone ?? '-'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          branch.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {branch.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => openEditModal(branch)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                            title="Chỉnh sửa"
                          >
                            <IconEdit size={16} />
                          </button>
                        )}
                        {canDelete && !branch.isHeadquarters && (
                          <button
                            type="button"
                            onClick={() => setDeletingBranch(branch)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Xóa mềm"
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
                Trang {meta.page}/{meta.totalPages} (Tổng {meta.total} chi nhánh)
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
                  Trước
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
                  Sau
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
                {editingBranch ? 'Cập nhật Chi nhánh' : 'Thêm Chi nhánh mới'}
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
                    Mã chi nhánh *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: HN-01"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Tên chi nhánh *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Chi nhánh Hà Nội"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Mã số thuế</label>
                  <input
                    type="text"
                    value={form.taxCode}
                    onChange={(e) => setForm((f) => ({ ...f, taxCode: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Điện thoại</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Địa chỉ</label>
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
                  <span>Đặt làm Trụ sở chính</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Đang hoạt động</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu chi nhánh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingBranch)}
        title="Xác nhận xóa mềm chi nhánh"
        description={`Bạn có chắc chắn muốn ngừng và ẩn chi nhánh "${deletingBranch?.name ?? ''}" (${deletingBranch?.code ?? ''})?`}
        confirmLabel="Xóa chi nhánh"
        isProcessing={isDeleting}
        onCancel={() => setDeletingBranch(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
