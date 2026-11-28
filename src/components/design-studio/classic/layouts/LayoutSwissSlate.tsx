'use client';

import { Fragment, useState } from 'react';
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconEye,
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
 * Layout #1 — Swiss Slate:
 * - Single unified horizontal hairline KPI Strip (zero chunky cards)
 * - Status Quick-Filter Pill Bar + Inline Common Filters + Collapsible Extra Filters
 * - Minimalist Hairline Table with Inline Expandable Row Detail
 */
export function LayoutSwissSlate({ theme, store, onOpenModal, onOpenDrawer }: LayoutProps) {
  const c = theme.classes;
  const { filters, updateFilter } = store;
  const [expandedCode, setExpandedCode] = useState<string | null>('PAY-2026-0042');

  const statusTabs: Array<{ key: 'ALL' | ClassicItemStatus; label: string }> = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
    { key: 'APPROVED', label: 'Đã duyệt' },
    { key: 'IN_EXECUTION', label: 'Đang giải ngân' },
    { key: 'COMPLETED', label: 'Hoàn tất' },
    { key: 'REJECTED', label: 'Từ chối' },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={c.heading3}>Layout 1 • Minimal Linear Flow & Inline Accordion</span>
          <h1 className={`mt-1 ${c.heading1}`}>Danh sách Hồ sơ Thanh toán & Ngân sách</h1>
          <p className={`mt-0.5 ${c.mutedText}`}>
            Bố cục dải chỉ số phẳng + thanh lọc nhanh theo trạng thái + bấm trực tiếp từng dòng để mở rộng chi tiết.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => store.showToast('Đã xuất danh sách ra file Excel (.xlsx).')}
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

      {/* Unified Horizontal Hairline KPI Strip (Unique to Swiss Slate) */}
      <div className={`${c.card} grid grid-cols-2 divide-y divide-zinc-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0`}>
        {[
          { label: 'Tổng ngân sách FY26', value: '1.080.000.000 ₫', sub: '5 quỹ đang mở' },
          { label: 'Tổng giá trị đang lọc', value: formatVndCompact(store.filteredTotalAmount), sub: `${store.filteredItems.length} hồ sơ khớp bộ lọc` },
          { label: 'Chờ phê duyệt', value: `${store.statusCounts.PENDING_APPROVAL} hồ sơ`, sub: 'Cần xử lý trong ngày' },
          { label: 'Số dư khả dụng', value: '411.500.000 ₫', sub: '38,1% hạn mức còn lại' },
        ].map((metric) => (
          <div key={metric.label} className="px-5 py-4">
            <div className={c.mutedText}>{metric.label}</div>
            <div className="mt-1.5 text-lg font-semibold tracking-tight tabular-nums">{metric.value}</div>
            <div className="mt-0.5 text-[11px] text-zinc-400">{metric.sub}</div>
          </div>
        ))}
      </div>

      {/* Status Quick Tabs + Inline Common Filter Row + Advanced Toggle */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-2">
          <div className="flex flex-wrap items-center gap-1">
            {statusTabs.map((tab) => {
              const active = filters.status === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => updateFilter('status', tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
                    active
                      ? 'bg-zinc-900 font-semibold text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-zinc-200/80 text-zinc-700'
                    }`}
                  >
                    {store.statusCounts[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {store.selectedCodes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className={c.badgeInfo}>Đã chọn {store.selectedCodes.length} dòng</span>
              <button type="button" onClick={store.bulkApproveSelected} className={c.btnSuccess}>
                <IconCheck size={13} />
                <span>Duyệt nhanh</span>
              </button>
            </div>
          )}
        </div>

        {/* Common Filters Always Visible */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[230px] flex-1">
            <IconSearch
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Tìm mã chứng từ, nội dung, người đề nghị..."
              className={`${c.input} pl-8`}
            />
          </div>

          <select
            value={filters.module}
            onChange={(e) => updateFilter('module', e.target.value as 'ALL' | ClassicModuleType)}
            className={`${c.select} w-40`}
            aria-label="Lọc phân hệ"
          >
            <option value="ALL">Phân hệ: Tất cả</option>
            <option value="Thanh toán">Thanh toán</option>
            <option value="Tạm ứng">Tạm ứng</option>
            <option value="Đề xuất Nội bộ">Đề xuất Nội bộ</option>
            <option value="IT Helpdesk">IT Helpdesk</option>
          </select>

          <select
            value={filters.budgetCode}
            onChange={(e) => updateFilter('budgetCode', e.target.value)}
            className={`${c.select} w-48`}
            aria-label="Lọc quỹ ngân sách"
          >
            <option value="ALL">Quỹ: Tất cả</option>
            {CLASSIC_BUDGET_OPTIONS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.label}
              </option>
            ))}
          </select>

          <select
            value={filters.department}
            onChange={(e) => updateFilter('department', e.target.value)}
            className={`${c.select} w-44`}
            aria-label="Lọc phòng ban"
          >
            <option value="ALL">Phòng ban: Tất cả</option>
            {CLASSIC_DEPARTMENT_OPTIONS.map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value as ClassicSortKey)}
            className={`${c.select} w-40`}
            aria-label="Sắp xếp"
          >
            <option value="date_desc">Mới nhất trước</option>
            <option value="date_asc">Cũ nhất trước</option>
            <option value="amount_desc">Số tiền cao → thấp</option>
            <option value="amount_asc">Số tiền thấp → cao</option>
            <option value="code_asc">Mã A → Z</option>
          </select>

          <button
            type="button"
            onClick={() => store.setIsAdvancedOpen((v) => !v)}
            className={store.isAdvancedOpen || store.activeAdvancedCount > 0 ? c.btnSecondary : c.btnOutline}
          >
            <IconAdjustmentsHorizontal size={14} />
            <span>Nâng cao</span>
            {store.activeAdvancedCount > 0 && (
              <span className="rounded bg-zinc-900 px-1.5 py-0.2 text-[10px] text-white">
                {store.activeAdvancedCount}
              </span>
            )}
          </button>
        </div>

        {store.isAdvancedOpen && <ClassicAdvancedFilterPanel theme={theme} store={store} />}
        <ClassicActiveFilterChips theme={theme} store={store} />
      </div>

      {/* Hairline Table with Inline Expandable Detail */}
      <div className={c.tableWrap}>
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
                  aria-label="Chọn tất cả trang"
                />
              </th>
              <th className={`${c.tableTh} w-8`} />
              <th className={c.tableTh}>Mã & Ngày</th>
              <th className={c.tableTh}>Nội dung hồ sơ</th>
              <th className={c.tableTh}>Quỹ / Phòng ban</th>
              <th className={`${c.tableTh} text-right`}>Giá trị</th>
              <th className={c.tableTh}>Trạng thái</th>
              <th className={`${c.tableTh} text-right`}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {store.paginatedItems.map((row) => {
              const isExpanded = expandedCode === row.code;
              return (
                <Fragment key={row.code}>
                  <tr
                    onClick={() => {
                      store.setActiveItemCode(row.code);
                      setExpandedCode((cur) => (cur === row.code ? null : row.code));
                    }}
                    className={`${c.tableRow} cursor-pointer ${isExpanded ? 'bg-zinc-50' : ''}`}
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
                    <td className="px-1 py-3 text-zinc-400">
                      {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    </td>
                    <td className={c.tableCell}>
                      <span className={c.codeTag}>{row.code}</span>
                      <div className={`mt-1 ${c.mutedText}`}>{row.dateDisplay}</div>
                    </td>
                    <td className={c.tableCell}>
                      <div className="flex flex-wrap items-center gap-1.5 font-medium text-zinc-900">
                        <span>{row.title}</span>
                        {row.isUrgent && <span className={c.badgeDanger}>Khẩn</span>}
                        {row.isOverBudget && <span className={c.badgeWarning}>Vượt quỹ</span>}
                      </div>
                      <div className={`mt-0.5 ${c.mutedText}`}>
                        {row.module} • {row.requester}
                      </div>
                    </td>
                    <td className={c.tableCell}>
                      <div className="font-mono text-[11px]">{row.budgetCode}</div>
                      <div className={c.mutedText}>{row.department}</div>
                    </td>
                    <td className={`${c.tableCell} text-right font-semibold tabular-nums`}>
                      {formatVndCompact(row.amount)}
                    </td>
                    <td className={c.tableCell}>{renderClassicStatusBadge(theme, row.status)}</td>
                    <td className={`${c.tableCell} text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenDrawer(row.code)}
                          className={c.btnIcon}
                          title="Mở Drawer chi tiết"
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

                  {/* Inline Accordion Expansion (Signature of Swiss Slate) */}
                  {isExpanded && (
                    <tr className="border-b border-zinc-200 bg-zinc-50/90">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                          <div className="space-y-2 lg:col-span-7">
                            <div className={c.heading3}>Tóm tắt nội dung & Xử lý nhanh</div>
                            <p className={c.bodyText}>{row.description}</p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {row.status === 'PENDING_APPROVAL' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => store.updateItemStatus(row.code, 'APPROVED')}
                                    className={c.btnSuccess}
                                  >
                                    <IconCheck size={13} />
                                    <span>Phê duyệt hồ sơ</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => store.updateItemStatus(row.code, 'REJECTED')}
                                    className={c.btnDanger}
                                  >
                                    <IconX size={13} />
                                    <span>Từ chối</span>
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenDrawer(row.code)}
                                className={c.btnOutline}
                              >
                                Xem toàn bộ hồ sơ →
                              </button>
                            </div>
                          </div>
                          <div className="lg:col-span-5">
                            <div className={`${c.card} p-3.5 text-xs space-y-1.5`}>
                              <div className="flex justify-between">
                                <span className={c.mutedText}>Người đề nghị</span>
                                <span className="font-medium">{row.requester}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={c.mutedText}>Phòng ban</span>
                                <span className="font-medium">{row.department}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={c.mutedText}>Nguồn ngân sách</span>
                                <span className="font-mono">{row.budgetCode}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {store.paginatedItems.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-xs text-zinc-500">
                  Không có hồ sơ nào khớp bộ lọc hiện tại.{' '}
                  <button type="button" onClick={store.resetAllFilters} className="font-semibold underline">
                    Đặt lại bộ lọc
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <ClassicPaginationBar theme={theme} store={store} />
      </div>

      {/* Bottom: Compact Budget + Collab + Full-Width Approval */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${c.card} xl:col-span-5`}>
          <div className={c.cardHeader}>
            <h2 className={c.heading2}>Sử dụng Quỹ Ngân sách FY26</h2>
          </div>
          <div className="space-y-3 p-4">
            {CLASSIC_BUDGET_BARS.map((fund) => (
              <div key={fund.code} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{fund.name}</span>
                  <span className="tabular-nums text-zinc-500">
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
        </div>

        <div className={`${c.card} xl:col-span-7`}>
          <div className={`${c.cardHeader} flex items-center justify-between`}>
            <h2 className={c.heading2}>Trao đổi hồ sơ {store.activeItem.code}</h2>
            {renderClassicStatusBadge(theme, store.activeItem.status)}
          </div>
          <div className="p-4">
            <ClassicCollabBox
              theme={theme}
              item={store.activeItem}
              onAddComment={store.addComment}
            />
          </div>
        </div>
      </div>

      <div className={c.card}>
        <div className={`${c.cardHeader} flex items-center justify-between`}>
          <h2 className={c.heading2}>
            Luồng Phê duyệt Đa cấp — {store.activeItem.code} (Full-Width)
          </h2>
          {renderClassicStatusBadge(theme, store.activeItem.status)}
        </div>
        <div className="p-4">
          <ClassicApprovalTimeline theme={theme} item={store.activeItem} />
        </div>
      </div>
    </div>
  );
}
