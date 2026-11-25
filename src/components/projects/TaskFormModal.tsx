'use client';

import { useState, type FormEvent } from 'react';
import { IconX } from '@tabler/icons-react';
import type { TaskPriority, TaskType } from '@/config/database';
import type {
  ProjectColumnView,
  ProjectLabelView,
  ProjectMemberView,
} from '@/modules/projects/projects.service';
import type { TaskDetailView } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import { pickLabel, TASK_PRIORITY_META, TASK_TYPE_META } from './project-ui-helpers';

interface TaskFormModalProps {
  isOpen: boolean;
  projectId: number;
  columns: ProjectColumnView[];
  members: ProjectMemberView[];
  labels: ProjectLabelView[];
  defaultColumnId?: number;
  parentTaskId?: number | null;
  parentTaskLabel?: string | null;
  defaultDueDate?: string | null;
  onClose: () => void;
  onCreated: (task: TaskDetailView) => void;
}

export function TaskFormModal({
  isOpen,
  projectId,
  columns,
  members,
  labels,
  defaultColumnId,
  parentTaskId,
  parentTaskLabel,
  defaultDueDate,
  onClose,
  onCreated,
}: TaskFormModalProps) {
  const { locale, tr, ln } = useI18n();
  const initialCol =
    defaultColumnId ??
    columns.find((c) => c.isDefaultInitial)?.id ??
    columns[0]?.id ??
    0;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState<number>(initialCol);
  const [taskType, setTaskType] = useState<TaskType>('TASK');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '');
  const [estimatedHours, setEstimatedHours] = useState('4');
  const [storyPoints, setStoryPoints] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  function toggleAssignee(empId: number) {
    setSelectedAssignees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    );
  }

  function toggleLabel(lblId: number) {
    setSelectedLabels((prev) =>
      prev.includes(lblId) ? prev.filter((id) => id !== lblId) : [...prev, lblId],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    if (title.trim().length < 2) {
      setErrorMsg(tr('Tiêu đề công việc tối thiểu 2 ký tự.', 'Task title must be at least 2 characters.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          parentTaskId: parentTaskId ?? null,
          columnId: columnId || undefined,
          title: title.trim(),
          description: description.trim() || null,
          taskType,
          priority,
          startDate: startDate || null,
          dueDate: dueDate || null,
          estimatedHours: Number(estimatedHours) || 0,
          storyPoints: storyPoints ? Number(storyPoints) : null,
          assigneeEmployeeIds: selectedAssignees,
          labelIds: selectedLabels,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskDetailView;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success || !json.data) {
        throw new Error(
          json?.error?.message ?? tr('Không thể tạo công việc.', 'Failed to create task.'),
        );
      }
      onCreated(json.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {parentTaskId
                ? tr('Tạo công việc con (Subtask)', 'Create Subtask')
                : tr('Tạo công việc mới', 'Create New Task')}
            </h2>
            {parentTaskLabel && (
              <p className="text-xs text-blue-600">
                {tr('Thuộc công việc cha:', 'Parent task:')} {parentTaskLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {tr('Tiêu đề công việc *', 'Task Title *')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr('Nhập tiêu đề rõ ràng, dễ hành động...', 'Enter a clear, actionable task title...')}
              required
              autoFocus
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {tr('Mô tả chi tiết', 'Description')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr('Bối cảnh, yêu cầu đầu ra và tiêu chí hoàn thành...', 'Context, deliverables, and acceptance criteria...')}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Cột trạng thái', 'Status Column')}
              </label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {ln(c.name, c.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Loại công việc', 'Task Type')}
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {(Object.keys(TASK_TYPE_META) as TaskType[]).map((tt) => (
                  <option key={tt} value={tt}>
                    {pickLabel(TASK_TYPE_META[tt], locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Độ ưu tiên', 'Priority')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {(Object.keys(TASK_PRIORITY_META) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {pickLabel(TASK_PRIORITY_META[p], locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Ngày bắt đầu', 'Start Date')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Hạn chót', 'Due Date')}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Giờ ước tính', 'Est. Hours')}
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {tr('Story Points', 'Story Points')}
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="—"
                className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              {tr('Người thực hiện (chọn nhiều)', 'Assignees (multi-select)')}
            </label>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              {members.map((m) => {
                const active = selectedAssignees.includes(m.employeeId);
                return (
                  <button
                    key={m.employeeId}
                    type="button"
                    onClick={() => toggleAssignee(m.employeeId)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {m.fullName}
                  </button>
                );
              })}
            </div>
          </div>

          {labels.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                {tr('Nhãn phân loại', 'Labels')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((lbl) => {
                  const active = selectedLabels.includes(lbl.id);
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => toggleLabel(lbl.id)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                        active ? 'ring-2 ring-slate-900 ring-offset-1' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        borderColor: lbl.colorHex,
                        backgroundColor: active ? lbl.colorHex : `${lbl.colorHex}18`,
                        color: active ? '#fff' : lbl.colorHex,
                      }}
                    >
                      {lbl.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? tr('Đang tạo...', 'Creating...') : tr('Tạo công việc', 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
