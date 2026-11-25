'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { IconX } from '@tabler/icons-react';
import type {
  ProjectHealthStatus,
  ProjectMethodology,
  ProjectPriority,
  ProjectVisibility,
} from '@/config/database';
import type { ProjectDetailView } from '@/modules/projects/projects.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import {
  pickLabel,
  PROJECT_COLOR_PRESETS,
  PROJECT_HEALTH_META,
  PROJECT_METHODOLOGY_META,
  PROJECT_PRIORITY_META,
  PROJECT_VISIBILITY_META,
} from './project-ui-helpers';

export interface SimpleBranchOption {
  id: number;
  name: string;
  nameEn?: string | null;
}

export interface SimpleDepartmentOption {
  id: number;
  name: string;
  nameEn?: string | null;
  branchId: number;
}

export interface SimpleEmployeeOption {
  id: number;
  fullName: string;
  employeeCode: string;
}

interface ProjectFormModalProps {
  isOpen: boolean;
  editingProject?: ProjectDetailView | null;
  branches: SimpleBranchOption[];
  departments: SimpleDepartmentOption[];
  employees: SimpleEmployeeOption[];
  defaultBranchId?: number | null;
  onClose: () => void;
  onSaved: (project: ProjectDetailView) => void;
}

export function ProjectFormModal({
  isOpen,
  editingProject,
  branches,
  departments,
  employees,
  defaultBranchId,
  onClose,
  onSaved,
}: ProjectFormModalProps) {
  const { locale, tr, ln } = useI18n();
  const isEdit = Boolean(editingProject);

  const [code, setCode] = useState(editingProject?.code ?? '');
  const [name, setName] = useState(editingProject?.name ?? '');
  const [description, setDescription] = useState(editingProject?.description ?? '');
  const [branchId, setBranchId] = useState<number>(
    editingProject?.branchId ?? defaultBranchId ?? branches[0]?.id ?? 1,
  );
  const [departmentId, setDepartmentId] = useState<string>(
    editingProject?.departmentId ? String(editingProject.departmentId) : '',
  );
  const [ownerEmployeeId, setOwnerEmployeeId] = useState<number>(
    editingProject?.ownerEmployeeId ?? employees[0]?.id ?? 1,
  );
  const [managerEmployeeId, setManagerEmployeeId] = useState<number>(
    editingProject?.managerEmployeeId ?? employees[0]?.id ?? 1,
  );
  const [methodology, setMethodology] = useState<ProjectMethodology>(
    editingProject?.methodology ?? 'KANBAN',
  );
  const [visibility, setVisibility] = useState<ProjectVisibility>(
    editingProject?.visibility ?? 'BRANCH',
  );
  const [priority, setPriority] = useState<ProjectPriority>(editingProject?.priority ?? 'MEDIUM');
  const [healthStatus, setHealthStatus] = useState<ProjectHealthStatus>(
    editingProject?.healthStatus ?? 'ON_TRACK',
  );
  const [startDate, setStartDate] = useState(editingProject?.startDate ?? '');
  const [targetEndDate, setTargetEndDate] = useState(editingProject?.targetEndDate ?? '');
  const [plannedBudget, setPlannedBudget] = useState(String(editingProject?.plannedBudget ?? 0));
  const [colorHex, setColorHex] = useState(editingProject?.colorHex ?? '#2563EB');
  const [templateId, setTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<
    Array<{ id: number; code: string; name: string; nameEn?: string | null }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || isEdit) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/v1/pm/templates?activeOnly=true');
        const json = (await res.json().catch(() => null)) as {
          data?: Array<{ id: number; code: string; name: string; nameEn?: string | null }>;
        } | null;
        if (active && json?.data) {
          setTemplates(json.data);
        }
      } catch {
        // Non-blocking
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen, isEdit]);

  if (!isOpen) {
    return null;
  }

  const branchDepts = departments.filter((d) => d.branchId === branchId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!isEdit && code.trim().length < 2) {
      setErrorMsg(tr('Mã dự án tối thiểu 2 ký tự.', 'Project code must be at least 2 characters.'));
      return;
    }
    if (name.trim().length < 2) {
      setErrorMsg(tr('Tên dự án tối thiểu 2 ký tự.', 'Project name must be at least 2 characters.'));
      return;
    }
    if (startDate && targetEndDate && targetEndDate < startDate) {
      setErrorMsg(
        tr(
          'Ngày kết thúc dự kiến phải lớn hơn hoặc bằng ngày bắt đầu.',
          'Target end date must be on or after start date.',
        ),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/v1/projects/${editingProject!.id}` : '/api/v1/projects';
      const method = isEdit ? 'PATCH' : 'POST';
      const payload = isEdit
        ? {
            name: name.trim(),
            description: description.trim() || null,
            departmentId: departmentId ? Number(departmentId) : null,
            ownerEmployeeId,
            managerEmployeeId,
            methodology,
            visibility,
            priority,
            healthStatus,
            startDate: startDate || null,
            targetEndDate: targetEndDate || null,
            plannedBudget: Number(plannedBudget) || 0,
            colorHex,
          }
        : {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || null,
            branchId,
            departmentId: departmentId ? Number(departmentId) : null,
            ownerEmployeeId,
            managerEmployeeId,
            methodology,
            visibility,
            priority,
            startDate: startDate || null,
            targetEndDate: targetEndDate || null,
            plannedBudget: Number(plannedBudget) || 0,
            colorHex,
            templateId: templateId ? Number(templateId) : null,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectDetailView;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success || !json.data) {
        throw new Error(
          json?.error?.message ??
            tr('Không thể lưu dự án. Vui lòng thử lại.', 'Unable to save project. Please retry.'),
        );
      }
      onSaved(json.data);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : tr('Lỗi kết nối máy chủ.', 'Network error while saving project.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit
                ? tr('Cập nhật thông tin dự án', 'Edit Project Details')
                : tr('Khởi tạo dự án mới', 'Create New Project')}
            </h2>
            <p className="text-xs text-slate-500">
              {isEdit
                ? `${editingProject?.code} — ${editingProject?.name}`
                : tr(
                    'Tự động khởi tạo 5 cột Kanban chuẩn và 4 nhãn mặc định.',
                    'Automatically initializes 5 default Kanban columns and 4 starter labels.',
                  )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMsg}
            </div>
          )}

          {!isEdit && templates.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Khởi tạo từ Mẫu Dự án (tùy chọn)', 'Start from Project Template (optional)')}
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="">{tr('-- Dùng cấu trúc Kanban mặc định --', '-- Default Kanban structure --')}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    [{tpl.code}] {ln(tpl.name, tpl.nameEn)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Mã dự án *', 'Project Code *')}
              </label>
              <input
                type="text"
                value={code}
                disabled={isEdit}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ERP-2026"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase disabled:bg-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Tên dự án *', 'Project Name *')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('VD: Triển khai Operon Hub Phase 2', 'e.g. Operon Hub Phase 2 Rollout')}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {tr('Mô tả & Mục tiêu (Charter)', 'Description & Charter Goal')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr(
                'Phạm vi, mục tiêu bàn giao chính và tiêu chí thành công...',
                'Scope, key deliverables, and success criteria...',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Chi nhánh chủ quản *', 'Branch *')}
              </label>
              <select
                value={branchId}
                disabled={isEdit}
                onChange={(e) => {
                  setBranchId(Number(e.target.value));
                  setDepartmentId('');
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {ln(b.name, b.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Phòng ban chủ trì', 'Lead Department')}
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">{tr('Liên phòng ban / Toàn chi nhánh', 'Cross-functional / Branch')}</option>
                {branchDepts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {ln(d.name, d.nameEn)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Chủ dự án (Sponsor / Owner) *', 'Project Owner / Sponsor *')}
              </label>
              <select
                value={ownerEmployeeId}
                onChange={(e) => setOwnerEmployeeId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} — {emp.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Quản lý dự án (PM) *', 'Project Manager (PM) *')}
              </label>
              <select
                value={managerEmployeeId}
                onChange={(e) => setManagerEmployeeId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} — {emp.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Phương pháp quản lý', 'Methodology')}
              </label>
              <select
                value={methodology}
                onChange={(e) => setMethodology(e.target.value as ProjectMethodology)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {(Object.keys(PROJECT_METHODOLOGY_META) as ProjectMethodology[]).map((m) => (
                  <option key={m} value={m}>
                    {pickLabel(PROJECT_METHODOLOGY_META[m], locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Phạm vi hiển thị', 'Visibility')}
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ProjectVisibility)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {(Object.keys(PROJECT_VISIBILITY_META) as ProjectVisibility[]).map((v) => (
                  <option key={v} value={v}>
                    {pickLabel(PROJECT_VISIBILITY_META[v], locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Mức ưu tiên', 'Priority')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {(Object.keys(PROJECT_PRIORITY_META) as ProjectPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {pickLabel(PROJECT_PRIORITY_META[p], locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Ngày bắt đầu', 'Start Date')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Ngày kết thúc dự kiến', 'Target End Date')}
              </label>
              <input
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Ngân sách dự kiến (VNĐ)', 'Planned Budget (VND)')}
              </label>
              <input
                type="number"
                min={0}
                step={100000}
                value={plannedBudget}
                onChange={(e) => setPlannedBudget(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Sức khỏe dự án (RAG)', 'Project Health (RAG)')}
              </label>
              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value as ProjectHealthStatus)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {(Object.keys(PROJECT_HEALTH_META) as ProjectHealthStatus[]).map((h) => (
                  <option key={h} value={h}>
                    {pickLabel(PROJECT_HEALTH_META[h], locale)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              {tr('Màu nhận diện dự án', 'Project Accent Color')}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PROJECT_COLOR_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColorHex(hex)}
                  style={{ backgroundColor: hex }}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    colorHex === hex ? 'scale-110 ring-2 ring-slate-900 ring-offset-2' : 'opacity-80 hover:opacity-100'
                  }`}
                  aria-label={hex}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting
                ? tr('Đang lưu...', 'Saving...')
                : isEdit
                  ? tr('Lưu thay đổi', 'Save Changes')
                  : tr('Tạo dự án', 'Create Project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
