'use client';

import { useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconArrowsSort,
  IconBinaryTree,
  IconChevronsDown,
  IconChevronsUp,
  IconColumns3,
  IconInbox,
  IconLayoutGrid,
  IconListTree,
  IconMinus,
  IconPlus,
  IconRestore,
  IconSearch,
  IconSitemap,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import {
  collectOrgNodeIds,
  filterOrgHierarchy,
  findOrgNodePath,
  type OrgNodeId,
} from '@/lib/portable/org-chart-utils';
import { useI18n } from '@/shared/i18n/I18nContext';
import {
  CardsOrgChartView,
  ColumnsOrgChartView,
  CompactTreeOrgChartView,
  HorizontalOrgChartView,
  VerticalOrgChartView,
} from './OrgChartViews';
import { OrgDepartmentDrawer } from './OrgDepartmentDrawer';
import type {
  BranchOrgTreeData,
  OrgChartViewMode,
  OrgDepartmentNode,
} from './org-chart.types';

export type {
  BranchOrgTreeData,
  OrgChartViewMode,
  OrgDepartmentMember,
  OrgDepartmentNode,
} from './org-chart.types';

const STORAGE_VIEW_KEY = 'operon_hrm_org_chart_view';
const MIN_ZOOM = 60;
const MAX_ZOOM = 140;
const ZOOM_STEP = 10;

function readSavedViewMode(): OrgChartViewMode {
  if (typeof window === 'undefined') {
    return 'vertical';
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_VIEW_KEY);
    if (
      saved === 'vertical' ||
      saved === 'horizontal' ||
      saved === 'cards' ||
      saved === 'columns' ||
      saved === 'compact'
    ) {
      return saved;
    }
  } catch {
    // Ignore storage read failures in private mode
  }
  return 'vertical';
}

export function OrgChartTree({
  branches,
  canManage,
  onAddRoot,
  onAddChild,
  onEdit,
  onDelete,
}: {
  branches: BranchOrgTreeData[];
  canManage: boolean;
  onAddRoot: (branchId: number) => void;
  onAddChild: (branchId: number, parentId: number) => void;
  onEdit: (node: OrgDepartmentNode) => void;
  onDelete?: (node: OrgDepartmentNode) => void;
}) {
  const { tr, ln } = useI18n();

  const [viewMode, setViewMode] = useState<OrgChartViewMode>(() => readSavedViewMode());
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilterId, setBranchFilterId] = useState<number | 'ALL'>('ALL');
  const [showInactive, setShowInactive] = useState(true);
  const [showMembers, setShowMembers] = useState(true);
  const [collapsedIds, setCollapsedIds] = useState<Set<OrgNodeId>>(() => new Set());
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Selected node state for Inspector Drawer
  const [selectedRef, setSelectedRef] = useState<{
    branchId: number;
    nodeId: number;
  } | null>(null);

  // Drag-to-pan ref for canvas views
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }>({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const [isPanning, setIsPanning] = useState(false);

  function handleChangeView(nextMode: OrgChartViewMode) {
    setViewMode(nextMode);
    try {
      window.localStorage.setItem(STORAGE_VIEW_KEY, nextMode);
    } catch {
      // Ignore storage write errors
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const { filteredBranches, matchedIds, totalVisibleDepts } = useMemo(() => {
    const scopedBranches =
      branchFilterId === 'ALL'
        ? branches
        : branches.filter((b) => b.branchId === branchFilterId);

    const allMatched = new Set<OrgNodeId>();
    let deptCount = 0;

    const processed: BranchOrgTreeData[] = scopedBranches.map((branch) => {
      // Filter inactive if toggled off
      const activeFiltered = showInactive
        ? branch.departments
        : filterOrgHierarchy(branch.departments, (n) => n.isActive).nodes;

      if (!normalizedQuery) {
        deptCount += collectOrgNodeIds(activeFiltered).size;
        return {
          ...branch,
          departments: activeFiltered,
        };
      }

      const res = filterOrgHierarchy(activeFiltered, (node) => {
        const haystacks = [
          node.code,
          node.name,
          node.nameEn ?? '',
          node.description ?? '',
          node.managerName ?? '',
          node.managerCode ?? '',
          ...(node.members ?? []).map((m) => `${m.fullName} ${m.employeeCode} ${m.positionName}`),
        ];
        return haystacks.some((h) => h.toLowerCase().includes(normalizedQuery));
      });

      for (const id of res.matchedIds) {
        allMatched.add(id);
      }
      deptCount += collectOrgNodeIds(res.nodes).size;

      return {
        ...branch,
        departments: res.nodes,
      };
    });

    return {
      filteredBranches: normalizedQuery
        ? processed.filter((b) => b.departments.length > 0)
        : processed,
      matchedIds: allMatched,
      totalVisibleDepts: deptCount,
    };
  }, [branches, branchFilterId, showInactive, normalizedQuery]);

  // Resolve currently selected node & breadcrumb live from latest `branches` data
  const inspectorData = useMemo(() => {
    if (!selectedRef) {
      return { node: null, branch: null, breadcrumb: [] as OrgDepartmentNode[] };
    }
    const branch = branches.find((b) => b.branchId === selectedRef.branchId) ?? null;
    if (!branch) {
      return { node: null, branch: null, breadcrumb: [] as OrgDepartmentNode[] };
    }
    const breadcrumb = findOrgNodePath(branch.departments, selectedRef.nodeId);
    const node = breadcrumb[breadcrumb.length - 1] ?? null;
    return { node, branch, breadcrumb };
  }, [branches, selectedRef]);

  function handleToggleCollapse(id: OrgNodeId) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleExpandAll() {
    setCollapsedIds(new Set());
  }

  function handleCollapseAll() {
    const ids = new Set<OrgNodeId>();
    for (const branch of filteredBranches) {
      for (const id of collectOrgNodeIds(branch.departments)) {
        ids.add(id);
      }
    }
    setCollapsedIds(ids);
  }

  function handleCanvasMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-org-node-card="true"], button, a, input, select')) {
      return;
    }
    const container = canvasRef.current;
    if (!container) {
      return;
    }
    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    setIsPanning(true);
  }

  function handleCanvasMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!dragStateRef.current.isDragging || !canvasRef.current) {
      return;
    }
    const dx = event.clientX - dragStateRef.current.startX;
    const dy = event.clientY - dragStateRef.current.startY;
    canvasRef.current.scrollLeft = dragStateRef.current.scrollLeft - dx;
    canvasRef.current.scrollTop = dragStateRef.current.scrollTop - dy;
  }

  function handleCanvasMouseUp() {
    if (dragStateRef.current.isDragging) {
      dragStateRef.current.isDragging = false;
      setIsPanning(false);
    }
  }

  const viewOptions: Array<{
    key: OrgChartViewMode;
    label: string;
    icon: typeof IconSitemap;
  }> = [
    { key: 'vertical', label: tr('Sơ đồ dọc', 'Top-Down'), icon: IconSitemap },
    { key: 'horizontal', label: tr('Sơ đồ ngang', 'Horizontal'), icon: IconBinaryTree },
    { key: 'cards', label: tr('Lưới thẻ', 'Card Grid'), icon: IconLayoutGrid },
    { key: 'columns', label: tr('Cột phân cấp', 'Columns'), icon: IconColumns3 },
    { key: 'compact', label: tr('Danh sách cây', 'Tree List'), icon: IconListTree },
  ];

  const isDiagramCanvas = viewMode === 'vertical' || viewMode === 'horizontal';
  const effectiveCollapsed = normalizedQuery ? new Set<OrgNodeId>() : collapsedIds;

  const sharedViewProps = {
    branches: filteredBranches,
    canManage,
    collapsedIds: effectiveCollapsed,
    matchedIds,
    hasSearchQuery: Boolean(normalizedQuery),
    showMembers,
    selectedNodeId: inspectorData.node?.id ?? null,
    onToggleCollapse: handleToggleCollapse,
    onSelectNode: (node: OrgDepartmentNode, branch: BranchOrgTreeData) => {
      setSelectedRef({ branchId: branch.branchId, nodeId: node.id });
    },
    onAddRoot,
    onAddChild,
    onEdit,
    onDelete,
  };

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-40 flex flex-col bg-[#EEF2F6] p-4 sm:p-6'
          : 'w-full space-y-4'
      }
    >
      {/* Interactive Org Chart Control Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* 5-Mode View Switcher */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            {viewOptions.map((opt) => {
              const Icon = opt.icon;
              const active = viewMode === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleChangeView(opt.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  }`}
                >
                  <Icon size={15} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Display Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:w-64 sm:flex-none">
              <IconSearch
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(
                  'Tìm phòng ban, trưởng BP, nhân sự...',
                  'Search dept, manager, staff...',
                )}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-8 pl-9 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={tr('Xóa tìm kiếm', 'Clear search')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMembers((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                showMembers
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <IconUsers size={14} />
              <span>{tr('Nhân sự', 'Staff')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInactive((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                showInactive
                  ? 'border-slate-300 bg-slate-100 text-slate-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <IconArrowsSort size={14} />
              <span>{tr('Tạm ngưng', 'Inactive')}</span>
            </button>

            {(isDiagramCanvas || viewMode === 'compact') && (
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  title={tr('Mở rộng tất cả', 'Expand all')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  <IconChevronsDown size={14} />
                  <span className="hidden sm:inline">{tr('Mở hết', 'Expand')}</span>
                </button>
                <div className="h-4 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  title={tr('Thu gọn tất cả', 'Collapse all')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  <IconChevronsUp size={14} />
                  <span className="hidden sm:inline">{tr('Thu gọn', 'Collapse')}</span>
                </button>
              </div>
            )}

            {isDiagramCanvas && (
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  disabled={zoomPercent <= MIN_ZOOM}
                  onClick={() => setZoomPercent((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                  title={tr('Thu nhỏ', 'Zoom out')}
                  className="p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <IconMinus size={14} />
                </button>
                <span className="min-w-[44px] text-center font-mono text-[11px] font-semibold text-slate-700">
                  {zoomPercent}%
                </span>
                <button
                  type="button"
                  disabled={zoomPercent >= MAX_ZOOM}
                  onClick={() => setZoomPercent((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                  title={tr('Phóng to', 'Zoom in')}
                  className="p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <IconPlus size={14} />
                </button>
                <div className="h-4 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => setZoomPercent(100)}
                  title={tr('Đặt lại 100%', 'Reset zoom to 100%')}
                  className="p-1.5 text-slate-600 hover:bg-slate-50"
                >
                  <IconRestore size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              title={
                isFullscreen
                  ? tr('Thoát toàn màn hình', 'Exit fullscreen')
                  : tr('Xem toàn màn hình', 'Fullscreen canvas')
              }
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              {isFullscreen ? <IconArrowsMinimize size={15} /> : <IconArrowsMaximize size={15} />}
            </button>
          </div>
        </div>

        {/* Branch Quick-Filter Pills + Match Count */}
        {(branches.length > 1 || normalizedQuery) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {branches.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setBranchFilterId('ALL')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      branchFilterId === 'ALL'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tr('Tất cả chi nhánh', 'All Branches')} ({branches.length})
                  </button>
                  {branches.map((b) => (
                    <button
                      key={b.branchId}
                      type="button"
                      onClick={() => setBranchFilterId(b.branchId)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        branchFilterId === b.branchId
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {ln(b.branchName, b.branchNameEn)} ({b.branchCode})
                    </button>
                  ))}
                </>
              )}
            </div>

            <div className="text-xs text-slate-500">
              {normalizedQuery ? (
                <span>
                  {tr('Tìm thấy', 'Found')}{' '}
                  <strong className="text-slate-900">{matchedIds.size}</strong>{' '}
                  {tr('phòng ban phù hợp', 'matching departments')}
                </span>
              ) : (
                <span>
                  {tr('Đang hiển thị', 'Showing')}{' '}
                  <strong className="text-slate-900">{totalVisibleDepts}</strong>{' '}
                  {tr('phòng ban', 'departments')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Org Chart Viewport */}
      {filteredBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <IconInbox size={36} className="text-slate-400" />
          <p className="mt-2.5 text-sm font-semibold text-slate-800">
            {normalizedQuery
              ? tr('Không tìm thấy phòng ban hoặc nhân sự phù hợp', 'No matching departments or staff')
              : tr('Chưa có dữ liệu sơ đồ tổ chức', 'No organization chart data available')}
          </p>
          {normalizedQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-3 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {tr('Xóa bộ lọc tìm kiếm', 'Clear search filter')}
            </button>
          )}
        </div>
      ) : isDiagramCanvas ? (
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          className={`relative w-full overflow-auto rounded-2xl border border-slate-200 bg-[#F8FAFC] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] shadow-inner select-none ${
            isFullscreen ? 'flex-1' : 'min-h-[580px] max-h-[76vh]'
          } ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {/* Hint Badge */}
          <div className="pointer-events-none sticky top-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-2xs backdrop-blur-xs">
            <span>
              {tr(
                'Kéo vùng trống để di chuyển · Nhấp vào thẻ phòng ban để xem nhân sự',
                'Drag empty area to pan · Click any department card to inspect staff',
              )}
            </span>
          </div>

          <div
            style={{
              transform: `scale(${zoomPercent / 100})`,
              transformOrigin: viewMode === 'vertical' ? 'top center' : 'top left',
            }}
            className="min-w-max transition-transform duration-150"
          >
            {viewMode === 'vertical' ? (
              <VerticalOrgChartView {...sharedViewProps} />
            ) : (
              <HorizontalOrgChartView {...sharedViewProps} />
            )}
          </div>
        </div>
      ) : (
        <div className={isFullscreen ? 'flex-1 overflow-y-auto' : 'w-full'}>
          {viewMode === 'cards' && <CardsOrgChartView {...sharedViewProps} />}
          {viewMode === 'columns' && <ColumnsOrgChartView {...sharedViewProps} />}
          {viewMode === 'compact' && <CompactTreeOrgChartView {...sharedViewProps} />}
        </div>
      )}

      {/* Slide-over Inspector Drawer */}
      <OrgDepartmentDrawer
        node={inspectorData.node}
        branch={inspectorData.branch}
        breadcrumb={inspectorData.breadcrumb}
        canManage={canManage}
        onClose={() => setSelectedRef(null)}
        onSelectNode={(nextNode) => {
          if (inspectorData.branch) {
            setSelectedRef({ branchId: inspectorData.branch.branchId, nodeId: nextNode.id });
          }
        }}
        onAddChild={onAddChild}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
