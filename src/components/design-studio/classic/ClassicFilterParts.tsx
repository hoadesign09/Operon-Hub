'use client';

import { useState } from 'react';
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconLock,
  IconPaperclip,
  IconRotateClockwise,
  IconSend,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import type { ClassicThemeTokens } from './classic-themes';
import {
  formatStatusLabel,
  type ClassicItemStatus,
  type ClassicWorkspaceItem,
  type ClassicWorkspaceStore,
} from './classic-workspace-state';

export function renderClassicStatusBadge(
  theme: ClassicThemeTokens,
  status: ClassicItemStatus,
) {
  const c = theme.classes;
  switch (status) {
    case 'PENDING_APPROVAL':
      return <span className={c.badgeWarning}>{formatStatusLabel(status)}</span>;
    case 'APPROVED':
      return <span className={c.badgeSuccess}>{formatStatusLabel(status)}</span>;
    case 'IN_EXECUTION':
      return <span className={c.badgeInfo}>{formatStatusLabel(status)}</span>;
    case 'COMPLETED':
      return <span className={c.badgeNeutral}>{formatStatusLabel(status)}</span>;
    case 'REJECTED':
      return <span className={c.badgeDanger}>{formatStatusLabel(status)}</span>;
  }
}

/**
 * Reusable Collapsible Advanced Filters Panel (Extra filters only — common filters stay visible outside!)
 */
export function ClassicAdvancedFilterPanel({
  theme,
  store,
  columnsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
}: {
  theme: ClassicThemeTokens;
  store: ClassicWorkspaceStore;
  columnsClass?: string;
}) {
  const c = theme.classes;
  const { filters, updateFilter, resetAdvancedFilters, activeAdvancedCount } = store;

  return (
    <div className={`${c.cardMuted} p-3.5`}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={c.heading3}>Bộ lọc nâng cao (Extra Filters)</span>
          {activeAdvancedCount > 0 && (
            <span className={c.badgeInfo}>{activeAdvancedCount} điều kiện đang áp dụng</span>
          )}
        </div>
        {activeAdvancedCount > 0 && (
          <button type="button" onClick={resetAdvancedFilters} className={c.btnGhost}>
            <IconRotateClockwise size={13} />
            <span>Xóa lọc nâng cao</span>
          </button>
        )}
      </div>

      <div className={`grid gap-3 ${columnsClass}`}>
        <div>
          <label className={c.label}>Từ ngày lập</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className={c.input}
          />
        </div>
        <div>
          <label className={c.label}>Đến ngày lập</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className={c.input}
          />
        </div>
        <div>
          <label className={c.label}>Số tiền tối thiểu (VNĐ)</label>
          <input
            type="number"
            min={0}
            step={1000000}
            placeholder="VD: 10000000"
            value={filters.minAmount}
            onChange={(e) => updateFilter('minAmount', e.target.value)}
            className={c.input}
          />
        </div>
        <div>
          <label className={c.label}>Số tiền tối đa (VNĐ)</label>
          <input
            type="number"
            min={0}
            step={1000000}
            placeholder="VD: 50000000"
            value={filters.maxAmount}
            onChange={(e) => updateFilter('maxAmount', e.target.value)}
            className={c.input}
          />
        </div>
        <div>
          <label className={c.label}>Người đề nghị</label>
          <input
            type="text"
            placeholder="Nhập tên người lập..."
            value={filters.requester}
            onChange={(e) => updateFilter('requester', e.target.value)}
            className={c.input}
          />
        </div>
        <div>
          <label className={c.label}>Cờ ưu tiên / Ngân sách</label>
          <select
            value={filters.flagFilter}
            onChange={(e) =>
              updateFilter('flagFilter', e.target.value as 'ALL' | 'URGENT' | 'OVER_BUDGET')
            }
            className={c.select}
          >
            <option value="ALL">Tất cả hồ sơ</option>
            <option value="URGENT">Chỉ xem hồ sơ Khẩn cấp</option>
            <option value="OVER_BUDGET">Chỉ xem hồ sơ Vượt ngân sách</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/**
 * Active removable filter chips bar
 */
export function ClassicActiveFilterChips({
  theme,
  store,
}: {
  theme: ClassicThemeTokens;
  store: ClassicWorkspaceStore;
}) {
  const c = theme.classes;
  if (store.activeFilterChips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={c.mutedText}>Đang lọc:</span>
      {store.activeFilterChips.map((chip) => (
        <span key={chip.key} className={`${c.badgeNeutral} gap-1 pr-1`}>
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="rounded p-0.5 hover:bg-black/10"
            aria-label={`Bỏ lọc ${chip.label}`}
          >
            <IconX size={11} />
          </button>
        </span>
      ))}
      <button type="button" onClick={store.resetAllFilters} className={c.btnGhost}>
        Đặt lại tất cả
      </button>
    </div>
  );
}

/**
 * Standard interactive pagination footer
 */
export function ClassicPaginationBar({
  theme,
  store,
  extraLeft,
}: {
  theme: ClassicThemeTokens;
  store: ClassicWorkspaceStore;
  extraLeft?: React.ReactNode;
}) {
  const c = theme.classes;
  const start = store.filteredItems.length === 0 ? 0 : (store.page - 1) * store.pageSize + 1;
  const end = Math.min(store.page * store.pageSize, store.filteredItems.length);

  return (
    <div className={c.tableFooter}>
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Hiển thị <strong>{start}–{end}</strong> / <strong>{store.filteredItems.length}</strong> hồ sơ
        </span>
        {extraLeft}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={store.pageSize}
          onChange={(e) => {
            store.setPageSize(Number(e.target.value));
            store.setPage(1);
          }}
          className={`${c.select} w-28 py-1`}
          aria-label="Số dòng mỗi trang"
        >
          <option value={5}>5 dòng / trang</option>
          <option value={6}>6 dòng / trang</option>
          <option value={10}>10 dòng / trang</option>
          <option value={20}>20 dòng / trang</option>
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={store.page <= 1}
            onClick={() => store.setPage(Math.max(1, store.page - 1))}
            className={store.page <= 1 ? c.btnDisabled : c.btnIcon}
            aria-label="Trang trước"
          >
            <IconChevronLeft size={14} />
          </button>
          {Array.from({ length: store.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => store.setPage(p)}
              className={p === store.page ? c.btnPrimary : c.btnOutline}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={store.page >= store.totalPages}
            onClick={() => store.setPage(Math.min(store.totalPages, store.page + 1))}
            className={store.page >= store.totalPages ? c.btnDisabled : c.btnIcon}
            aria-label="Trang sau"
          >
            <IconChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive Collaboration & Strict PENDING_APPROVAL Upload Lock widget
 */
export function ClassicCollabBox({
  theme,
  item,
  onAddComment,
}: {
  theme: ClassicThemeTokens;
  item: ClassicWorkspaceItem;
  onAddComment: (code: string, text: string, attachment?: string) => void;
}) {
  const c = theme.classes;
  const [draft, setDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const canCollaborate = item.status === 'PENDING_APPROVAL';

  function handleSend() {
    if (!draft.trim() && !pendingFile) return;
    onAddComment(item.code, draft, pendingFile ?? undefined);
    setDraft('');
    setPendingFile(null);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {item.comments.length === 0 ? (
          <div className={`${c.cardMuted} p-3 text-xs ${c.mutedText}`}>
            Chưa có bình luận nào cho hồ sơ {item.code}.
          </div>
        ) : (
          item.comments.map((cm) => (
            <div key={cm.id} className={`${c.cardMuted} p-3`}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold">
                  {cm.author} <span className={`font-normal ${c.mutedText}`}>({cm.role})</span>
                </span>
                <span className={c.mutedText}>{cm.createdAt}</span>
              </div>
              <p className={`mt-1 ${c.bodyText}`}>{cm.content}</p>
              {cm.attachment && (
                <div className="mt-2">
                  <span className={c.badgeNeutral}>
                    <IconPaperclip size={11} />
                    {cm.attachment}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {canCollaborate ? (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Nhập bình luận cho ${item.code} (chỉ mở khi Chờ phê duyệt)...`}
            className={c.input}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingFile(`ChungTu_${item.code}.pdf (284 KB)`)}
                className={c.btnOutline}
              >
                <IconUpload size={13} />
                <span>Đính kèm tệp</span>
              </button>
              {pendingFile && (
                <span className={c.badgeInfo}>
                  {pendingFile}
                  <button type="button" onClick={() => setPendingFile(null)}>
                    <IconX size={11} />
                  </button>
                </span>
              )}
            </div>
            <button type="button" onClick={handleSend} className={c.btnPrimary}>
              <IconSend size={13} />
              <span>Gửi trao đổi</span>
            </button>
          </div>
        </div>
      ) : (
        <div className={`${c.alertInfo} flex items-center gap-2`}>
          <IconLock size={15} className="shrink-0" />
          <span>
            Hồ sơ ở trạng thái <strong>{formatStatusLabel(item.status)}</strong> — tự động khóa bình luận & tải tệp mới (chỉ cho phép xem/tải xuống).
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Full-Width Bottom Multi-Level Approval Workflow Strip (Operon Hub Standard)
 */
export function ClassicApprovalTimeline({
  theme,
  item,
}: {
  theme: ClassicThemeTokens;
  item: ClassicWorkspaceItem;
}) {
  const c = theme.classes;
  const isDoneAll = item.status === 'APPROVED' || item.status === 'IN_EXECUTION' || item.status === 'COMPLETED';
  const isRejected = item.status === 'REJECTED';

  const steps = [
    {
      step: 'Cấp 1 • Quản lý trực tiếp',
      actor: 'Lê Quốc Bảo',
      state: 'DONE' as const,
      time: `${item.dateDisplay} 09:15`,
      note: 'Xác nhận đúng nhu cầu nghiệp vụ phòng ban.',
    },
    {
      step: 'Cấp 2 • Kiểm soát Ngân sách',
      actor: 'Phạm Minh Đức',
      state: isDoneAll ? ('DONE' as const) : isRejected ? ('REJECTED' as const) : ('CURRENT' as const),
      time: isDoneAll ? `${item.dateDisplay} 11:30` : isRejected ? 'Đã từ chối' : 'Đang chờ xử lý',
      note: 'Kiểm tra chứng từ & giữ chỗ ngân sách chống trừ trùng.',
    },
    {
      step: 'Cấp 3 • Ban Giám đốc',
      actor: 'Nguyễn Hải Đăng',
      state: isDoneAll ? ('DONE' as const) : ('WAITING' as const),
      time: isDoneAll ? `${item.dateDisplay} 14:05` : 'Chưa đến lượt',
      note: 'Phê duyệt giải ngân cho hồ sơ trên hạn mức 30 triệu VNĐ.',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {steps.map((st) => (
        <div key={st.step} className={`${c.cardMuted} p-3.5`}>
          <div className="flex items-center justify-between gap-2">
            <span className={c.heading3}>{st.step}</span>
            {st.state === 'DONE' && (
              <span className={c.badgeSuccess}>
                <IconCheck size={11} /> Đã duyệt
              </span>
            )}
            {st.state === 'CURRENT' && (
              <span className={c.badgeWarning}>
                <IconClock size={11} /> Đang duyệt
              </span>
            )}
            {st.state === 'REJECTED' && <span className={c.badgeDanger}>Từ chối</span>}
            {st.state === 'WAITING' && <span className={c.badgeNeutral}>Chờ bước trước</span>}
          </div>
          <div className="mt-2 text-xs font-semibold">{st.actor}</div>
          <div className={`mt-0.5 ${c.mutedText}`}>{st.time}</div>
          <p className={`mt-2 border-t pt-2 text-[11px] ${c.divider} ${c.mutedText}`}>{st.note}</p>
        </div>
      ))}
    </div>
  );
}
