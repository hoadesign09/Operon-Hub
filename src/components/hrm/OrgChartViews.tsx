'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  IconBuilding,
  IconBuildingSkyscraper,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconHierarchy2,
  IconPlus,
  IconTrash,
  IconUser,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react';
import {
  flattenOrgHierarchy,
  getOrgAvatarInitials,
  type OrgNodeId,
} from '@/lib/portable/org-chart-utils';
import { useI18n } from '@/shared/i18n/I18nContext';
import {
  getOrgDepthTheme,
  type BranchOrgTreeData,
  type OrgDepartmentNode,
} from './org-chart.types';

export interface OrgViewSharedProps {
  branches: BranchOrgTreeData[];
  canManage: boolean;
  collapsedIds: Set<OrgNodeId>;
  matchedIds: Set<OrgNodeId>;
  hasSearchQuery: boolean;
  showMembers: boolean;
  selectedNodeId: number | null;
  onToggleCollapse: (id: OrgNodeId) => void;
  onSelectNode: (node: OrgDepartmentNode, branch: BranchOrgTreeData) => void;
  onAddRoot: (branchId: number) => void;
  onAddChild: (branchId: number, parentId: number) => void;
  onEdit: (node: OrgDepartmentNode) => void;
  onDelete?: (node: OrgDepartmentNode) => void;
}

/* ============================================================================
 * Shared Org Card (used inside Vertical & Horizontal Interactive Diagrams)
 * ========================================================================== */

interface DiagramNodeCardProps {
  node: OrgDepartmentNode;
  branch: BranchOrgTreeData;
  depth: number;
  orientation: 'vertical' | 'horizontal';
  canManage: boolean;
  isCollapsed: boolean;
  isMatched: boolean;
  isDimmed: boolean;
  isSelected: boolean;
  showMembers: boolean;
  onToggleCollapse: (id: OrgNodeId) => void;
  onSelectNode: (node: OrgDepartmentNode, branch: BranchOrgTreeData) => void;
  onAddChild: (branchId: number, parentId: number) => void;
  onEdit: (node: OrgDepartmentNode) => void;
  onDelete?: (node: OrgDepartmentNode) => void;
}

function DiagramNodeCard({
  node,
  branch,
  depth,
  orientation,
  canManage,
  isCollapsed,
  isMatched,
  isDimmed,
  isSelected,
  showMembers,
  onToggleCollapse,
  onSelectNode,
  onAddChild,
  onEdit,
  onDelete,
}: DiagramNodeCardProps) {
  const { tr, ln } = useI18n();
  const theme = getOrgDepthTheme(depth);
  const hasChildren = node.children.length > 0;
  const members = node.members ?? [];
  const directStaff = node.employeeCount ?? members.length;
  const totalStaff = node.totalEmployeeCount ?? directStaff;

  return (
    <div
      data-org-node-card="true"
      className={`group relative flex flex-col rounded-2xl border bg-white text-left shadow-sm transition-all duration-150 ${
        orientation === 'vertical' ? 'w-[258px]' : 'w-[272px]'
      } ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/25 shadow-md'
          : isMatched
            ? 'border-amber-400 ring-2 ring-amber-300/50 shadow-md'
            : `border-slate-200/90 ${theme.ringHover} hover:shadow-md`
      } ${isDimmed ? 'opacity-45' : 'opacity-100'} ${!node.isActive ? 'bg-slate-50/90' : ''}`}
    >
      {/* Top Color Strip */}
      <div className={`h-1.5 w-full rounded-t-2xl ${theme.topBar}`} />

      {/* Main Clickable Content */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectNode(node, branch)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectNode(node, branch);
          }
        }}
        className="cursor-pointer p-3.5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ring-1 ${theme.badgeBg}`}
              >
                {node.code}
              </span>
              {!node.isActive && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {tr('Tạm ngưng', 'Inactive')}
                </span>
              )}
            </div>
            <h3
              className="mt-1.5 line-clamp-2 text-[13px] leading-snug font-bold text-slate-900"
              title={ln(node.name, node.nameEn)}
            >
              {ln(node.name, node.nameEn)}
            </h3>
          </div>

          <span
            className="shrink-0 rounded-lg p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-blue-600"
            title={tr('Xem chi tiết', 'View details')}
          >
            <IconEye size={14} />
          </span>
        </div>

        {/* Manager Row */}
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2">
          {node.managerName ? (
            <>
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${theme.avatarBg} text-[10px] font-bold text-white shadow-xs`}
              >
                {getOrgAvatarInitials(node.managerName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-800">
                  {node.managerName}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {ln(node.managerPosition, node.managerPositionEn) ||
                    tr('Trưởng bộ phận', 'Dept Head')}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <IconUser size={13} />
              <span className="italic">{tr('Chưa gán trưởng BP', 'No manager assigned')}</span>
            </div>
          )}
        </div>

        {/* Metrics Footer */}
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1 font-semibold text-slate-700"
              title={tr('Nhân sự trực tiếp / Tổng toàn nhánh', 'Direct staff / Total subtree')}
            >
              <IconUsers size={13} className="text-blue-500" />
              <span>{directStaff}</span>
              {totalStaff !== directStaff && (
                <span className="font-normal text-slate-400">/ {totalStaff}</span>
              )}
            </span>
            {hasChildren && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <IconHierarchy2 size={13} className="text-teal-500" />
                <span>{node.children.length}</span>
              </span>
            )}
          </div>

          {canManage && (
            <div
              className="flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onAddChild(node.branchId, node.id)}
                title={tr('Thêm phòng ban con', 'Add sub-department')}
                className="rounded-md p-1 text-blue-600 hover:bg-blue-50"
              >
                <IconPlus size={13} />
              </button>
              <button
                type="button"
                onClick={() => onEdit(node)}
                title={tr('Chỉnh sửa phòng ban', 'Edit department')}
                className="rounded-md p-1 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
              >
                <IconEdit size={13} />
              </button>
              {onDelete && !hasChildren && (
                <button
                  type="button"
                  onClick={() => onDelete(node)}
                  title={tr('Xóa mềm phòng ban', 'Soft delete department')}
                  className="rounded-md p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                >
                  <IconTrash size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Optional Member Avatar Stack */}
        {showMembers && members.length > 0 && (
          <div className="mt-2.5 border-t border-slate-100 pt-2">
            <div className="flex flex-wrap items-center gap-1">
              {members.slice(0, 4).map((m) => (
                <span
                  key={m.id}
                  title={`${m.fullName} — ${ln(m.positionName, m.positionNameEn)}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="max-w-[92px] truncate">{m.fullName}</span>
                </span>
              ))}
              {members.length > 4 && (
                <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  +{members.length - 4}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expand/Collapse Pill positioned directly on connector edge */}
      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(node.id);
          }}
          aria-label={isCollapsed ? tr('Mở rộng nhánh con', 'Expand children') : tr('Thu gọn nhánh con', 'Collapse children')}
          className={`z-10 inline-flex items-center justify-center gap-0.5 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-xs transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 ${
            orientation === 'vertical'
              ? 'absolute -bottom-3 left-1/2 -translate-x-1/2'
              : 'absolute top-1/2 -right-3 -translate-y-1/2'
          }`}
        >
          {isCollapsed ? (
            <>
              <span>+{node.children.length}</span>
            </>
          ) : orientation === 'vertical' ? (
            <IconChevronDown size={12} />
          ) : (
            <IconChevronRight size={12} />
          )}
        </button>
      )}
    </div>
  );
}

/* ============================================================================
 * VIEW 1: Classic Top-Down Vertical Hierarchy Org Chart
 * ========================================================================== */

function VerticalBranchNode({
  node,
  branch,
  depth,
  props,
}: {
  node: OrgDepartmentNode;
  branch: BranchOrgTreeData;
  depth: number;
  props: OrgViewSharedProps;
}) {
  const isCollapsed = props.collapsedIds.has(node.id);
  const isMatched = props.matchedIds.has(node.id);
  const isDimmed = props.hasSearchQuery && !isMatched;
  const visibleChildren = !isCollapsed ? node.children : [];

  return (
    <div className="flex flex-col items-center">
      <DiagramNodeCard
        node={node}
        branch={branch}
        depth={depth}
        orientation="vertical"
        canManage={props.canManage}
        isCollapsed={isCollapsed}
        isMatched={isMatched}
        isDimmed={isDimmed}
        isSelected={props.selectedNodeId === node.id}
        showMembers={props.showMembers}
        onToggleCollapse={props.onToggleCollapse}
        onSelectNode={props.onSelectNode}
        onAddChild={props.onAddChild}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
      />

      {visibleChildren.length > 0 && (
        <>
          <div className="h-7 w-0.5 bg-slate-300" />
          <div className="flex items-start justify-center">
            {visibleChildren.map((child, idx) => (
              <div key={child.id} className="relative flex flex-col items-center px-3 pt-6">
                {/* Vertical Drop Line */}
                <div className="absolute top-0 left-1/2 h-6 w-0.5 -translate-x-1/2 bg-slate-300" />
                {/* Horizontal Crossbar */}
                {visibleChildren.length > 1 && (
                  <div
                    className={`absolute top-0 h-0.5 bg-slate-300 ${
                      idx === 0
                        ? 'right-0 left-1/2'
                        : idx === visibleChildren.length - 1
                          ? 'right-1/2 left-0'
                          : 'right-0 left-0'
                    }`}
                  />
                )}
                <VerticalBranchNode
                  node={child}
                  branch={branch}
                  depth={depth + 1}
                  props={props}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function VerticalOrgChartView(props: OrgViewSharedProps) {
  const { tr, ln } = useI18n();

  return (
    <div className="inline-flex min-w-full flex-col items-center gap-12 px-8 py-8">
      {props.branches.map((branch) => (
        <div key={branch.branchId} className="flex flex-col items-center">
          {/* Branch Root Executive Card */}
          <div
            data-org-node-card="true"
            className="flex min-w-[300px] items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-gradient-to-br from-[#0B1324] via-[#13203B] to-[#1D3557] px-5 py-4 text-white shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-md">
                <IconBuildingSkyscraper size={22} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold tracking-wider text-cyan-300 uppercase">
                    {branch.branchCode}
                  </span>
                  {branch.isHeadquarters && (
                    <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 ring-1 ring-cyan-400/30">
                      {tr('Trụ sở chính', 'Headquarters')}
                    </span>
                  )}
                </div>
                <h2 className="mt-0.5 text-base font-bold text-white">
                  {ln(branch.branchName, branch.branchNameEn)}
                </h2>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <IconHierarchy2 size={13} className="text-cyan-400" />
                    <span>
                      {branch.totalDepartments ?? branch.departments.length}{' '}
                      {tr('phòng ban', 'depts')}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IconUsersGroup size={13} className="text-blue-300" />
                    <span>
                      {branch.totalEmployees ?? 0} {tr('nhân sự', 'staff')}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {props.canManage && (
              <button
                type="button"
                onClick={() => props.onAddRoot(branch.branchId)}
                title={tr('Thêm phòng ban cấp gốc', 'Add root department')}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                <IconPlus size={14} />
                <span>{tr('Thêm gốc', 'Add Root')}</span>
              </button>
            )}
          </div>

          {branch.departments.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white/90 px-5 py-4 text-xs text-slate-500">
              {tr(
                'Chi nhánh này chưa có phòng ban nào được thiết lập.',
                'No departments have been configured for this branch yet.',
              )}
            </div>
          ) : (
            <>
              <div className="h-7 w-0.5 bg-slate-300" />
              <div className="flex items-start justify-center">
                {branch.departments.map((rootNode, idx) => (
                  <div key={rootNode.id} className="relative flex flex-col items-center px-3 pt-6">
                    <div className="absolute top-0 left-1/2 h-6 w-0.5 -translate-x-1/2 bg-slate-300" />
                    {branch.departments.length > 1 && (
                      <div
                        className={`absolute top-0 h-0.5 bg-slate-300 ${
                          idx === 0
                            ? 'right-0 left-1/2'
                            : idx === branch.departments.length - 1
                              ? 'right-1/2 left-0'
                              : 'right-0 left-0'
                        }`}
                      />
                    )}
                    <VerticalBranchNode
                      node={rootNode}
                      branch={branch}
                      depth={0}
                      props={props}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
 * VIEW 2: Left-to-Right Horizontal Mindmap Org Chart
 * ========================================================================== */

function HorizontalBranchNode({
  node,
  branch,
  depth,
  props,
}: {
  node: OrgDepartmentNode;
  branch: BranchOrgTreeData;
  depth: number;
  props: OrgViewSharedProps;
}) {
  const isCollapsed = props.collapsedIds.has(node.id);
  const isMatched = props.matchedIds.has(node.id);
  const isDimmed = props.hasSearchQuery && !isMatched;
  const visibleChildren = !isCollapsed ? node.children : [];

  return (
    <div className="flex items-center">
      <DiagramNodeCard
        node={node}
        branch={branch}
        depth={depth}
        orientation="horizontal"
        canManage={props.canManage}
        isCollapsed={isCollapsed}
        isMatched={isMatched}
        isDimmed={isDimmed}
        isSelected={props.selectedNodeId === node.id}
        showMembers={props.showMembers}
        onToggleCollapse={props.onToggleCollapse}
        onSelectNode={props.onSelectNode}
        onAddChild={props.onAddChild}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
      />

      {visibleChildren.length > 0 && (
        <>
          <div className="h-0.5 w-8 shrink-0 bg-slate-300" />
          <div className="flex flex-col justify-center">
            {visibleChildren.map((child, idx) => (
              <div key={child.id} className="relative flex items-center py-2.5 pl-7">
                {/* Horizontal connector into child */}
                <div className="absolute top-1/2 left-0 h-0.5 w-7 -translate-y-1/2 bg-slate-300" />
                {/* Vertical connector across siblings */}
                {visibleChildren.length > 1 && (
                  <div
                    className={`absolute left-0 w-0.5 bg-slate-300 ${
                      idx === 0
                        ? 'top-1/2 bottom-0'
                        : idx === visibleChildren.length - 1
                          ? 'top-0 bottom-1/2'
                          : 'top-0 bottom-0'
                    }`}
                  />
                )}
                <HorizontalBranchNode
                  node={child}
                  branch={branch}
                  depth={depth + 1}
                  props={props}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function HorizontalOrgChartView(props: OrgViewSharedProps) {
  const { tr, ln } = useI18n();

  return (
    <div className="inline-flex min-w-full flex-col items-start gap-10 px-8 py-8">
      {props.branches.map((branch) => (
        <div key={branch.branchId} className="flex items-center">
          {/* Left Branch Root */}
          <div
            data-org-node-card="true"
            className="flex w-[260px] shrink-0 flex-col gap-3 rounded-2xl border border-slate-700 bg-gradient-to-br from-[#0B1324] via-[#13203B] to-[#1D3557] p-4 text-white shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400">
                <IconBuildingSkyscraper size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-cyan-300 uppercase">
                    {branch.branchCode}
                  </span>
                  {branch.isHeadquarters && (
                    <span className="rounded-full bg-cyan-400/20 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-200">
                      HQ
                    </span>
                  )}
                </div>
                <h2 className="truncate text-sm font-bold text-white">
                  {ln(branch.branchName, branch.branchNameEn)}
                </h2>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] text-slate-300">
              <span>
                {branch.totalDepartments ?? branch.departments.length} {tr('phòng ban', 'depts')}
              </span>
              <span>
                {branch.totalEmployees ?? 0} {tr('nhân sự', 'staff')}
              </span>
            </div>

            {props.canManage && (
              <button
                type="button"
                onClick={() => props.onAddRoot(branch.branchId)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"
              >
                <IconPlus size={14} />
                <span>{tr('Thêm phòng ban gốc', 'Add Root Dept')}</span>
              </button>
            )}
          </div>

          {branch.departments.length > 0 && (
            <>
              <div className="h-0.5 w-8 shrink-0 bg-slate-300" />
              <div className="flex flex-col justify-center">
                {branch.departments.map((rootNode, idx) => (
                  <div key={rootNode.id} className="relative flex items-center py-2.5 pl-7">
                    <div className="absolute top-1/2 left-0 h-0.5 w-7 -translate-y-1/2 bg-slate-300" />
                    {branch.departments.length > 1 && (
                      <div
                        className={`absolute left-0 w-0.5 bg-slate-300 ${
                          idx === 0
                            ? 'top-1/2 bottom-0'
                            : idx === branch.departments.length - 1
                              ? 'top-0 bottom-1/2'
                              : 'top-0 bottom-0'
                        }`}
                      />
                    )}
                    <HorizontalBranchNode
                      node={rootNode}
                      branch={branch}
                      depth={0}
                      props={props}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
 * VIEW 3: Executive Department Cards Grid (Full-Width Responsive)
 * ========================================================================== */

export function CardsOrgChartView(props: OrgViewSharedProps) {
  const { tr, ln } = useI18n();

  return (
    <div className="space-y-6">
      {props.branches.map((branch) => {
        const flatNodes = flattenOrgHierarchy(branch.departments);

        return (
          <section
            key={branch.branchId}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <IconBuilding size={19} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {ln(branch.branchName, branch.branchNameEn)}
                    </h2>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
                      {branch.branchCode}
                    </span>
                    {branch.isHeadquarters && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                        {tr('Trụ sở chính', 'Headquarters')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {flatNodes.length} {tr('phòng ban', 'departments')} ·{' '}
                    {branch.totalEmployees ?? 0} {tr('nhân sự đang làm việc', 'active employees')}
                  </p>
                </div>
              </div>

              {props.canManage && (
                <button
                  type="button"
                  onClick={() => props.onAddRoot(branch.branchId)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <IconPlus size={14} />
                  <span>{tr('Thêm phòng ban gốc', 'Add Root Department')}</span>
                </button>
              )}
            </div>

            {flatNodes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-xs text-slate-500">
                {tr(
                  'Chi nhánh này chưa có phòng ban nào.',
                  'No departments found in this branch.',
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {flatNodes.map(({ node, depth, path }) => {
                  const theme = getOrgDepthTheme(depth);
                  const isMatched = props.matchedIds.has(node.id);
                  const isDimmed = props.hasSearchQuery && !isMatched;
                  const members = node.members ?? [];
                  const directStaff = node.employeeCount ?? members.length;
                  const totalStaff = node.totalEmployeeCount ?? directStaff;

                  return (
                    <div
                      key={node.id}
                      onClick={() => props.onSelectNode(node, branch)}
                      className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white transition-all hover:shadow-md ${
                        props.selectedNodeId === node.id
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : isMatched
                            ? 'border-amber-400 ring-2 ring-amber-300/50'
                            : 'border-slate-200 hover:border-blue-300'
                      } ${isDimmed ? 'opacity-45' : ''}`}
                    >
                      <div className={`h-1.5 w-full ${theme.topBar}`} />
                      <div className="flex flex-1 flex-col p-4">
                        {/* Breadcrumb */}
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span className="truncate">
                            {path.length > 1
                              ? path
                                  .slice(0, -1)
                                  .map((p) => ln(p.name, p.nameEn))
                                  .join(' › ')
                              : tr('Cấp gốc chi nhánh', 'Branch Root Level')}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500">
                            L{depth + 1}
                          </span>
                        </div>

                        {/* Title + Code */}
                        <div className="mt-1.5 flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                            {ln(node.name, node.nameEn)}
                          </h3>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ring-1 ${theme.badgeBg}`}
                          >
                            {node.code}
                          </span>
                        </div>

                        {node.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {node.description}
                          </p>
                        )}

                        {/* Manager Box */}
                        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5">
                          {node.managerName ? (
                            <>
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${theme.avatarBg} text-[11px] font-bold text-white`}
                              >
                                {getOrgAvatarInitials(node.managerName)}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold text-slate-800">
                                  {node.managerName}
                                </div>
                                <div className="truncate text-[11px] text-slate-500">
                                  {ln(node.managerPosition, node.managerPositionEn) ||
                                    tr('Trưởng bộ phận', 'Dept Head')}
                                </div>
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              {tr('Chưa gán trưởng bộ phận', 'No manager assigned')}
                            </span>
                          )}
                        </div>

                        {/* Members preview */}
                        {props.showMembers && members.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {members.slice(0, 5).map((m) => (
                              <span
                                key={m.id}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                              >
                                {m.fullName}
                              </span>
                            ))}
                            {members.length > 5 && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                +{members.length - 5}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Sub-depts pills */}
                        {node.children.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {node.children.slice(0, 3).map((child) => (
                              <span
                                key={child.id}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                <IconHierarchy2 size={10} className="text-teal-500" />
                                <span className="max-w-[110px] truncate">
                                  {ln(child.name, child.nameEn)}
                                </span>
                              </span>
                            ))}
                            {node.children.length > 3 && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                +{node.children.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Card Footer */}
                        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                          <div className="flex items-center gap-3 text-slate-600">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <IconUsers size={14} className="text-blue-500" />
                              <span>{directStaff}</span>
                              {totalStaff !== directStaff && (
                                <span className="font-normal text-slate-400">
                                  ({tr('Tổng', 'Total')} {totalStaff})
                                </span>
                              )}
                            </span>
                            {!node.isActive && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                                {tr('Tạm ngưng', 'Inactive')}
                              </span>
                            )}
                          </div>

                          {props.canManage && (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => props.onAddChild(node.branchId, node.id)}
                                title={tr('Thêm phòng con', 'Add sub-dept')}
                                className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                              >
                                <IconPlus size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => props.onEdit(node)}
                                title={tr('Chỉnh sửa', 'Edit')}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                              >
                                <IconEdit size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * VIEW 4: Miller Columns Multi-Level Drill-Down Explorer
 * ========================================================================== */

export function ColumnsOrgChartView(props: OrgViewSharedProps) {
  const { tr, ln } = useI18n();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(
    () => props.branches[0]?.branchId ?? null,
  );
  const [selectedPathIds, setSelectedPathIds] = useState<number[]>([]);

  const activeBranch =
    props.branches.find((b) => b.branchId === selectedBranchId) ?? props.branches[0] ?? null;

  // Build dynamic drill-down columns based on activeBranch & selectedPathIds
  const columns: Array<{ level: number; nodes: OrgDepartmentNode[]; selectedId: number | null }> =
    [];
  let activeDetailNode: OrgDepartmentNode | null = null;

  if (activeBranch) {
    let currentNodes = activeBranch.departments;
    let level = 0;

    while (currentNodes.length > 0) {
      const targetId = selectedPathIds[level] ?? null;
      const chosen = currentNodes.find((n) => n.id === targetId) ?? null;
      columns.push({
        level,
        nodes: currentNodes,
        selectedId: chosen?.id ?? null,
      });

      if (!chosen) {
        break;
      }
      activeDetailNode = chosen;
      currentNodes = chosen.children;
      level += 1;
    }
  }

  function handleSelectColumnNode(level: number, node: OrgDepartmentNode) {
    setSelectedPathIds((prev) => [...prev.slice(0, level), node.id]);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex min-h-[540px] divide-x divide-slate-200 overflow-x-auto">
        {/* Column 0: Branches */}
        <div className="flex w-64 shrink-0 flex-col bg-slate-50/70">
          <div className="border-b border-slate-200 px-4 py-3 text-xs font-bold tracking-wider text-slate-500 uppercase">
            {tr('Chi nhánh', 'Branches')} ({props.branches.length})
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2.5">
            {props.branches.map((branch) => {
              const isSelected = activeBranch?.branchId === branch.branchId;
              return (
                <button
                  key={branch.branchId}
                  type="button"
                  onClick={() => {
                    setSelectedBranchId(branch.branchId);
                    setSelectedPathIds([]);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold">
                      {ln(branch.branchName, branch.branchNameEn)}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {branch.branchCode} · {branch.totalEmployees ?? 0} {tr('NS', 'staff')}
                    </div>
                  </div>
                  <IconChevronRight
                    size={15}
                    className={isSelected ? 'text-cyan-400' : 'text-slate-400'}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Department Columns */}
        {columns.map((col) => (
          <div key={col.level} className="flex w-72 shrink-0 flex-col bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                {col.level === 0
                  ? tr('Khối / Phòng gốc', 'Root Divisions')
                  : `${tr('Cấp', 'Level')} ${col.level + 1}`}{' '}
                ({col.nodes.length})
              </span>
              {props.canManage && col.level === 0 && activeBranch && (
                <button
                  type="button"
                  onClick={() => props.onAddRoot(activeBranch.branchId)}
                  title={tr('Thêm phòng ban gốc', 'Add root department')}
                  className="rounded-md p-1 text-blue-600 hover:bg-blue-50"
                >
                  <IconPlus size={14} />
                </button>
              )}
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2.5">
              {col.nodes.map((node) => {
                const isSelected = col.selectedId === node.id;
                const theme = getOrgDepthTheme(col.level);
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleSelectColumnNode(col.level, node)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 text-blue-950 shadow-2xs'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${theme.dot}`} />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-900">
                          {ln(node.name, node.nameEn)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono">{node.code}</span>
                          <span>·</span>
                          <span>
                            {node.totalEmployeeCount ?? node.employeeCount ?? 0} {tr('NS', 'staff')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {node.children.length > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-slate-400">
                        <span>{node.children.length}</span>
                        <IconChevronRight size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Rightmost Live Detail Panel */}
        <div className="flex min-w-[340px] flex-1 flex-col bg-slate-50/40 p-5">
          {activeDetailNode && activeBranch ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
                      {activeDetailNode.code}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        activeDetailNode.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {activeDetailNode.isActive
                        ? tr('Hoạt động', 'Active')
                        : tr('Tạm ngưng', 'Inactive')}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-bold text-slate-900">
                    {ln(activeDetailNode.name, activeDetailNode.nameEn)}
                  </h3>
                  {activeDetailNode.description && (
                    <p className="mt-1 text-xs text-slate-500">{activeDetailNode.description}</p>
                  )}
                </div>

                {props.canManage && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        props.onAddChild(activeDetailNode!.branchId, activeDetailNode!.id)
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <IconPlus size={13} />
                      <span>{tr('Phòng con', 'Sub-dept')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onEdit(activeDetailNode!)}
                      className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                      title={tr('Chỉnh sửa', 'Edit')}
                    >
                      <IconEdit size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">{tr('NS trực tiếp', 'Direct')}</div>
                  <div className="mt-0.5 text-lg font-bold text-slate-900">
                    {activeDetailNode.employeeCount ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">{tr('Tổng nhánh', 'Total')}</div>
                  <div className="mt-0.5 text-lg font-bold text-slate-900">
                    {activeDetailNode.totalEmployeeCount ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">{tr('Đơn vị con', 'Sub-units')}</div>
                  <div className="mt-0.5 text-lg font-bold text-slate-900">
                    {activeDetailNode.children.length}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  {tr('Trưởng bộ phận', 'Department Head')}
                </div>
                {activeDetailNode.managerName ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                        {getOrgAvatarInitials(activeDetailNode.managerName)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {activeDetailNode.managerName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {ln(activeDetailNode.managerPosition, activeDetailNode.managerPositionEn)}{' '}
                          {activeDetailNode.managerCode ? `· ${activeDetailNode.managerCode}` : ''}
                        </div>
                      </div>
                    </div>
                    {activeDetailNode.managerEmployeeId && (
                      <Link
                        href={`/hrm/employees/${activeDetailNode.managerEmployeeId}`}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {tr('Hồ sơ', 'Profile')}
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-400 italic">
                    {tr('Chưa gán trưởng bộ phận', 'No manager assigned')}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    {tr('Nhân sự trực thuộc', 'Direct Staff')} (
                    {(activeDetailNode.members ?? []).length})
                  </span>
                  <button
                    type="button"
                    onClick={() => props.onSelectNode(activeDetailNode!, activeBranch)}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    {tr('Mở chi tiết đầy đủ', 'Open Full Inspector')}
                  </button>
                </div>
                {(activeDetailNode.members ?? []).length === 0 ? (
                  <p className="py-3 text-xs text-slate-400">
                    {tr('Chưa có nhân sự trực tiếp.', 'No direct staff yet.')}
                  </p>
                ) : (
                  <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
                    {(activeDetailNode.members ?? []).map((m) => (
                      <Link
                        key={m.id}
                        href={`/hrm/employees/${m.id}`}
                        className="flex items-center justify-between py-2 text-xs hover:text-blue-600"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-800">{m.fullName}</div>
                          <div className="truncate text-[11px] text-slate-500">
                            {ln(m.positionName, m.positionNameEn)}
                          </div>
                        </div>
                        <IconExternalLink size={13} className="shrink-0 text-slate-400" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400">
              <IconHierarchy2 size={34} className="mb-2 opacity-60" />
              <p className="text-sm font-semibold text-slate-600">
                {tr('Chọn một phòng ban để xem chi tiết', 'Select a department to inspect')}
              </p>
              <p className="mt-1 text-xs">
                {tr(
                  'Nhấp vào các cột bên trái để duyệt sâu qua từng cấp phân cấp tổ chức.',
                  'Click through the columns on the left to drill down into sub-departments.',
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * VIEW 5: Compact Indented Tree List Explorer
 * ========================================================================== */

function CompactTreeNode({
  node,
  branch,
  depth,
  props,
}: {
  node: OrgDepartmentNode;
  branch: BranchOrgTreeData;
  depth: number;
  props: OrgViewSharedProps;
}) {
  const { tr, ln } = useI18n();
  const isCollapsed = props.collapsedIds.has(node.id);
  const isMatched = props.matchedIds.has(node.id);
  const isDimmed = props.hasSearchQuery && !isMatched;
  const hasChildren = node.children.length > 0;
  const theme = getOrgDepthTheme(depth);
  const directStaff = node.employeeCount ?? (node.members?.length ?? 0);
  const totalStaff = node.totalEmployeeCount ?? directStaff;

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-slate-200 pl-4' : ''}>
      <div
        onClick={() => props.onSelectNode(node, branch)}
        className={`my-2 flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-2xs transition ${
          props.selectedNodeId === node.id
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : isMatched
              ? 'border-amber-400 bg-amber-50/30'
              : 'border-slate-200 hover:border-blue-300'
        } ${isDimmed ? 'opacity-45' : ''}`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleCollapse(node.id);
              }}
              aria-label={isCollapsed ? tr('Mở rộng', 'Expand') : tr('Thu gọn', 'Collapse')}
              className="mt-0.5 rounded-md p-0.5 text-slate-500 hover:bg-slate-100"
            >
              {isCollapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
            </button>
          ) : (
            <span className={`mt-2 inline-block h-2 w-2 shrink-0 rounded-full ${theme.dot}`} />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{ln(node.name, node.nameEn)}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ring-1 ${theme.badgeBg}`}
              >
                {node.code}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                <IconUsers size={12} className="text-blue-500" />
                <span>
                  {directStaff}
                  {totalStaff !== directStaff ? ` / ${totalStaff}` : ''} {tr('NS', 'staff')}
                </span>
              </span>
              {!node.isActive && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {tr('Tạm ngưng', 'Inactive')}
                </span>
              )}
            </div>
            {node.description && (
              <p className="mt-0.5 text-xs text-slate-500">{node.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {node.managerName && (
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ${theme.avatarBg} text-[9px] font-bold text-white`}
              >
                {getOrgAvatarInitials(node.managerName)}
              </span>
              <span className="font-medium text-slate-700">{node.managerName}</span>
            </div>
          )}

          {props.canManage && (
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => props.onAddChild(node.branchId, node.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                <IconPlus size={13} />
                <span>{tr('Phòng con', 'Sub-dept')}</span>
              </button>
              <button
                type="button"
                onClick={() => props.onEdit(node)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                title={tr('Chỉnh sửa phòng ban', 'Edit department')}
              >
                <IconEdit size={15} />
              </button>
              {props.onDelete && !hasChildren && (
                <button
                  type="button"
                  onClick={() => props.onDelete!(node)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  title={tr('Xóa mềm phòng ban', 'Soft delete department')}
                >
                  <IconTrash size={15} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <CompactTreeNode
              key={child.id}
              node={child}
              branch={branch}
              depth={depth + 1}
              props={props}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CompactTreeOrgChartView(props: OrgViewSharedProps) {
  const { tr, ln } = useI18n();

  return (
    <div className="space-y-5">
      {props.branches.map((branch) => (
        <section
          key={branch.branchId}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                <IconBuilding size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {ln(branch.branchName, branch.branchNameEn)}
                  </h2>
                  <span className="rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-600 ring-1 ring-slate-200">
                    {branch.branchCode}
                  </span>
                  {branch.isHeadquarters && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      {tr('Trụ sở chính', 'Headquarters')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {branch.totalDepartments ?? branch.departments.length}{' '}
                  {tr('phòng ban', 'departments')} · {branch.totalEmployees ?? 0}{' '}
                  {tr('nhân sự', 'employees')}
                </p>
              </div>
            </div>

            {props.canManage && (
              <button
                type="button"
                onClick={() => props.onAddRoot(branch.branchId)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50"
              >
                <IconPlus size={14} />
                <span>{tr('Thêm phòng ban gốc', 'Add Root Department')}</span>
              </button>
            )}
          </div>

          {branch.departments.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-xs text-slate-500">
              <IconHierarchy2 size={18} className="text-slate-400" />
              <span>
                {tr(
                  'Chi nhánh này chưa có phòng ban nào được thiết lập.',
                  'No departments have been set up for this branch yet.',
                )}
              </span>
            </div>
          ) : (
            <div>
              {branch.departments.map((rootNode) => (
                <CompactTreeNode
                  key={rootNode.id}
                  node={rootNode}
                  branch={branch}
                  depth={0}
                  props={props}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
