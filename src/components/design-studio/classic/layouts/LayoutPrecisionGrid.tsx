'use client';

import { useState } from 'react';
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconDownload,
  IconEye,
  IconFileExport,
  IconPlus,
  IconPrinter,
  IconRotateClockwise,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { CLASSIC_BUDGET_BARS, CLASSIC_MONTHLY_CHART, type ClassicThemeTokens } from '../classic-themes';
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
 * Layout #5 — Precision Grid (High-Density Classic Accounting / ERP):
 * - Top Command Toolbar Strip (Actions left, Utilities right)
 * - Structured 6-Column Common Filter Matrix + Collapsible Extra Filter Box
 * - Fused 4-Cell Bordered ERP Ticker directly above a Crisp Column-Bordered Zebra Grid
 * - Live Total Summary Row + Folder-Tabbed Bottom Dock (Approval | Collab | Budget & Chart)
 */
export function LayoutPrecisionGrid({ theme, store, onOpenModal, onOpenDrawer }: LayoutProps) {
  const c = theme.classes;
  const { filters, updateFilter, activeItem } = store;
  const [bottomDockTab, setBottomDockTab] = useState<'approval' | 'collab' | 'budget'>('approval');

  return (
    <div className="w-full space-y-3.5">
      {/* ERP Command Toolbar Strip */}
      <div className={`${c.card} flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5`}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onOpenModal} className={c.btnPrimary}>
            <IconPlus size={13} />
            <span>Lập chứng từ</span>
          </button>
          {store.selectedCodes.length > 0 && (
            <button type="button" onClick={store.bulkApproveSelected} className={c.btnSuccess}>
              <IconCheck size={13} />
              <span>Duyệt ({store.selectedCodes.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => store.showToast('Đã xuất sổ chứng từ ra Excel.')}
            className={c.btnOutline}
          >
            <IconFileExport size={13} />
            <span>Xuất Excel</span>
          </button>
          <button
            type="button"
            onClick={() => store.showToast('Đã tạo bảng kê PDF.')}
            className={c.btnOutline}
          >
            <IconPrinter size={13} />
            <span>In bảng kê</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className={c.codeTag}>Layout 5 • Compact Classic ERP</span>
          <button type="button" onClick={store.resetAllFilters} className={c.btnSecondary}>
            <IconRotateClockwise size={13} />
            <span>Làm mới bộ lọc</span>
          </button>
        </div>
      </div>

      {/* Structured 6-Column Filter Matrix (Common Filters Visible, Extra in Collapsible Box) */}
      <div className={`${c.card} space-y-2.5 p-3`}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
          <div className="xl:col-span-2">
            <label className={c.label}>Từ khóa (Mã / Diễn giải / Người lập)</label>
            <div className="relative">
              <IconSearch
                size={13}
                className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="PAY-2026..., Cloud, Quân..."
                className={`${c.input} pl-7`}
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
              <option value="ALL">Tất cả</option>
              <option value="Thanh toán">Thanh toán</option>
              <option value="Tạm ứng">Tạm ứng</option>
              <option value="Đề xuất Nội bộ">Đề xuất Nội bộ</option>
              <option value="IT Helpdesk">IT Helpdesk</option>
            </select>
          </div>

          <div>
            <label className={c.label}>Quỹ Ngân sách</label>
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
              <option value="ALL">Tất cả</option>
              {CLASSIC_DEPARTMENT_OPTIONS.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className={c.label}>Lọc mở rộng</label>
            <button
              type="button"
              onClick={() => store.setIsAdvancedOpen((v) => !v)}
              className={`${
                store.isAdvancedOpen || store.activeAdvancedCount > 0 ? c.btnPrimary : c.btnSecondary
              } w-full`}
            >
              <IconAdjustmentsHorizontal size={13} />
              <span>Nâng cao</span>
              {store.activeAdvancedCount > 0 && (
                <span className="rounded-xs bg-white/25 px-1 text-[10px]">
                  {store.activeAdvancedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {store.isAdvancedOpen && <ClassicAdvancedFilterPanel theme={theme} store={store} />}
        <ClassicActiveFilterChips theme={theme} store={store} />
      </div>

      {/* Fused ERP Ticker + Column-Bordered Data Grid (Signature of Precision Grid) */}
      <div className={c.tableWrap}>
        {/* Fused 4-Cell Summary Strip */}
        <div className="grid grid-cols-2 border-b border-[#CFD6DF] bg-[#F8F9FB] sm:grid-cols-4">
          {[
            { label: 'HẠN MỨC NĂM 2026', val: '1.080.000.000 ₫' },
            { label: 'TỔNG TIỀN ĐANG LỌC', val: formatVndCompact(store.filteredTotalAmount) },
            { label: 'CHỜ PHÊ DUYỆT', val: `${store.statusCounts.PENDING_APPROVAL} / ${store.items.length} CHỨNG TỪ` },
            { label: 'SỐ DƯ KHẢ DỤNG', val: '411.500.000 ₫' },
          ].map((cell, idx) => (
            <div
              key={cell.label}
              className={`px-3.5 py-2 ${idx < 3 ? 'border-b border-r border-[#DCE2EA] sm:border-b-0' : ''}`}
            >
              <div className="text-[10px] font-bold tracking-wider text-slate-500">{cell.label}</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{cell.val}</div>
            </div>
          ))}
        </div>

        {/* Sort Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE2EA] bg-white px-3 py-1.5 text-xs">
          <span className="font-semibold text-slate-700">
            Sổ Chứng từ Chi tiết ({store.filteredItems.length} dòng)
          </span>
          <div className="flex items-center gap-2">
            <span className={c.mutedText}>Sắp xếp:</span>
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value as ClassicSortKey)}
              className={`${c.select} w-40 py-1`}
              aria-label="Sắp xếp bảng"
            >
              <option value="date_desc">Ngày mới nhất</option>
              <option value="date_asc">Ngày cũ nhất</option>
              <option value="amount_desc">Tiền giảm dần</option>
              <option value="amount_asc">Tiền tăng dần</option>
              <option value="code_asc">Mã chứng từ A–Z</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className={c.tableHead}>
              <tr>
                <th className={`${c.tableTh} w-8 text-center`}>
                  <input
                    type="checkbox"
                    className={c.checkbox}
                    checked={
                      store.paginatedItems.length > 0 &&
                      store.paginatedItems.every((r) => store.selectedCodes.includes(r.code))
                    }
                    onChange={store.toggleSelectAllPage}
                    aria-label="Chọn tất cả"
                  />
                </th>
                <th className={c.tableTh}>Số CT</th>
                <th className={c.tableTh}>Ngày</th>
                <th className={c.tableTh}>Loại</th>
                <th className={c.tableTh}>Diễn giải</th>
                <th className={c.tableTh}>Mã Quỹ</th>
                <th className={c.tableTh}>Bộ phận / Người lập</th>
                <th className={`${c.tableTh} text-right`}>Số tiền (VNĐ)</th>
                <th className={c.tableTh}>Trạng thái</th>
                <th className={`${c.tableTh} text-right`}>Xử lý</th>
              </tr>
            </thead>
            <tbody>
              {store.paginatedItems.map((row) => {
                const isSelected = activeItem.code === row.code;
                return (
                  <tr
                    key={row.code}
                    onClick={() => store.setActiveItemCode(row.code)}
                    className={`${c.tableRow} cursor-pointer ${
                      isSelected ? '!bg-[#E6EEF8]' : ''
                    }`}
                  >
                    <td className={`${c.tableCell} text-center`} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className={c.checkbox}
                        checked={store.selectedCodes.includes(row.code)}
                        onChange={() => store.toggleRowSelection(row.code)}
                        aria-label={`Chọn ${row.code}`}
                      />
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap font-mono font-semibold text-[#1D4E89]`}>
                      {row.code}
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap tabular-nums`}>{row.dateDisplay}</td>
                    <td className={`${c.tableCell} whitespace-nowrap`}>{row.module}</td>
                    <td className={c.tableCell}>
                      <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                        <span>{row.title}</span>
                        {row.isUrgent && <span className={c.badgeDanger}>KHẨN</span>}
                        {row.isOverBudget && <span className={c.badgeWarning}>VƯỢT QUỸ</span>}
                      </div>
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap font-mono text-[11px]`}>
                      {row.budgetCode}
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap`}>
                      <span className="font-medium">{row.requester}</span>
                      <span className="text-slate-400"> • </span>
                      <span className="text-slate-500">{row.department}</span>
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap text-right font-bold tabular-nums`}>
                      {formatVndCompact(row.amount)}
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap`}>
                      {renderClassicStatusBadge(theme, row.status)}
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        {row.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              type="button"
                              onClick={() => store.updateItemStatus(row.code, 'APPROVED')}
                              className={c.btnIcon}
                              title="Phê duyệt"
                            >
                              <IconCheck size={13} className="text-emerald-700" />
                            </button>
                            <button
                              type="button"
                              onClick={() => store.updateItemStatus(row.code, 'REJECTED')}
                              className={c.btnIcon}
                              title="Từ chối"
                            >
                              <IconX size={13} className="text-red-700" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDrawer(row.code)}
                          className={c.btnIcon}
                          title="Chi tiết"
                        >
                          <IconEye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => store.showToast(`Xuất PDF ${row.code}`)}
                          className={c.btnIcon}
                          title="PDF"
                        >
                          <IconDownload size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {store.paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-xs text-slate-500">
                    Không có dòng dữ liệu nào phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Accounting Subtotal Row */}
            <tfoot>
              <tr className="border-t-2 border-[#CFD6DF] bg-[#F8F9FB] text-xs font-bold">
                <td colSpan={7} className="border-r border-[#E2E7EE] px-3 py-2 text-right uppercase text-slate-600">
                  Cộng giá trị toàn bộ kết quả đang lọc ({store.filteredItems.length} chứng từ):
                </td>
                <td className="border-r border-[#E2E7EE] px-3 py-2 text-right tabular-nums text-[#1D4E89]">
                  {formatVndCompact(store.filteredTotalAmount)}
                </td>
                <td colSpan={2} className="px-3 py-2 text-[11px] font-normal text-slate-500">
                  Đang chọn xem: <strong>{activeItem.code}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <ClassicPaginationBar theme={theme} store={store} />
      </div>

      {/* Bottom Folder-Tabbed ERP Dock (Unique to Precision Grid — Compact & Clean) */}
      <div className={c.card}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CFD6DF] bg-[#F1F4F8] px-3 pt-2">
          <div className={c.tabsWrap}>
            <button
              type="button"
              onClick={() => setBottomDockTab('approval')}
              className={bottomDockTab === 'approval' ? c.tabActive : c.tabIdle}
            >
              Luồng Phê duyệt ({activeItem.code})
            </button>
            <button
              type="button"
              onClick={() => setBottomDockTab('collab')}
              className={bottomDockTab === 'collab' ? c.tabActive : c.tabIdle}
            >
              Trao đổi & Chứng từ ({activeItem.comments.length})
            </button>
            <button
              type="button"
              onClick={() => setBottomDockTab('budget')}
              className={bottomDockTab === 'budget' ? c.tabActive : c.tabIdle}
            >
              Đối chiếu Quỹ Ngân sách & Biểu đồ
            </button>
          </div>
          <div className="pb-1.5">{renderClassicStatusBadge(theme, activeItem.status)}</div>
        </div>

        <div className="p-4">
          {bottomDockTab === 'approval' && (
            <ClassicApprovalTimeline theme={theme} item={activeItem} />
          )}
          {bottomDockTab === 'collab' && (
            <ClassicCollabBox theme={theme} item={activeItem} onAddComment={store.addComment} />
          )}
          {bottomDockTab === 'budget' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-2.5 lg:col-span-7">
                {CLASSIC_BUDGET_BARS.map((fund) => (
                  <div key={fund.code} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold">
                        [{fund.code}] {fund.name}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {fund.spent} / {fund.total} ({fund.usedPct}%)
                      </span>
                    </div>
                    <div className={c.progressTrack}>
                      <div
                        className={fund.isWarn ? c.progressFillWarn : c.progressFill}
                        style={{ width: `${fund.usedPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex h-36 items-end justify-between gap-2 border border-[#DCE2EA] bg-[#FAFBFD] p-3 lg:col-span-5">
                {CLASSIC_MONTHLY_CHART.map((col) => (
                  <div key={col.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-24 items-end gap-1">
                      <div className={`w-2.5 ${c.chartBarSecondary}`} style={{ height: `${col.allocated}%` }} />
                      <div className={`w-2.5 ${c.chartBarPrimary}`} style={{ height: `${col.actual}%` }} />
                    </div>
                    <span className={c.mutedText}>{col.month}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
