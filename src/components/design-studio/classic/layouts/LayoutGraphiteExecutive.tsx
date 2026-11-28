'use client';

import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconDownload,
  IconFileExport,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { CLASSIC_BUDGET_BARS, type ClassicThemeTokens } from '../classic-themes';
import {
  ClassicActiveFilterChips,
  ClassicAdvancedFilterPanel,
  ClassicApprovalTimeline,
  ClassicCollabBox,
  ClassicPaginationBar,
  renderClassicStatusBadge,
} from '../ClassicFilterParts';
import {
  CLASSIC_BUDGET_OPTIONS,
  CLASSIC_DEPARTMENT_OPTIONS,
  formatVndCompact,
  type ClassicItemStatus,
  type ClassicModuleType,
  type ClassicSortKey,
  type ClassicWorkspaceStore,
} from '../classic-workspace-state';

interface LayoutProps {
  theme: ClassicThemeTokens;
  store: ClassicWorkspaceStore;
  onOpenModal: () => void;
  onOpenDrawer: (code: string) => void;
}

/**
 * Layout #2 — Graphite Executive:
 * - Executive 4-Card KPI Strip with left accent bar
 * - Dedicated Framed Filter Card (Row 1: all 6 common filters clearly labeled; Row 2: collapsible Extra Filters)
 * - Master-Detail Split View (7 cols List | 5 cols Pinned Live Inspector with Approve/Reject & Collab)
 * - Full-Width Bottom Approval Workflow
 */
export function LayoutGraphiteExecutive({ theme, store, onOpenModal }: LayoutProps) {
  const c = theme.classes;
  const { filters, updateFilter, activeItem } = store;

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className={c.heading3}>Layout 2 • Master-Detail Split View (Danh sách + Xem nhanh song song)</span>
          <h1 className={`mt-1 ${c.heading1}`}>Điều hành Thanh toán & Ngân sách</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {store.selectedCodes.length > 0 && (
            <button type="button" onClick={store.bulkApproveSelected} className={c.btnSuccess}>
              <IconCheck size={14} />
              <span>Duyệt nhanh ({store.selectedCodes.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => store.showToast('Đã xuất báo cáo tổng hợp Excel.')}
            className={c.btnOutline}
          >
            <IconFileExport size={14} />
            <span>Xuất Excel</span>
          </button>
          <button type="button" onClick={onOpenModal} className={c.btnPrimary}>
            <IconPlus size={14} />
            <span>Tạo phiếu mới</span>
          </button>
        </div>
      </div>

      {/* 4 Classic Framed Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Tổng hạn mức quỹ FY26', value: '1.080.000.000 ₫', note: '5 quỹ đang hoạt động', accent: 'border-l-[#2B4C7E]' },
          { label: 'Giá trị đang lọc', value: formatVndCompact(store.filteredTotalAmount), note: `${store.filteredItems.length} chứng từ khớp điều kiện`, accent: 'border-l-slate-700' },
          { label: 'Hồ sơ chờ phê duyệt', value: `${store.statusCounts.PENDING_APPROVAL} hồ sơ`, note: 'Cần Kế toán / BGD duyệt', accent: 'border-l-amber-600' },
          { label: 'Số dư khả dụng còn lại', value: '411.500.000 ₫', note: 'Đã kiểm soát giữ chỗ', accent: 'border-l-emerald-700' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${c.card} border-l-4 ${kpi.accent} p-4`}>
            <div className={c.mutedText}>{kpi.label}</div>
            <div className="mt-1.5 text-lg font-bold tracking-tight tabular-nums">{kpi.value}</div>
            <div className={`mt-1 ${c.mutedText}`}>{kpi.note}</div>
          </div>
        ))}
      </div>

      {/* Dedicated Framed Filter Card — Common Filters Row 1 + Collapsible Advanced Row 2 */}
      <div className={`${c.card} space-y-3 p-4`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className={c.label}>Tìm kiếm nhanh</label>
            <div className="relative">
              <IconSearch
                size={14}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="Mã phiếu, tiêu đề, người đề nghị..."
                className={`${c.input} pl-8`}
              />
            </div>
          </div>

          <div>
            <label className={c.label}>Trạng thái</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value as 'ALL' | ClassicItemStatus)}
              className={c.select}
            >
              <option value="ALL">Tất cả ({store.statusCounts.ALL})</option>
              <option value="PENDING_APPROVAL">Chờ duyệt ({store.statusCounts.PENDING_APPROVAL})</option>
              <option value="APPROVED">Đã duyệt ({store.statusCounts.APPROVED})</option>
              <option value="IN_EXECUTION">Đang giải ngân ({store.statusCounts.IN_EXECUTION})</option>
              <option value="COMPLETED">Hoàn tất ({store.statusCounts.COMPLETED})</option>
              <option value="REJECTED">Từ chối ({store.statusCounts.REJECTED})</option>
            </select>
          </div>

          <div>
            <label className={c.label}>Phân hệ</label>
            <select
              value={filters.module}
              onChange={(e) => updateFilter('module', e.target.value as 'ALL' | ClassicModuleType)}
              className={c.select}
            >
              <option value="ALL">Tất cả phân hệ</option>
              <option value="Thanh toán">Thanh toán</option>
              <option value="Tạm ứng">Tạm ứng</option>
              <option value="Đề xuất Nội bộ">Đề xuất Nội bộ</option>
              <option value="IT Helpdesk">IT Helpdesk</option>
            </select>
          </div>

          <div>
            <label className={c.label}>Quỹ ngân sách</label>
            <select
              value={filters.budgetCode}
              onChange={(e) => updateFilter('budgetCode', e.target.value)}
              className={c.select}
            >
              <option value="ALL">Tất cả quỹ</option>
              {CLASSIC_BUDGET_OPTIONS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={c.label}>Phòng ban</label>
            <select
              value={filters.department}
              onChange={(e) => updateFilter('department', e.target.value)}
              className={c.select}
            >
              <option value="ALL">Tất cả phòng ban</option>
              {CLASSIC_DEPARTMENT_OPTIONS.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={c.mutedText}>Sắp xếp:</span>
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value as ClassicSortKey)}
              className={`${c.select} w-44 py-1.5`}
              aria-label="Sắp xếp"
            >
              <option value="date_desc">Ngày lập mới nhất</option>
              <option value="date_asc">Ngày lập cũ nhất</option>
              <option value="amount_desc">Giá trị lớn nhất</option>
              <option value="amount_asc">Giá trị nhỏ nhất</option>
              <option value="code_asc">Mã chứng từ A → Z</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => store.setIsAdvancedOpen((v) => !v)}
            className={store.isAdvancedOpen || store.activeAdvancedCount > 0 ? c.btnPrimary : c.btnOutline}
          >
            <IconAdjustmentsHorizontal size={14} />
            <span>Bộ lọc nâng cao</span>
            {store.activeAdvancedCount > 0 && (
              <span className="rounded bg-white/25 px-1.5 py-0.2 text-[10px]">
                {store.activeAdvancedCount}
              </span>
            )}
          </button>
        </div>

        {store.isAdvancedOpen && <ClassicAdvancedFilterPanel theme={theme} store={store} />}
        <ClassicActiveFilterChips theme={theme} store={store} />
      </div>

      {/* Master-Detail Split Workspace (Signature of Graphite Executive) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Left Master Table (7 cols) */}
        <div className={`${c.tableWrap} xl:col-span-7`}>
          <div className={`${c.cardHeader} flex items-center justify-between`}>
            <h2 className={c.heading2}>Danh sách Chứng từ (Bấm dòng để xem bên phải)</h2>
            <span className={c.mutedText}>{store.filteredItems.length} hồ sơ</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className={c.tableHead}>
                <tr>
                  <th className={`${c.tableTh} w-9`}>
                    <input
                      type="checkbox"
                      className={c.checkbox}
                      checked={
                        store.paginatedItems.length > 0 &&
                        store.paginatedItems.every((r) => store.selectedCodes.includes(r.code))
                      }
                      onChange={store.toggleSelectAllPage}
                      aria-label="Chọn trang"
                    />
                  </th>
                  <th className={c.tableTh}>Chứng từ</th>
                  <th className={c.tableTh}>Người lập & Phòng</th>
                  <th className={`${c.tableTh} text-right`}>Số tiền</th>
                  <th className={c.tableTh}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {store.paginatedItems.map((row) => {
                  const isActive = activeItem.code === row.code;
                  return (
                    <tr
                      key={row.code}
                      onClick={() => store.setActiveItemCode(row.code)}
                      className={`${c.tableRow} cursor-pointer ${
                        isActive ? 'bg-[#EDF3FB]/80' : ''
                      }`}
                    >
                      <td className={c.tableCell} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className={c.checkbox}
                          checked={store.selectedCodes.includes(row.code)}
                          onChange={() => store.toggleRowSelection(row.code)}
                          aria-label={`Chọn ${row.code}`}
                        />
                      </td>
                      <td className={c.tableCell}>
                        <div className="flex items-center gap-1.5">
                          <span className={c.codeTag}>{row.code}</span>
                          {row.isUrgent && <span className={c.badgeDanger}>Khẩn</span>}
                          {row.isOverBudget && <span className={c.badgeWarning}>Vượt quỹ</span>}
                        </div>
                        <div className="mt-1 line-clamp-1 font-medium text-slate-900">{row.title}</div>
                        <div className={`mt-0.5 ${c.mutedText}`}>
                          {row.module} • {row.dateDisplay}
                        </div>
                      </td>
                      <td className={c.tableCell}>
                        <div className="font-medium">{row.requester}</div>
                        <div className={c.mutedText}>{row.department}</div>
                      </td>
                      <td className={`${c.tableCell} text-right font-semibold tabular-nums`}>
                        {formatVndCompact(row.amount)}
                      </td>
                      <td className={c.tableCell}>{renderClassicStatusBadge(theme, row.status)}</td>
                    </tr>
                  );
                })}
                {store.paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">
                      Không tìm thấy hồ sơ khớp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <ClassicPaginationBar theme={theme} store={store} />
        </div>

        {/* Right Pinned Live Inspector (5 cols) */}
        <div className={`${c.card} flex flex-col justify-between xl:col-span-5`}>
          <div>
            <div className={`${c.cardHeader} flex flex-wrap items-center justify-between gap-2`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={c.codeTag}>{activeItem.code}</span>
                  {renderClassicStatusBadge(theme, activeItem.status)}
                </div>
                <h2 className={`mt-1.5 ${c.heading2}`}>{activeItem.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => store.showToast(`Đã tải phiếu PDF ${activeItem.code}.`)}
                className={c.btnIcon}
                title="Tải PDF"
              >
                <IconDownload size={14} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className={`${c.cardMuted} grid grid-cols-2 gap-3 p-3.5 text-xs`}>
                <div>
                  <div className={c.mutedText}>Người đề nghị</div>
                  <div className="mt-0.5 font-semibold">{activeItem.requester}</div>
                </div>
                <div>
                  <div className={c.mutedText}>Phòng ban</div>
                  <div className="mt-0.5 font-semibold">{activeItem.department}</div>
                </div>
                <div>
                  <div className={c.mutedText}>Quỹ Ngân sách</div>
                  <div className="mt-0.5 font-mono font-semibold">{activeItem.budgetCode}</div>
                </div>
                <div>
                  <div className={c.mutedText}>Tổng số tiền</div>
                  <div className="mt-0.5 text-sm font-bold tabular-nums text-[#2B4C7E]">
                    {formatVndCompact(activeItem.amount)}
                  </div>
                </div>
              </div>

              <p className={c.bodyText}>{activeItem.description}</p>

              {/* Direct Approve / Reject Actions */}
              {activeItem.status === 'PENDING_APPROVAL' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => store.updateItemStatus(activeItem.code, 'APPROVED')}
                    className={`${c.btnSuccess} flex-1`}
                  >
                    <IconCheck size={14} />
                    <span>Phê duyệt ngay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => store.updateItemStatus(activeItem.code, 'REJECTED')}
                    className={`${c.btnDanger} flex-1`}
                  >
                    <IconX size={14} />
                    <span>Từ chối</span>
                  </button>
                </div>
              )}

              {/* Live Collaboration inside Inspector */}
              <div className={`border-t pt-3.5 ${c.divider}`}>
                <div className={`mb-2 ${c.heading3}`}>Trao đổi & Tệp chứng từ</div>
                <ClassicCollabBox
                  theme={theme}
                  item={activeItem}
                  onAddComment={store.addComment}
                />
              </div>
            </div>
          </div>

          <div className={`border-t p-4 ${c.divider}`}>
            <div className={`mb-2 ${c.heading3}`}>Tình trạng Quỹ Ngân sách liên quan</div>
            <div className="grid grid-cols-2 gap-2.5">
              {CLASSIC_BUDGET_BARS.slice(0, 2).map((fund) => (
                <div key={fund.code} className={`${c.cardMuted} p-2.5 text-[11px]`}>
                  <div className="flex justify-between font-medium">
                    <span>{fund.code}</span>
                    <span className="tabular-nums">{fund.usedPct}%</span>
                  </div>
                  <div className={`mt-1.5 ${c.progressTrack}`}>
                    <div className={c.progressFill} style={{ width: `${fund.usedPct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Bottom Approval Workflow */}
      <div className={c.card}>
        <div className={`${c.cardHeader} flex items-center justify-between`}>
          <h2 className={c.heading2}>
            Luồng Phê duyệt Đa cấp — {activeItem.code} (Toàn chiều rộng cuối trang)
          </h2>
          {renderClassicStatusBadge(theme, activeItem.status)}
        </div>
        <div className="p-4">
          <ClassicApprovalTimeline theme={theme} item={activeItem} />
        </div>
      </div>
    </div>
  );
}
