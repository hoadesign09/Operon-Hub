'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  IconArrowRight,
  IconEdit,
  IconGitBranch,
  IconInbox,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type ApproverType = 'DIRECT_MANAGER' | 'ROLE' | 'SPECIFIC_USER';

interface WorkflowStepRow {
  stepOrder: number;
  approverType: ApproverType;
  approverRoleId: number | null;
  approverRoleName?: string | null;
  approverUserId: number | null;
  approverUserName?: string | null;
}

interface WorkflowRow {
  id: number;
  moduleCode: 'core' | 'hrm' | 'crm';
  requestType: string;
  branchId: number | null;
  branchName: string | null;
  name: string;
  description: string | null;
  conditions: { minDays?: number | null; minAmount?: number | null } | null;
  isActive: boolean;
  steps: WorkflowStepRow[];
}

interface RoleOption {
  id: number;
  code: string;
  name: string;
}

interface UserOption {
  id: number;
  fullName: string;
  email: string;
}

interface BranchOption {
  id: number;
  code: string;
  name: string;
}

interface StepDraft {
  approverType: ApproverType;
  approverRoleId: string;
  approverUserId: string;
}

const APPROVER_TYPE_LABELS: Record<ApproverType, string> = {
  DIRECT_MANAGER: 'Quản lý trực tiếp',
  ROLE: 'Theo Vai trò',
  SPECIFIC_USER: 'Người dùng cụ thể',
};

export default function WorkflowsSettingsPage() {
  const { hasPermission } = usePortalAuth();
  const canManage = hasPermission('core.approvals.workflow_manage');

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowRow | null>(null);
  const [name, setName] = useState('');
  const [moduleCode, setModuleCode] = useState<'core' | 'hrm' | 'crm'>('hrm');
  const [requestType, setRequestType] = useState('LEAVE');
  const [branchId, setBranchId] = useState('');
  const [description, setDescription] = useState('');
  const [minDays, setMinDays] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([
    { approverType: 'ROLE', approverRoleId: '', approverUserId: '' },
  ]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (moduleFilter) {
      params.set('moduleCode', moduleFilter);
    }

    Promise.all([
      fetch(`/api/v1/approvals/workflows?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/core/roles', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/v1/core/users?limit=100&status=ACTIVE', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/core/branches?limit=100&isActive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([wRes, rRes, uRes, bRes]) => {
        if (controller.signal.aborted) {
          return;
        }
        const [wJson, rJson, uJson, bJson] = await Promise.all([
          wRes.json().catch(() => null),
          rRes.json().catch(() => null),
          uRes.json().catch(() => null),
          bRes.json().catch(() => null),
        ]);

        if (!wRes.ok || !wJson?.success) {
          setErrorMessage(wJson?.error?.message ?? 'Không thể tải danh sách luồng duyệt.');
          setViewState('error');
          return;
        }
        setWorkflows((wJson.data ?? []) as WorkflowRow[]);
        setRoles((rJson?.data ?? []) as RoleOption[]);
        setUsers((uJson?.data ?? []) as UserOption[]);
        setBranches((bJson?.data ?? []) as BranchOption[]);
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage('Lỗi kết nối khi tải danh sách luồng duyệt.');
        setViewState('error');
      });

    return () => controller.abort();
  }, [moduleFilter, reloadTick]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  function openCreateModal() {
    const defaultRoleId = String(roles.find((r) => r.code === 'DEPT_MANAGER')?.id ?? roles[0]?.id ?? '');
    setEditingWorkflow(null);
    setName('');
    setModuleCode('hrm');
    setRequestType('LEAVE');
    setBranchId('');
    setDescription('');
    setMinDays('');
    setIsActive(true);
    setSteps([{ approverType: 'ROLE', approverRoleId: defaultRoleId, approverUserId: '' }]);
    setFormError('');
    setIsModalOpen(true);
  }

  function openEditModal(wf: WorkflowRow) {
    setEditingWorkflow(wf);
    setName(wf.name);
    setModuleCode(wf.moduleCode);
    setRequestType(wf.requestType);
    setBranchId(wf.branchId ? String(wf.branchId) : '');
    setDescription(wf.description ?? '');
    setMinDays(wf.conditions?.minDays !== null && wf.conditions?.minDays !== undefined ? String(wf.conditions.minDays) : '');
    setIsActive(wf.isActive);
    setSteps(
      wf.steps.length > 0
        ? wf.steps.map((s) => ({
            approverType: s.approverType,
            approverRoleId: s.approverRoleId ? String(s.approverRoleId) : '',
            approverUserId: s.approverUserId ? String(s.approverUserId) : '',
          }))
        : [{ approverType: 'ROLE', approverRoleId: '', approverUserId: '' }],
    );
    setFormError('');
    setIsModalOpen(true);
  }

  function addStep() {
    if (steps.length >= 5) {
      return;
    }
    const defaultRoleId = String(roles[0]?.id ?? '');
    setSteps((prev) => [
      ...prev,
      { approverType: 'ROLE', approverRoleId: defaultRoleId, approverUserId: '' },
    ]);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) {
      return;
    }
    setSteps((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((step, idx) => (idx === index ? { ...step, ...patch } : step)));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);

    try {
      const payload = {
        moduleCode,
        requestType: requestType.trim().toUpperCase(),
        branchId: branchId ? Number(branchId) : null,
        name: name.trim(),
        description: description.trim() || null,
        conditions: minDays.trim() ? { minDays: Number(minDays) } : null,
        isActive,
        steps: steps.map((s, idx) => ({
          stepOrder: idx + 1,
          approverType: s.approverType,
          approverRoleId: s.approverRoleId ? Number(s.approverRoleId) : null,
          approverUserId: s.approverUserId ? Number(s.approverUserId) : null,
        })),
      };

      const url = editingWorkflow
        ? `/api/v1/approvals/workflows/${editingWorkflow.id}`
        : '/api/v1/approvals/workflows';
      const method = editingWorkflow ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setFormError(json?.error?.message ?? 'Không thể lưu quy trình duyệt.');
        return;
      }

      setIsModalOpen(false);
      triggerReload();
    } catch {
      setFormError('Lỗi kết nối khi lưu quy trình duyệt.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingWorkflow) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/approvals/workflows/${deletingWorkflow.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setErrorMessage('Không thể xóa quy trình duyệt.');
        setViewState('error');
      } else {
        triggerReload();
      }
    } finally {
      setIsDeleting(false);
      setDeletingWorkflow(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cấu hình Luồng Phê duyệt Đa cấp</h1>
          <p className="text-sm text-slate-500">
            Thiết lập chuỗi duyệt dùng chung cho Nghỉ phép, Tăng ca, Công tác (HRM) và Báo giá (CRM).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => {
              setModuleFilter(e.target.value);
              setViewState('loading');
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            <option value="">Tất cả phân hệ</option>
            <option value="hrm">HRM</option>
            <option value="crm">CRM</option>
            <option value="core">Core</option>
          </select>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <IconPlus size={17} />
              <span>Thêm luồng duyệt</span>
            </button>
          )}
        </div>
      </div>

      {viewState === 'loading' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {viewState === 'error' && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <span className="text-sm font-medium text-rose-700">{errorMessage}</span>
          <button
            type="button"
            onClick={triggerReload}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700"
          >
            <IconRefresh size={14} />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {viewState === 'success' && workflows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <IconInbox size={34} className="text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-800">Chưa có quy trình phê duyệt nào</p>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white"
            >
              <IconPlus size={15} />
              <span>Tạo quy trình đầu tiên</span>
            </button>
          )}
        </div>
      )}

      {viewState === 'success' && workflows.length > 0 && (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <article
              key={wf.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <IconGitBranch size={18} className="text-blue-600" />
                    <h2 className="text-base font-semibold text-slate-900">{wf.name}</h2>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                      {wf.moduleCode}/{wf.requestType}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        wf.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {wf.isActive ? 'Đang áp dụng' : 'Tạm ngưng'}
                    </span>
                  </div>
                  {wf.description && (
                    <p className="mt-1 text-xs text-slate-600">{wf.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Phạm vi: {wf.branchName ?? 'Toàn công ty'}</span>
                    {wf.conditions?.minDays !== undefined && wf.conditions?.minDays !== null && (
                      <span>• Điều kiện: &ge; {wf.conditions.minDays} ngày</span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(wf)}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                      title="Chỉnh sửa"
                    >
                      <IconEdit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingWorkflow(wf)}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                      title="Xóa mềm"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {wf.steps.map((step, idx) => (
                  <div key={`${wf.id}-s-${step.stepOrder}`} className="flex items-center gap-2">
                    <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                      Bước {step.stepOrder}:{' '}
                      {step.approverType === 'ROLE'
                        ? step.approverRoleName ?? 'Vai trò'
                        : step.approverType === 'SPECIFIC_USER'
                          ? step.approverUserName ?? 'Người dùng'
                          : 'Quản lý trực tiếp'}
                    </span>
                    {idx < wf.steps.length - 1 && (
                      <IconArrowRight size={14} className="text-slate-400" />
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingWorkflow ? 'Cập nhật Luồng duyệt' : 'Tạo Luồng duyệt mới'}
              </h2>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Tên quy trình *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Phân hệ *</label>
                  <select
                    value={moduleCode}
                    onChange={(e) => setModuleCode(e.target.value as 'core' | 'hrm' | 'crm')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="hrm">HRM</option>
                    <option value="crm">CRM</option>
                    <option value="core">Core</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Loại yêu cầu *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="LEAVE / OVERTIME"
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Chi nhánh áp dụng
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Toàn công ty</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Điều kiện số ngày tối thiểu (tùy chọn)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="VD: 3"
                    value={minDays}
                    onChange={(e) => setMinDays(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Mô tả</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Các bước phê duyệt tuần tự ({steps.length}/5)
                  </span>
                  {steps.length < 5 && (
                    <button
                      type="button"
                      onClick={addStep}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <IconPlus size={14} />
                      <span>Thêm bước</span>
                    </button>
                  )}
                </div>

                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-12 sm:items-center"
                  >
                    <div className="text-xs font-semibold text-slate-700 sm:col-span-2">
                      Bước {idx + 1}
                    </div>
                    <select
                      value={step.approverType}
                      onChange={(e) =>
                        updateStep(idx, {
                          approverType: e.target.value as ApproverType,
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-4"
                    >
                      {Object.entries(APPROVER_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <div className="sm:col-span-5">
                      {step.approverType === 'ROLE' && (
                        <select
                          required
                          value={step.approverRoleId}
                          onChange={(e) => updateStep(idx, { approverRoleId: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          <option value="">-- Chọn vai trò --</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.code})
                            </option>
                          ))}
                        </select>
                      )}
                      {step.approverType === 'SPECIFIC_USER' && (
                        <select
                          required
                          value={step.approverUserId}
                          onChange={(e) => updateStep(idx, { approverUserId: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          <option value="">-- Chọn người duyệt --</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.fullName} ({u.email})
                            </option>
                          ))}
                        </select>
                      )}
                      {step.approverType === 'DIRECT_MANAGER' && (
                        <select
                          value={step.approverRoleId}
                          onChange={(e) => updateStep(idx, { approverRoleId: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          <option value="">Không cần vai trò dự phòng</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              Dự phòng: {r.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex justify-end sm:col-span-1">
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Xóa bước"
                        >
                          <IconTrash size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Kích hoạt áp dụng ngay</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu luồng duyệt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingWorkflow)}
        title="Xác nhận xóa mềm luồng duyệt"
        description={`Bạn có chắc muốn ngừng áp dụng và ẩn quy trình "${deletingWorkflow?.name ?? ''}"?`}
        confirmLabel="Xóa luồng duyệt"
        isProcessing={isDeleting}
        onCancel={() => setDeletingWorkflow(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
