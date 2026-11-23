'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  IconAlertCircle,
  IconCheck,
  IconEdit,
  IconEye,
  IconLoader2,
  IconPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSpeakerphone,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { AnnouncementDetailModal } from '@/components/hrm/AnnouncementDetailModal';
import { AnnouncementFormModal } from '@/components/hrm/AnnouncementFormModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { AnnouncementCategory, AnnouncementStatus } from '@/config/database';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import type {
  AnnouncementItem,
  AnnouncementStats,
} from '@/modules/hrm/office/announcements.service';

const CATEGORY_STYLE: Record<AnnouncementCategory, { label: string; cls: string }> = {
  GENERAL: { label: 'Thông báo chung', cls: 'bg-slate-100 text-slate-700' },
  HR_POLICY: { label: 'Chính sách HR', cls: 'bg-blue-50 text-blue-700' },
  EVENT: { label: 'Sự kiện nội bộ', cls: 'bg-emerald-50 text-emerald-700' },
  URGENT: { label: 'Khẩn cấp', cls: 'bg-rose-100 text-rose-700' },
};

const STATUS_STYLE: Record<AnnouncementStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Bản nháp', cls: 'bg-amber-50 text-amber-700' },
  PUBLISHED: { label: 'Đã xuất bản', cls: 'bg-emerald-50 text-emerald-700' },
  ARCHIVED: { label: 'Đã lưu trữ', cls: 'bg-slate-100 text-slate-500' },
};

export default function AnnouncementsPage() {
  const { user, selectedBranchId, hasPermission } = usePortalAuth();
  const canManage = hasPermission('hrm.announcements.manage');

  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [stats, setStats] = useState<AnnouncementStats>({
    total: 0,
    unreadCount: 0,
    pinnedCount: 0,
    urgentCount: 0,
  });

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null);
  const [viewingItem, setViewingItem] = useState<AnnouncementItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AnnouncementItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 4000);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const sp = new URLSearchParams({ limit: '50' });
        if (selectedBranchId) {
          sp.set('branchId', String(selectedBranchId));
        }
        if (categoryFilter) {
          sp.set('category', categoryFilter);
        }
        if (readFilter !== 'all') {
          sp.set('readFilter', readFilter);
        }
        if (canManage && statusFilter) {
          sp.set('status', statusFilter);
        }
        if (debouncedSearch) {
          sp.set('search', debouncedSearch);
        }

        const res = await fetch(`/api/v1/hrm/admin-ops/announcements?${sp.toString()}`, {
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: { items: AnnouncementItem[]; stats: AnnouncementStats };
          error?: { message?: string };
        } | null;

        if (!res.ok || !json?.success || !json.data) {
          throw new Error(json?.error?.message ?? 'Không thể tải danh sách thông báo nội bộ.');
        }

        setItems(json.data.items);
        setStats(json.data.stats);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(
          err instanceof Error ? err.message : 'Lỗi kết nối khi tải bản tin nội bộ.',
        );
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [canManage, categoryFilter, debouncedSearch, readFilter, reloadTick, selectedBranchId, statusFilter]);

  async function handlePublish(item: AnnouncementItem) {
    setActionBusyId(item.id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/hrm/admin-ops/announcements/${item.id}/publish`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setErrorMessage(json?.error?.message ?? 'Không thể xuất bản thông báo.');
        return;
      }
      showToast(`Đã xuất bản thông báo "${item.title}".`);
      setReloadTick((v) => v + 1);
    } catch {
      setErrorMessage('Lỗi kết nối khi xuất bản thông báo.');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleQuickMarkRead(item: AnnouncementItem) {
    setActionBusyId(item.id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/hrm/admin-ops/announcements/${item.id}/read`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setErrorMessage(json?.error?.message ?? 'Không thể đánh dấu đã đọc.');
        return;
      }
      showToast('Đã xác nhận đọc thông báo.');
      setReloadTick((v) => v + 1);
    } catch {
      setErrorMessage('Lỗi kết nối khi cập nhật trạng thái đọc.');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingItem) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/hrm/admin-ops/announcements/${deletingItem.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setErrorMessage(json?.error?.message ?? 'Không thể xóa thông báo.');
        return;
      }
      setDeletingItem(null);
      showToast('Đã xóa thông báo nội bộ.');
      setReloadTick((v) => v + 1);
    } catch {
      setErrorMessage('Lỗi kết nối khi xóa thông báo.');
    } finally {
      setIsDeleting(false);
    }
  }

  const handleMarkedReadFromModal = useCallback(() => {
    setReloadTick((v) => v + 1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bản tin & Thông báo Nội bộ</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cập nhật chính sách nhân sự, sự kiện và thông báo khẩn cấp từ doanh nghiệp & chi nhánh
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsFormModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <IconPlus size={17} />
            <span>Tạo thông báo mới</span>
          </button>
        )}
      </div>

      {toastMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {toastMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Tổng bản tin</span>
            <IconSpeakerphone size={18} className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Tin chưa đọc</span>
            <IconEye size={18} className="text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{stats.unreadCount}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Đang ghim</span>
            <IconPin size={18} className="text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.pinnedCount}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Thông báo khẩn</span>
            <IconAlertCircle size={18} className="text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600">{stats.urgentCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc nội dung thông báo..."
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="">Tất cả phân loại</option>
          <option value="GENERAL">Thông báo chung</option>
          <option value="HR_POLICY">Chính sách HR</option>
          <option value="EVENT">Sự kiện nội bộ</option>
          <option value="URGENT">Khẩn cấp</option>
        </select>

        <select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value as 'all' | 'unread' | 'read')}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="all">Tất cả trạng thái đọc</option>
          <option value="unread">Chưa đọc</option>
          <option value="read">Đã đọc</option>
        </select>

        {canManage && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">Mọi trạng thái tin</option>
            <option value="PUBLISHED">Đã xuất bản</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="ARCHIVED">Đã lưu trữ</option>
          </select>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setReloadTick((v) => v + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>Thử lại</span>
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Không có thông báo nội bộ nào phù hợp bộ lọc.</p>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsFormModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>Soạn thông báo mới</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const cat = CATEGORY_STYLE[item.category];
            const st = STATUS_STYLE[item.status];
            const isBusy = actionBusyId === item.id;

            return (
              <article
                key={item.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                  item.isPinned
                    ? 'border-amber-300 ring-1 ring-amber-100'
                    : item.status === 'PUBLISHED' && !item.isReadByMe
                      ? 'border-blue-200'
                      : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isPinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          <IconPin size={12} />
                          Ghim
                        </span>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cat.cls}`}>
                        {cat.label}
                      </span>
                      {canManage && (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {item.branchName ?? 'Toàn công ty'}
                      </span>
                      {item.status === 'PUBLISHED' &&
                        (item.isReadByMe ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <IconCheck size={12} />
                            Đã đọc
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                            Mới • Chưa đọc
                          </span>
                        ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewingItem(item)}
                      className="block text-left text-base font-bold text-slate-900 hover:text-blue-600"
                    >
                      {item.title}
                    </button>

                    <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-600">
                      {item.content}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500">
                      <span>
                        Người đăng: <strong className="text-slate-700">{item.authorName}</strong>
                      </span>
                      <span>
                        {item.publishedAt
                          ? `Xuất bản: ${formatDateTimeVN(item.publishedAt)}`
                          : `Tạo lúc: ${formatDateTimeVN(item.createdAt)}`}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <IconUsers size={14} className="text-slate-400" />
                        <span>
                          Đã đọc: <strong>{item.readCount}</strong>/{item.targetEmployeeCount} (
                          {item.readRatePercent}%)
                        </span>
                      </span>
                    </div>

                    {/* Read rate progress bar */}
                    {item.status === 'PUBLISHED' && (
                      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{ width: `${Math.min(100, item.readRatePercent)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingItem(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <IconEye size={14} />
                      <span>Xem chi tiết</span>
                    </button>

                    {item.status === 'PUBLISHED' && !item.isReadByMe && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleQuickMarkRead(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {isBusy ? (
                          <IconLoader2 size={14} className="animate-spin" />
                        ) : (
                          <IconCheck size={14} />
                        )}
                        <span>Đã đọc</span>
                      </button>
                    )}

                    {canManage && item.status !== 'PUBLISHED' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handlePublish(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {isBusy ? (
                          <IconLoader2 size={14} className="animate-spin" />
                        ) : (
                          <IconSend size={14} />
                        )}
                        <span>Xuất bản</span>
                      </button>
                    )}

                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsFormModalOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                          title="Chỉnh sửa thông báo"
                        >
                          <IconEdit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem(item)}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                          title="Xóa mềm thông báo"
                        >
                          <IconTrash size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isFormModalOpen && (
        <AnnouncementFormModal
          key={editingItem?.id ?? 'new-announcement'}
          branches={user?.branches ?? []}
          canSelectCompanyWide={Boolean(user?.hasAllBranches)}
          defaultBranchId={selectedBranchId}
          initialData={editingItem}
          onClose={() => setIsFormModalOpen(false)}
          onSaved={() => {
            setIsFormModalOpen(false);
            showToast(
              editingItem
                ? 'Đã cập nhật thông báo nội bộ.'
                : 'Đã lưu thông báo nội bộ thành công.',
            );
            setReloadTick((v) => v + 1);
          }}
        />
      )}

      {viewingItem && (
        <AnnouncementDetailModal
          key={`view-${viewingItem.id}`}
          announcement={viewingItem}
          canManage={canManage}
          onClose={() => setViewingItem(null)}
          onMarkedRead={handleMarkedReadFromModal}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title="Xóa thông báo nội bộ?"
        description={
          deletingItem
            ? `Bạn có chắc chắn muốn xóa mềm thông báo "${deletingItem.title}"? Nhân viên sẽ không còn nhìn thấy bản tin này.`
            : ''
        }
        confirmLabel="Xác nhận xóa"
        cancelLabel="Hủy"
        variant="danger"
        isProcessing={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
}
