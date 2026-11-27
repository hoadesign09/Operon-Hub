'use client';

import Link from 'next/link';
import {
  IconBuilding,
  IconChevronRight,
  IconEdit,
  IconExternalLink,
  IconHierarchy2,
  IconMail,
  IconPhone,
  IconPlus,
  IconTrash,
  IconUserCheck,
  IconUsers,
  IconUsersGroup,
  IconX,
} from '@tabler/icons-react';
import { getOrgAvatarInitials } from '@/lib/portable/org-chart-utils';
import { useI18n } from '@/shared/i18n/I18nContext';
import {
  getOrgDepthTheme,
  type BranchOrgTreeData,
  type OrgDepartmentNode,
} from './org-chart.types';

interface OrgDepartmentDrawerProps {
  node: OrgDepartmentNode | null;
  branch: BranchOrgTreeData | null;
  breadcrumb: OrgDepartmentNode[];
  canManage: boolean;
  onClose: () => void;
  onSelectNode: (node: OrgDepartmentNode) => void;
  onAddChild: (branchId: number, parentId: number) => void;
  onEdit: (node: OrgDepartmentNode) => void;
  onDelete?: (node: OrgDepartmentNode) => void;
}

export function OrgDepartmentDrawer({
  node,
  branch,
  breadcrumb,
  canManage,
  onClose,
  onSelectNode,
  onAddChild,
  onEdit,
  onDelete,
}: OrgDepartmentDrawerProps) {
  const { tr, ln } = useI18n();

  if (!node) {
    return null;
  }

  const depth = Math.max(0, breadcrumb.length - 1);
  const theme = getOrgDepthTheme(depth);
  const members = node.members ?? [];
  const directStaff = node.employeeCount ?? members.length;
  const totalStaff = node.totalEmployeeCount ?? directStaff;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Header */}
        <div className={`h-1.5 w-full ${theme.topBar}`} />
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500">
              {branch && (
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <IconBuilding size={12} />
                  <span>{ln(branch.branchName, branch.branchNameEn)}</span>
                </span>
              )}
              {breadcrumb.slice(0, -1).map((ancestor) => (
                <span key={ancestor.id} className="inline-flex items-center gap-1">
                  <IconChevronRight size={12} className="text-slate-400" />
                  <button
                    type="button"
                    onClick={() => onSelectNode(ancestor)}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {ln(ancestor.name, ancestor.nameEn)}
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {ln(node.name, node.nameEn)}
              </h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                {node.code}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  node.isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {node.isActive ? tr('Hoạt động', 'Active') : tr('Tạm ngưng', 'Inactive')}
              </span>
            </div>
            {node.description && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{node.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Đóng chi tiết', 'Close details')}
            className="shrink-0 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Quick KPI Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <IconUsers size={14} className="text-blue-600" />
                <span>{tr('Trực thuộc', 'Direct Staff')}</span>
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{directStaff}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <IconUsersGroup size={14} className="text-indigo-600" />
                <span>{tr('Tổng quân số', 'Total Subtree')}</span>
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{totalStaff}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <IconHierarchy2 size={14} className="text-teal-600" />
                <span>{tr('Đơn vị con', 'Sub-units')}</span>
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{node.children.length}</div>
            </div>
          </div>

          {/* Department Manager Card */}
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {tr('Trưởng bộ phận / Phụ trách', 'Department Head / Manager')}
            </h3>
            {node.managerEmployeeId && node.managerName ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${theme.avatarBg} text-xs font-bold text-white shadow-sm`}
                  >
                    {getOrgAvatarInitials(node.managerName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-slate-900">
                        {node.managerName}
                      </span>
                      <IconUserCheck size={14} className="shrink-0 text-blue-600" />
                    </div>
                    <div className="truncate text-xs text-slate-600">
                      {ln(node.managerPosition, node.managerPositionEn) ||
                        tr('Trưởng phòng ban', 'Department Manager')}
                      {node.managerCode ? ` · ${node.managerCode}` : ''}
                    </div>
                    {node.managerEmail && (
                      <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                        <IconMail size={12} />
                        <span className="truncate">{node.managerEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Link
                  href={`/hrm/employees/${node.managerEmployeeId}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200 transition hover:bg-blue-50"
                >
                  <span>{tr('Hồ sơ', 'Profile')}</span>
                  <IconExternalLink size={13} />
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
                <span>
                  {tr(
                    'Chưa gán trưởng bộ phận cho phòng ban này.',
                    'No department head assigned yet.',
                  )}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onEdit(node)}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {tr('Gán ngay', 'Assign now')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sub-departments */}
          {node.children.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                {tr('Phòng ban trực thuộc', 'Sub-departments')} ({node.children.length})
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {node.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onSelectNode(child)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-900">
                        {ln(child.name, child.nameEn)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {child.code} · {child.totalEmployeeCount ?? child.employeeCount ?? 0}{' '}
                        {tr('NS', 'staff')}
                      </div>
                    </div>
                    <IconChevronRight size={15} className="shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Direct Members List */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                {tr('Nhân sự trực thuộc', 'Direct Members')} ({members.length})
              </h3>
              <Link
                href={`/hrm/employees?departmentId=${node.id}`}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                {tr('Xem trong danh sách NS', 'Open in Employees')}
              </Link>
            </div>
            {members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-500">
                {tr(
                  'Chưa có nhân sự đang làm việc trực tiếp tại phòng ban này.',
                  'No active employees directly assigned to this department.',
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {members.map((member) => (
                  <Link
                    key={member.id}
                    href={`/hrm/employees/${member.id}`}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          member.isDepartmentManager
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {getOrgAvatarInitials(member.fullName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-slate-900">
                            {member.fullName}
                          </span>
                          {member.isDepartmentManager && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                              {tr('Trưởng BP', 'Head')}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {ln(member.positionName, member.positionNameEn)} · {member.employeeCode}
                        </div>
                        {member.phone && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <IconPhone size={10} />
                            <span>{member.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <IconExternalLink size={14} className="shrink-0 text-slate-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Management Actions */}
        {canManage && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAddChild(node.branchId, node.id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
              >
                <IconPlus size={14} />
                <span>{tr('Thêm phòng con', 'Add Sub-dept')}</span>
              </button>
              <button
                type="button"
                onClick={() => onEdit(node)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <IconEdit size={14} />
                <span>{tr('Chỉnh sửa', 'Edit')}</span>
              </button>
            </div>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(node)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <IconTrash size={14} />
                <span>{tr('Xóa', 'Delete')}</span>
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
