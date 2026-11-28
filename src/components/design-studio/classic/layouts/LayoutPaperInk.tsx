'use client';

import { useState } from 'react';
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconEye,
  IconFileExport,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconRotateClockwise,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { CLASSIC_BUDGET_BARS, CLASSIC_MONTHLY_CHART, type ClassicThemeTokens } from '../classic-themes';
import {
  ClassicActiveFilterChips,
  ClassicApprovalTimeline,
  ClassicCollabBox,
  ClassicPaginationBar,
  renderClassicStatusBadge,
} from '../ClassicFilterParts';
import {
  CLASSIC_BUDGET_OPTIONS,
  CLASSIC_DEPARTMENT_OPTIONS,
  formatStatusLabel,
  formatVndCompact,
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
 * Layout #3 — Paper & Ink:
 * - Warm Editorial Header with inline key totals
 * - Dedicated Left Vertical Filter Rail (3 cols): Common Filters always visible + Collapsible Advanced Accordion inside Rail
 * - Right Workspace (9 cols) with Live Toggle: Ledger Table View vs Structured Editorial Cards View
 */
export function LayoutPaperInk({ theme, store, onOpenModal, onOpenDrawer }: LayoutProps) {
  const c = theme.classes;
  const { filters, updateFilter, activeItem } = store;
  const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('cards');

  return (
    <div className="w-full space-y-5">
      {/* Editorial Header + Inline Key Metrics */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E2DC] pb-4">
        <div>
          <span className={c.heading3}>Layout 3 • Left Vertical Filter Rail & Ledger/Card Toggle</span>
          <h1 className={`mt-1 ${c.heading1}`}>Sổ Hồ sơ Thanh toán & Đề xuất</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-stone-600">
            <span>
              Ngân sách FY26: <strong className="text-stone-900 tabular-nums">1.080.000.000 ₫</strong>
            </span>
            <span>
              Khả dụng: <strong className="text-[#1F515B] tabular-nums">411.500.000 ₫</strong>
            </span>
            <span>
              Đang lọc: <strong className="text-stone-900 tabular-nums">{formatVndCompact(store.filteredTotalAmount)}</strong> ({store.filteredItems.length} hồ sơ)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={c.segmentedWrap}>
            <button
              type="button"
              onClick={() => setDisplayMode('cards')}
              className={displayMode === 'cards' ? c.segmentedActive : c.segmentedIdle}
            >
              <span className="inline-flex items-center gap-1">
                <IconLayoutGrid size={13} /> Dạng Thẻ
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('table')}
              className={displayMode === 'table' ? c.segmentedActive : c.segmentedIdle}
            >
              <span className="inline-flex items-center gap-1">
                <IconList size={13} /> Dạng Sổ cái
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => store.showToast('Đã xuất sổ hồ sơ ra Excel.')}
            className={c.btnOutline}
          >
            <IconFileExport size={14} />
            <span>Xuất Excel</span>
          </button>
          <button type="button" onClick={onOpenModal} className={c.btnPrimary}>
            <IconPlus size={14} />
            <span>Lập hồ sơ mới</span>
          </button>
        </div>
      </div>

      {/* Two-Column Editorial Layout: Left Sticky Vertical Filter Panel (3 cols) + Right Content (9 cols) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left Vertical Filter Rail (Unique to Paper & Ink) */}
        <aside className="xl:col-span-3">
          <div className={`${c.card} sticky top-20 space-y-4 p-4`}>
            <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2.5">
              <span className={c.heading2}>Bộ lọc Thường dùng</span>
              {store.activeFilterChips.length > 0 && (
                <button type="button" onClick={store.resetAllFilters} className={c.btnGhost}>
                  <IconRotateClockwise size={13} />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>

            <div>
              <label className={c.label}>Tìm kiếm</label>
              <div className="relative">
                <IconSearch
                  size={13}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-stone-400"
                />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Mã, tiêu đề, người lập..."
                  className={`${c.input} pl-8`}
                />
              </div>
            </div>

            <div>
              <label className={c.label}>Trạng thái hồ sơ</label>
              <div className="space-y-1">
                {(
                  [
                    'ALL',
                    'PENDING_APPROVAL',
                    'APPROVED',
                    'IN_EXECUTION',
                    'COMPLETED',
                    'REJECTED',
                  ] as const
                ).map((st) => {
                  const active = filters.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => updateFilter('status', st)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                        active
                          ? 'bg-stone-800 font-semibold text-stone-50'
                          : 'text-stone-700 hover:bg-[#F5F3EE]'
                      }`}
                    >
                      <span>{st === 'ALL' ? 'Tất cả trạng thái' : formatStatusLabel(st)}</span>
                      <span
                        className={`rounded-full px-2 py-0.2 text-[10px] tabular-nums ${
                          active ? 'bg-white/20 text-white' : 'bg-[#EFECE6] text-stone-600'
                        }`}
                      >
                        {store.statusCounts[st]}
                      </span>
                    </button>
                  );
                })}
              </div>
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
                <option value="ALL">Tất cả phòng ban</option>
                {CLASSIC_DEPARTMENT_OPTIONS.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={c.label}>Sắp xếp</label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value as ClassicSortKey)}
                className={c.select}
              >
                <option value="date_desc">Mới nhất trước</option>
                <option value="date_asc">Cũ nhất trước</option>
                <option value="amount_desc">Giá trị cao → thấp</option>
                <option value="amount_asc">Giá trị thấp → cao</option>
                <option value="code_asc">Mã A → Z</option>
              </select>
            </div>

            {/* Collapsible Extra / Advanced Filters Inside Rail */}
            <div className="border-t border-[#EFECE6] pt-3">
              <button
                type="button"
                onClick={() => store.setIsAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-semibold text-stone-800"
              >
                <span className="inline-flex items-center gap-1.5">
                  <IconAdjustmentsHorizontal size={14} />
                  Lọc nâng cao (Extra)
                </span>
                {store.activeAdvancedCount > 0 ? (
                  <span className={c.badgeInfo}>{store.activeAdvancedCount}</span>
                ) : (
                  <span className={c.mutedText}>{store.isAdvancedOpen ? 'Thu gọn' : 'Mở rộng'}</span>
                )}
              </button>

              {store.isAdvancedOpen && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={c.label}>Từ ngày</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => updateFilter('dateFrom', e.target.value)}
                      className={c.input}
                    />
                  </div>
                  <div>
                    <label className={c.label}>Đến ngày</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => updateFilter('dateTo', e.target.value)}
                      className={c.input}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={c.label}>Tiền từ</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={filters.minAmount}
                        onChange={(e) => updateFilter('minAmount', e.target.value)}
                        className={c.input}
                      />
                    </div>
                    <div>
                      <label className={c.label}>Tiền đến</label>
                      <input
                        type="number"
                        placeholder="∞"
                        value={filters.maxAmount}
                        onChange={(e) => updateFilter('maxAmount', e.target.value)}
                        className={c.input}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={c.label}>Người đề nghị</label>
                    <input
                      type="text"
                      placeholder="Tên nhân sự..."
                      value={filters.requester}
                      onChange={(e) => updateFilter('requester', e.target.value)}
                      className={c.input}
                    />
                  </div>
                  <div>
                    <label className={c.label}>Cờ cảnh báo</label>
                    <select
                      value={filters.flagFilter}
                      onChange={(e) =>
                        updateFilter('flagFilter', e.target.value as 'ALL' | 'URGENT' | 'OVER_BUDGET')
                      }
                      className={c.select}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="URGENT">Hồ sơ Khẩn cấp</option>
                      <option value="OVER_BUDGET">Hồ sơ Vượt ngân sách</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right Main Content (9 cols) */}
        <div className="space-y-4 xl:col-span-9">
          <ClassicActiveFilterChips theme={theme} store={store} />

          {displayMode === 'cards' ? (
            /* Structured Editorial Cards View */
            <div className="space-y-3">
              {store.paginatedItems.map((row) => {
                const isSelected = activeItem.code === row.code;
                return (
                  <div
                    key={row.code}
                    onClick={() => store.setActiveItemCode(row.code)}
                    className={`${c.card} cursor-pointer p-4 transition ${
                      isSelected ? 'ring-2 ring-[#1F515B]/35' : 'hover:border-stone-400'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={c.codeTag}>{row.code}</span>
                          <span className={c.badgeNeutral}>{row.module}</span>
                          {renderClassicStatusBadge(theme, row.status)}
                          {row.isUrgent && <span className={c.badgeDanger}>Khẩn</span>}
                          {row.isOverBudget && <span className={c.badgeWarning}>Vượt quỹ</span>}
                        </div>
                        <h3 className="text-sm font-semibold text-stone-900">{row.title}</h3>
                        <p className={c.mutedText}>{row.description}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-bold tabular-nums text-stone-900">
                          {formatVndCompact(row.amount)}
                        </div>
                        <div className={`mt-0.5 ${c.mutedText}`}>{row.dateDisplay}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFECE6] pt-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-3 text-stone-600">
                        <span>
                          Người lập: <strong className="text-stone-900">{row.requester}</strong>
                        </span>
                        <span>•</span>
                        <span>{row.department}</span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">{row.budgetCode}</span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {row.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              type="button"
                              onClick={() => store.updateItemStatus(row.code, 'APPROVED')}
                              className={c.btnSuccess}
                            >
                              <IconCheck size={13} /> Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => store.updateItemStatus(row.code, 'REJECTED')}
                              className={c.btnDanger}
                            >
                              <IconX size={13} /> Từ chối
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDrawer(row.code)}
                          className={c.btnOutline}
                        >
                          <IconEye size={13} /> Chi tiết
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {store.paginatedItems.length === 0 && (
                <div className={`${c.card} p-10 text-center text-xs text-stone-500`}>
                  Không có hồ sơ nào phù hợp điều kiện lọc.
                </div>
              )}

              <div className={c.card}>
                <ClassicPaginationBar theme={theme} store={store} />
              </div>
            </div>
          ) : (
            /* Ledger Table View */
            <div className={c.tableWrap}>
              <table className="w-full border-collapse">
                <thead className={c.tableHead}>
                  <tr>
                    <th className={c.tableTh}>Mã & Ngày</th>
                    <th className={c.tableTh}>Hồ sơ</th>
                    <th className={c.tableTh}>Quỹ / Phòng ban</th>
                    <th className={`${c.tableTh} text-right`}>Số tiền</th>
                    <th className={c.tableTh}>Trạng thái</th>
                    <th className={`${c.tableTh} text-right`}>Xem</th>
                  </tr>
                </thead>
                <tbody>
                  {store.paginatedItems.map((row) => (
                    <tr
                      key={row.code}
                      onClick={() => store.setActiveItemCode(row.code)}
                      className={`${c.tableRow} cursor-pointer`}
                    >
                      <td className={c.tableCell}>
                        <span className={c.codeTag}>{row.code}</span>
                        <div className={`mt-1 ${c.mutedText}`}>{row.dateDisplay}</div>
                      </td>
                      <td className={c.tableCell}>
                        <div className="font-medium text-stone-900">{row.title}</div>
                        <div className={c.mutedText}>
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
                      <td className={`${c.tableCell} text-right`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDrawer(row.code);
                          }}
                          className={c.btnIcon}
                        >
                          <IconEye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ClassicPaginationBar theme={theme} store={store} />
            </div>
          )}

          {/* Budget & Monthly Chart Row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className={`${c.card} p-4 lg:col-span-7 space-y-3`}>
              <h2 className={c.heading2}>Phân bổ Ngân sách theo Quỹ</h2>
              {CLASSIC_BUDGET_BARS.map((fund) => (
                <div key={fund.code} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{fund.name}</span>
                    <span className="tabular-nums text-stone-500">
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

            <div className={`${c.card} p-4 lg:col-span-5`}>
              <h2 className={c.heading2}>Thực chi 6 tháng gần nhất</h2>
              <div className="mt-4 flex h-36 items-end justify-between gap-2">
                {CLASSIC_MONTHLY_CHART.map((col) => (
                  <div key={col.month} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-28 items-end gap-1">
                      <div className={`w-2.5 rounded-t-xs ${c.chartBarSecondary}`} style={{ height: `${col.allocated}%` }} />
                      <div className={`w-2.5 rounded-t-xs ${c.chartBarPrimary}`} style={{ height: `${col.actual}%` }} />
                    </div>
                    <span className={c.mutedText}>{col.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Collaboration + Full-Width Approval Workflow */}
          <div className={c.card}>
            <div className={`${c.cardHeader} flex items-center justify-between`}>
              <h2 className={c.heading2}>Trao đổi & Luồng Phê duyệt — {activeItem.code}</h2>
              {renderClassicStatusBadge(theme, activeItem.status)}
            </div>
            <div className="space-y-4 p-4">
              <ClassicCollabBox theme={theme} item={activeItem} onAddComment={store.addComment} />
              <hr className={`border-t ${c.divider}`} />
              <ClassicApprovalTimeline theme={theme} item={activeItem} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
