'use client';

import { useState, type FormEvent } from 'react';
import { IconTrash, IconUserPlus } from '@tabler/icons-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { ProjectMemberRole } from '@/config/database';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { ProjectMemberView } from '@/modules/projects/projects.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import type { SimpleEmployeeOption } from './ProjectFormModal';
import { pickLabel, PROJECT_ROLE_META } from './project-ui-helpers';

interface ProjectMembersPanelProps {
  projectId: number;
  members: ProjectMemberView[];
  employees: SimpleEmployeeOption[];
  canManage: boolean;
  canViewBudget: boolean;
  onMembersChanged: (nextMembers: ProjectMemberView[]) => void;
}

export function ProjectMembersPanel({
  projectId,
  members,
  employees,
  canManage,
  canViewBudget,
  onMembersChanged,
}: ProjectMembersPanelProps) {
  const { locale, tr, ln } = useI18n();
  const [employeeId, setEmployeeId] = useState<string>('');
  const [projectRole, setProjectRole] = useState<ProjectMemberRole>('MEMBER');
  const [allocationPercent, setAllocationPercent] = useState('100');
  const [hourlyCostRate, setHourlyCostRate] = useState('0');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<ProjectMemberView | null>(null);

  const memberEmpIds = new Set(members.map((m) => m.employeeId));
  const availableEmployees = employees.filter((e) => !memberEmpIds.has(e.id));

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!employeeId || isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: Number(employeeId),
          projectRole,
          allocationPercent: Number(allocationPercent) || 100,
          hourlyCostRate: Number(hourlyCostRate) || 0,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectMemberView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(
          json?.error?.message ?? tr('Không thể thêm thành viên.', 'Failed to add project member.'),
        );
      }
      onMembersChanged(json.data);
      setEmployeeId('');
      setAllocationPercent('100');
      setHourlyCostRate('0');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRoleChange(member: ProjectMemberView, nextRole: ProjectMemberRole) {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRole: nextRole }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectMemberView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(
          json?.error?.message ??
            tr('Không thể cập nhật vai trò thành viên.', 'Unable to update member role.'),
        );
      }
      onMembersChanged(json.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    }
  }

  async function confirmRemoveMember() {
    if (!removingMember) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members/${removingMember.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectMemberView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(
          json?.error?.message ?? tr('Không thể gỡ thành viên.', 'Unable to remove member.'),
        );
      }
      onMembersChanged(json.data);
      setRemovingMember(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
      setRemovingMember(null);
    }
  }

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {canManage && (
        <form
          onSubmit={handleAddMember}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-12"
        >
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {tr('Chọn nhân sự tham gia', 'Select Employee')}
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{tr('-- Chọn nhân viên --', '-- Select employee --')}</option>
              {availableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeCode} — {emp.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {tr('Vai trò trong dự án', 'Project Role')}
            </label>
            <select
              value={projectRole}
              onChange={(e) => setProjectRole(e.target.value as ProjectMemberRole)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {(Object.keys(PROJECT_ROLE_META) as ProjectMemberRole[]).map((role) => (
                <option key={role} value={role}>
                  {pickLabel(PROJECT_ROLE_META[role], locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {tr('% Phân bổ', 'Allocation %')}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={allocationPercent}
              onChange={(e) => setAllocationPercent(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          {canViewBudget && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {tr('Đơn giá/giờ (VNĐ)', 'Hourly Rate (VND)')}
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={hourlyCostRate}
                onChange={(e) => setHourlyCostRate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex items-end md:col-span-1">
            <button
              type="submit"
              disabled={isSaving || !employeeId}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <IconUserPlus size={16} />
              <span>{tr('Thêm', 'Add')}</span>
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">{tr('Thành viên', 'Member')}</th>
                <th className="px-4 py-3">{tr('Phòng ban / Chức danh', 'Dept / Position')}</th>
                <th className="px-4 py-3">{tr('Vai trò dự án', 'Project Role')}</th>
                <th className="px-4 py-3">{tr('Phân bổ', 'Allocation')}</th>
                {canViewBudget && <th className="px-4 py-3">{tr('Chi phí/giờ', 'Hourly Rate')}</th>}
                <th className="px-4 py-3">{tr('Ngày tham gia', 'Joined')}</th>
                {canManage && <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{m.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {m.employeeCode} • {m.workEmail}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>
                      {m.departmentName ? ln(m.departmentName, m.departmentNameEn) : '—'}
                    </div>
                    <div className="text-slate-400">
                      {m.positionName ? ln(m.positionName, m.positionNameEn) : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        value={m.projectRole}
                        onChange={(e) => handleRoleChange(m, e.target.value as ProjectMemberRole)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                      >
                        {(Object.keys(PROJECT_ROLE_META) as ProjectMemberRole[]).map((role) => (
                          <option key={role} value={role}>
                            {pickLabel(PROJECT_ROLE_META[role], locale)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PROJECT_ROLE_META[m.projectRole].cls}`}
                      >
                        {pickLabel(PROJECT_ROLE_META[m.projectRole], locale)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {m.allocationPercent}%
                    </span>
                  </td>
                  {canViewBudget && (
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">
                      {m.hourlyCostRate > 0 ? formatVND(m.hourlyCostRate) : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateVN(m.joinedAt)}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setRemovingMember(m)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title={tr('Gỡ khỏi dự án', 'Remove from project')}
                      >
                        <IconTrash size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(removingMember)}
        title={tr('Gỡ thành viên khỏi dự án', 'Remove Project Member')}
        description={
          removingMember
            ? tr(
                `Bạn có chắc muốn gỡ ${removingMember.fullName} khỏi dự án? Dữ liệu lịch sử công việc của thành viên vẫn được bảo toàn.`,
                `Remove ${removingMember.fullName} from this project? Historical task records will remain preserved.`,
              )
            : ''
        }
        confirmLabel={tr('Gỡ thành viên', 'Remove')}
        variant="danger"
        onCancel={() => setRemovingMember(null)}
        onConfirm={confirmRemoveMember}
      />
    </div>
  );
}
