'use client';

import { useState } from 'react';
import {
  IconBuilding,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconHierarchy2,
  IconPlus,
} from '@tabler/icons-react';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface OrgDepartmentNode {
  id: number;
  branchId: number;
  parentId: number | null;
  code: string;
  name: string;
  nameEn?: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  children: OrgDepartmentNode[];
}

export interface BranchOrgTreeData {
  branchId: number;
  branchCode: string;
  branchName: string;
  branchNameEn?: string | null;
  isHeadquarters: boolean;
  departments: OrgDepartmentNode[];
}

interface OrgNodeCardProps {
  node: OrgDepartmentNode;
  depth: number;
  canManage: boolean;
  onAddChild: (branchId: number, parentId: number) => void;
  onEdit: (node: OrgDepartmentNode) => void;
}

function OrgNodeCard({ node, depth, canManage, onAddChild, onEdit }: OrgNodeCardProps) {
  const { tr, ln } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? 'ml-5 border-l-2 border-slate-200 pl-4' : ''}>
      <div className="my-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs transition hover:border-blue-300">
        <div className="flex items-start gap-2.5">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? tr('Thu gọn', 'Collapse') : tr('Mở rộng', 'Expand')}
              className="mt-0.5 rounded-md p-0.5 text-slate-500 hover:bg-slate-100"
            >
              {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </button>
          ) : (
            <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-blue-400" />
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{ln(node.name, node.nameEn)}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                {node.code}
              </span>
              {!node.isActive && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {tr('Ngừng hoạt động', 'Inactive')}
                </span>
              )}
            </div>
            {node.description && (
              <p className="mt-0.5 text-xs text-slate-500">{node.description}</p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAddChild(node.branchId, node.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              <IconPlus size={13} />
              <span>{tr('Phòng con', 'Sub-dept')}</span>
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
              title={tr('Chỉnh sửa phòng ban', 'Edit department')}
            >
              <IconEdit size={15} />
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <OrgNodeCard
              key={child.id}
              node={child}
              depth={depth + 1}
              canManage={canManage}
              onAddChild={onAddChild}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChartTree({
  branches,
  canManage,
  onAddRoot,
  onAddChild,
  onEdit,
}: {
  branches: BranchOrgTreeData[];
  canManage: boolean;
  onAddRoot: (branchId: number) => void;
  onAddChild: (branchId: number, parentId: number) => void;
  onEdit: (node: OrgDepartmentNode) => void;
}) {
  const { tr, ln } = useI18n();

  return (
    <div className="space-y-5">
      {branches.map((branch) => (
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
                <div className="flex items-center gap-2">
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
                  {branch.departments.length}{' '}
                  {tr('khối / phòng ban cấp gốc', 'root divisions / departments')}
                </p>
              </div>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => onAddRoot(branch.branchId)}
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
                <OrgNodeCard
                  key={rootNode.id}
                  node={rootNode}
                  depth={0}
                  canManage={canManage}
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
