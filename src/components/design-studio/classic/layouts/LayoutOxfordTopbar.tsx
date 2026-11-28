'use client';

import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconDownload,
  IconEye,
  IconFileExport,
  IconPlus,
  IconPrinter,
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
 * Layout #4 — Oxford Topbar (0px Sidebar — 100% Full-Bleed Horizontal Workspace):
 * - Top 12-Col Executive Band: 8 cols (4 KPI Cards + Compact Budget Ribbon) + 4 cols (Monthly Bar Chart)
 * - Classic Full-Width Horizontal Filter Ribbon: Common Filters always visible inline + Collapsible Extra Filters
 * - Ultra-Wide 10-Column Enterprise Data Table showcasing maximum horizontal clarity (no truncated columns!)
 * - Bottom Full-Width Approval Workflow + Collaboration
 */
export function LayoutOxfordTopbar({ theme, store, onOpenModal, onOpenDrawer }: LayoutProps) {
  const c = theme.classes;
  const { filters, updateFilter, activeItem } = store;

  return (
    <div className="w-full space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className={c.heading3}>Layout 4 • 100% Full-Bleed Horizontal Table & Executive Band</span>
          <h1 className={`mt-1 ${c.heading1}`}>Cổng Kiểm soát Thanh toán & Ngân sách Doanh nghiệp</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {store.selectedCodes.length > 0 && (
            <button type="button" onClick={store.bulkApproveSelected} className={c.btnSuccess}>
              <IconCheck size={14} />
              <span>Duyệt hàng loạt ({store.selectedCodes.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => store.showToast('Đã xuất file Excel (.xlsx) đầy đủ 10 cột.')}
            className={c.btnOutline}
          >
            <IconFileExport size={14} />
            <span>Xuất Excel</span>
          </button>
          <button
            type="button"
            onClick={() => store.showToast('Đã chuẩn bị bản in PDF khổ A4 ngang.')}
            className={c.btnOutline}
          >
            <IconPrinter size={14} />
            <span>In PDF</span>
          </button>
          <button type="button" onClick={onOpenModal} className={c.btnPrimary}>
            <IconPlus size={14} />
            <span>Tạo đề nghị mới</span>
          </button>
        </div>
      </div>

      {/* Top 12-Col Executive Band (Unique to Oxford Topbar — exploits 100% screen width) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3.5 xl:col-span-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Tổng ngân sách năm', value: '1.080 tr ₫', tag: 'FY2026' },
              { label: 'Giá trị đang lọc', value: formatVndCompact(store.filteredTotalAmount), tag: `${store.filteredItems.length} hồ sơ` },
              { label: 'Đang chờ duyệt', value: `${store.statusCounts.PENDING_APPROVAL} phiếu`, tag: 'Ưu tiên' },
              { label: 'Khả dụng còn lại', value: '411,5 tr ₫', tag: '38,1%' },
            ].map((kpi) => (
              <div key={kpi.label} className={`${c.card} p-3.5`}>
                <div className="flex items-center justify-between gap-1">
                  <span className={c.mutedText}>{kpi.label}</span>
                  <span className={c.badgeInfo}>{kpi.tag}</span>
                </div>
                <div className="mt-2 text-base font-bold tabular-nums text-slate-900">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Horizontal Compact Budget Ribbon */}
          <div className={`${c.card} grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
            {CLASSIC_BUDGET_BARS.map((fund) => (
              <div key={fund.code} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-slate-800">{fund.code}</span>
                  <span className={fund.isWarn ? c.badgeWarning : c.badgeNeutral}>{fund.usedPct}%</span>
                </div>
                <div className={c.progressTrack}>
                  <div
                    className={fund.isWarn ? c.progressFillWarn : c.progressFill}
                    style={{ width: `${fund.usedPct}%` }}
                  />
                </div>
                <div className={c.mutedText}>
                  {fund.spent} / {fund.total}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 4-Col Monthly Chart */}
        <div className={`${c.card} flex flex-col justify-between p-4 xl:col-span-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={c.heading2}>Thực chi vs Kế hoạch</h2>
              <p className={c.mutedText}>6 tháng gần nhất (%)</p>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1">
                <span className={`h-2.5 w-2.5 ${c.chartBarSecondary}`} /> KH
              </span>
              <span className="inline-flex items-center gap-1">
                <span className={`h-2.5 w-2.5 ${c.chartBarPrimary}`} /> Chi
              </span>
            </div>
          </div>

          <div className="mt-4 flex h-32 items-end justify-between gap-2">
            {CLASSIC_MONTHLY_CHART.map((col) => (
              <div key={col.month} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-24 items-end gap-1">
                  <div className={`w-3 ${c.chartBarSecondary}`} style={{ height: `${col.allocated}%` }} />
                  <div className={`w-3 ${c.chartBarPrimary}`} style={{ height: `${col.actual}%` }} />
                </div>
                <span className={c.mutedText}>{col.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full-Width Horizontal Filter Ribbon */}
      <div className={`${c.card} space-y-3 p-4`}>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-[240px] flex-1">
            <label className={c.label}>Tìm kiếm chứng từ</label>
            <div className="relative">
              <IconSearch
                size={14}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="Nhập mã, tiêu đề, người lập, quỹ..."
                className={`${c.input} pl-8`}
              />
            </div>
          </div>

          <div className="w-40">
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

          <div className="w-36">
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

          <div className="w-48">
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

          <div className="w-44">
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

          <div className="w-40">
            <label className={c.label}>Sắp xếp</label>
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value as ClassicSortKey)}
              className={c.select}
            >
              <option value="date_desc">Mới nhất</option>
              <option value="date_asc">Cũ nhất</option>
              <option value="amount_desc">Tiền cao → thấp</option>
              <option value="amount_asc">Tiền thấp → cao</option>
              <option value="code_asc">Mã A → Z</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => store.setIsAdvancedOpen((v) => !v)}
            className={store.isAdvancedOpen || store.activeAdvancedCount > 0 ? c.btnPrimary : c.btnOutline}
          >
            <IconAdjustmentsHorizontal size={14} />
            <span>Lọc nâng cao</span>
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

      {/* Ultra-Wide 10-Column Enterprise Data Table (Unique advantage of 0px Sidebar!) */}
      <div className={c.tableWrap}>
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
                <th className={c.tableTh}>Mã chứng từ</th>
                <th className={c.tableTh}>Ngày lập</th>
                <th className={c.tableTh}>Phân hệ</th>
                <th className={c.tableTh}>Tiêu đề nội dung</th>
                <th className={c.tableTh}>Quỹ Ngân sách</th>
                <th className={c.tableTh}>Phòng ban</th>
                <th className={c.tableTh}>Người lập</th>
                <th className={`${c.tableTh} text-right`}>Số tiền</th>
                <th className={c.tableTh}>Trạng thái</th>
                <th className={`${c.tableTh} text-right`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {store.paginatedItems.map((row) => {
                const isSelected = activeItem.code === row.code;
                return (
                  <tr
                    key={row.code}
                    onClick={() => store.setActiveItemCode(row.code)}
                    className={`${c.tableRow} cursor-pointer ${isSelected ? 'bg-[#EEF4FB]/70' : ''}`}
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
                      <span className={c.codeTag}>{row.code}</span>
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap tabular-nums`}>{row.dateDisplay}</td>
                    <td className={`${c.tableCell} whitespace-nowrap`}>
                      <span className={c.badgeNeutral}>{row.module}</span>
                    </td>
                    <td className={c.tableCell}>
                      <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                        <span>{row.title}</span>
                        {row.isUrgent && <span className={c.badgeDanger}>Khẩn</span>}
                        {row.isOverBudget && <span className={c.badgeWarning}>Vượt quỹ</span>}
                      </div>
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap font-mono text-[11px]`}>
                      {row.budgetCode}
                    </td>
                    <td className={`${c.tableCell} whitespace-nowrap`}>{row.department}</td>
                    <td className={`${c.tableCell} whitespace-nowrap font-medium`}>{row.requester}</td>
                    <td className={`${c.tableCell} whitespace-nowrap text-right font-semibold tabular-nums`}>
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
                              title="Duyệt nhanh"
                            >
                              <IconCheck size={14} className="text-emerald-700" />
                            </button>
                            <button
                              type="button"
                              onClick={() => store.updateItemStatus(row.code, 'REJECTED')}
                              className={c.btnIcon}
                              title="Từ chối"
                            >
                              <IconX size={14} className="text-red-700" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDrawer(row.code)}
                          className={c.btnIcon}
                          title="Xem chi tiết"
                        >
                          <IconEye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => store.showToast(`Đang tải PDF ${row.code}...`)}
                          className={c.btnIcon}
                          title="Tải PDF"
                        >
                          <IconDownload size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {store.paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-xs text-slate-500">
                    Không tìm thấy chứng từ nào khớp điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ClassicPaginationBar
          theme={theme}
          store={store}
          extraLeft={
            <span className="font-semibold text-slate-800 tabular-nums">
              Tổng cộng đang lọc: {formatVndCompact(store.filteredTotalAmount)}
            </span>
          }
        />
      </div>

      {/* Bottom Full-Width Approval + Collab */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${c.card} xl:col-span-5`}>
          <div className={`${c.cardHeader} flex items-center justify-between`}>
            <h2 className={c.heading2}>Trao đổi & Tệp — {activeItem.code}</h2>
            {renderClassicStatusBadge(theme, activeItem.status)}
          </div>
          <div className="p-4">
            <ClassicCollabBox theme={theme} item={activeItem} onAddComment={store.addComment} />
          </div>
        </div>
        <div className={`${c.card} xl:col-span-7`}>
          <div className={`${c.cardHeader} flex items-center justify-between`}>
            <h2 className={c.heading2}>Luồng Phê duyệt Đa cấp — {activeItem.code}</h2>
            {renderClassicStatusBadge(theme, activeItem.status)}
          </div>
          <div className="p-4">
            <ClassicApprovalTimeline theme={theme} item={activeItem} />
          </div>
        </div>
      </div>
    </div>
  );
}
