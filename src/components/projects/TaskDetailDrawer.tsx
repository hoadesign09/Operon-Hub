'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  IconActivity,
  IconAlertTriangle,
  IconArchive,
  IconCheck,
  IconChecklist,
  IconDownload,
  IconGitMerge,
  IconMessageCircle,
  IconPaperclip,
  IconPlayerPlay,
  IconPlus,
  IconSend,
  IconSubtask,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { TaskDependencyType, TaskPriority, TaskType } from '@/config/database';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import type {
  TaskActivityView,
  TaskAttachmentView,
  TaskCommentView,
} from '@/modules/projects/collaboration.service';
import type {
  ProjectColumnView,
  ProjectLabelView,
  ProjectMemberView,
} from '@/modules/projects/projects.service';
import type { TaskDetailView, TaskListItem } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import { pickLabel, TASK_PRIORITY_META, TASK_TYPE_META } from './project-ui-helpers';

interface TaskDetailDrawerProps {
  taskId: number | null;
  columns: ProjectColumnView[];
  members: ProjectMemberView[];
  labels: ProjectLabelView[];
  allProjectTasks: TaskListItem[];
  onClose: () => void;
  onTaskUpdated: () => void;
  onSelectTask: (nextTaskId: number) => void;
  onRequestCreateSubtask: (parentTask: TaskDetailView) => void;
}

type DetailSubTab = 'overview' | 'comments' | 'files' | 'activity';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function TaskDetailDrawer({
  taskId,
  columns,
  members,
  labels,
  allProjectTasks,
  onClose,
  onTaskUpdated,
  onSelectTask,
  onRequestCreateSubtask,
}: TaskDetailDrawerProps) {
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const [task, setTask] = useState<TaskDetailView | null>(null);
  const [comments, setComments] = useState<TaskCommentView[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachmentView[]>([]);
  const [activities, setActivities] = useState<TaskActivityView[]>([]);
  const [activeTab, setActiveTab] = useState<DetailSubTab>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Edit form fields
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColumnId, setEditColumnId] = useState<number>(0);
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editTaskType, setEditTaskType] = useState<TaskType>('TASK');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editEstHours, setEditEstHours] = useState('0');
  const [editProgress, setEditProgress] = useState('0');
  const [editAssignees, setEditAssignees] = useState<number[]>([]);
  const [editLabels, setEditLabels] = useState<number[]>([]);

  // Sub-controls
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [depPredecessorId, setDepPredecessorId] = useState('');
  const [depType, setDepType] = useState<TaskDependencyType>('FS');
  const [commentText, setCommentText] = useState('');
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!taskId) return;
    const controller = new AbortController();

    void (async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [taskRes, commentRes, attRes, actRes] = await Promise.all([
          fetch(`/api/v1/tasks/${taskId}`, { signal: controller.signal }),
          fetch(`/api/v1/tasks/${taskId}/comments`, { signal: controller.signal }),
          fetch(`/api/v1/tasks/${taskId}/attachments`, { signal: controller.signal }),
          fetch(`/api/v1/tasks/${taskId}/activities`, { signal: controller.signal }),
        ]);

        const taskJson = (await taskRes.json().catch(() => null)) as {
          success?: boolean;
          data?: TaskDetailView;
          error?: { message?: string };
        } | null;
        if (!taskRes.ok || !taskJson?.success || !taskJson.data) {
          throw new Error(
            taskJson?.error?.message ??
              trRef.current('Không thể tải chi tiết công việc.', 'Failed to load task details.'),
          );
        }

        const loaded = taskJson.data;
        setTask(loaded);
        setEditTitle(loaded.title);
        setEditDesc(loaded.description ?? '');
        setEditColumnId(loaded.columnId);
        setEditPriority(loaded.priority);
        setEditTaskType(loaded.taskType);
        setEditStartDate(loaded.startDate ?? '');
        setEditDueDate(loaded.dueDate ?? '');
        setEditEstHours(String(loaded.estimatedHours));
        setEditProgress(String(loaded.progressPercent));
        setEditAssignees(loaded.assignees.map((a) => a.employeeId));
        setEditLabels(loaded.labels.map((l) => l.id));

        const commentJson = (await commentRes.json().catch(() => null)) as {
          data?: TaskCommentView[];
        } | null;
        const attJson = (await attRes.json().catch(() => null)) as {
          data?: TaskAttachmentView[];
        } | null;
        const actJson = (await actRes.json().catch(() => null)) as {
          data?: TaskActivityView[];
        } | null;

        setComments(commentJson?.data ?? []);
        setAttachments(attJson?.data ?? []);
        setActivities(actJson?.data ?? []);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi kết nối máy chủ.', 'Network error.'),
        );
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [taskId, reloadTick]);

  if (!taskId) return null;

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!task || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          columnId: editColumnId,
          priority: editPriority,
          taskType: editTaskType,
          startDate: editStartDate || null,
          dueDate: editDueDate || null,
          estimatedHours: Number(editEstHours) || 0,
          progressPercent: Number(editProgress) || 0,
          assigneeEmployeeIds: editAssignees,
          labelIds: editLabels,
          expectedVersion: task.version,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskDetailView;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(
          json?.error?.message ?? tr('Không thể cập nhật công việc.', 'Failed to update task.'),
        );
      }
      setTask(json.data);
      setIsEditing(false);
      setReloadTick((n) => n + 1);
      onTaskUpdated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickColumnChange(nextColumnId: number) {
    if (!task || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: nextColumnId, expectedVersion: task.version }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskDetailView;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể chuyển trạng thái.', 'Unable to change status.'));
      }
      setTask(json.data);
      setEditColumnId(json.data.columnId);
      setReloadTick((n) => n + 1);
      onTaskUpdated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddChecklist(e: FormEvent) {
    e.preventDefault();
    if (!task || !newChecklistTitle.trim() || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChecklistTitle.trim() }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskDetailView['checklists'];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể thêm checklist.', 'Failed to add checklist item.'));
      }
      setTask({ ...task, checklists: json.data });
      setNewChecklistTitle('');
      onTaskUpdated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleChecklist(checklistId: number, isCompleted: boolean) {
    if (!task || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/checklists/${checklistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskDetailView['checklists'];
      } | null;
      if (res.ok && json?.success && json.data) {
        setTask({ ...task, checklists: json.data });
        onTaskUpdated();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveChecklist(checklistId: number) {
    if (!task || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/checklists/${checklistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskDetailView['checklists'];
      } | null;
      if (res.ok && json?.success && json.data) {
        setTask({ ...task, checklists: json.data });
        onTaskUpdated();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddDependency(e: FormEvent) {
    e.preventDefault();
    if (!task || !depPredecessorId || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predecessorTaskId: Number(depPredecessorId),
          dependencyType: depType,
          lagDays: 0,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { predecessors: TaskDetailView['predecessors']; successors: TaskDetailView['successors'] };
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể thêm phụ thuộc.', 'Failed to add dependency.'));
      }
      setTask({ ...task, predecessors: json.data.predecessors, successors: json.data.successors });
      setDepPredecessorId('');
      onTaskUpdated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveDependency(dependencyId: number) {
    if (!task || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/dependencies/${dependencyId}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { predecessors: TaskDetailView['predecessors']; successors: TaskDetailView['successors'] };
      } | null;
      if (res.ok && json?.success && json.data) {
        setTask({ ...task, predecessors: json.data.predecessors, successors: json.data.successors });
        onTaskUpdated();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSendComment(e: FormEvent) {
    e.preventDefault();
    if (!task || !commentText.trim() || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText.trim(),
          parentCommentId: replyToId,
          mentionedEmployeeIds: mentionIds,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskCommentView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể gửi bình luận.', 'Unable to post comment.'));
      }
      setComments(json.data);
      setCommentText('');
      setMentionIds([]);
      setReplyToId(null);
      onTaskUpdated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleResolveComment(c: TaskCommentView) {
    if (!task || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/comments/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: !c.isResolved }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskCommentView[];
      } | null;
      if (res.ok && json?.success && json.data) {
        setComments(json.data);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!task || !file || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/v1/tasks/${task.id}/attachments`, {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskAttachmentView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể tải tệp lên.', 'File upload failed.'));
      }
      setAttachments(json.data);
      onTaskUpdated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      e.target.value = '';
      setBusy(false);
    }
  }

  async function handleArchiveAttachment(attachmentId: number) {
    if (!task || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: TaskAttachmentView[];
      } | null;
      if (res.ok && json?.success && json.data) {
        setAttachments(json.data);
        onTaskUpdated();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleStartTimer() {
    if (!task || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/v1/pm/timelogs/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, isBillable: true }),
      });
      if (res.ok) {
        window.dispatchEvent(new Event('operon-timer-updated'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmArchiveTask() {
    if (!task) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}/archive`, { method: 'POST' });
      if (res.ok) {
        setShowArchiveConfirm(false);
        onTaskUpdated();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  const candidatePredecessors = allProjectTasks.filter((t) => t.id !== task?.id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            {task ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                  {task.taskKey}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_TYPE_META[task.taskType].cls}`}
                >
                  {pickLabel(TASK_TYPE_META[task.taskType], locale)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_PRIORITY_META[task.priority].cls}`}
                >
                  {pickLabel(TASK_PRIORITY_META[task.priority], locale)}
                </span>
                {task.hasUnfinishedPredecessor && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <IconAlertTriangle size={12} />
                    {tr('Chờ việc tiền đề', 'Blocked by predecessor')}
                  </span>
                )}
              </div>
            ) : (
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {task && !isEditing && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleStartTimer()}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                title={tr('Bắt đầu bấm giờ cho công việc này', 'Start live timer on this task')}
              >
                <IconPlayerPlay size={14} />
                {tr('Bấm giờ', 'Timer')}
              </button>
            )}
            {task?.canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {tr('Chỉnh sửa', 'Edit')}
              </button>
            )}
            {task?.canArchive && (
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                title={tr('Lưu trữ công việc (không xóa cứng)', 'Archive task (soft-delete)')}
              >
                <IconArchive size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={tr('Đóng', 'Close')}
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-6">
          {(
            [
              { id: 'overview', label: tr('Chi tiết', 'Details'), count: null },
              { id: 'comments', label: tr('Bình luận', 'Comments'), count: comments.length },
              { id: 'files', label: tr('Tệp đính kèm', 'Files'), count: attachments.length },
              { id: 'activity', label: tr('Lịch sử', 'Activity'), count: activities.length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {isLoading || !task ? (
            <div className="space-y-4">
              <div className="h-7 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : activeTab === 'overview' ? (
            isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Tiêu đề *', 'Title *')}
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Mô tả', 'Description')}
                  </label>
                  <textarea
                    rows={4}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      {tr('Cột trạng thái', 'Column')}
                    </label>
                    <select
                      value={editColumnId}
                      onChange={(e) => setEditColumnId(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
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
                      {tr('Loại', 'Type')}
                    </label>
                    <select
                      value={editTaskType}
                      onChange={(e) => setEditTaskType(e.target.value as TaskType)}
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
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
                      {tr('Ưu tiên', 'Priority')}
                    </label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
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
                      {tr('Bắt đầu', 'Start')}
                    </label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      {tr('Hạn chót', 'Due')}
                    </label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs"
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
                      value={editEstHours}
                      onChange={(e) => setEditEstHours(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      {tr('Tiến độ %', 'Progress %')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editProgress}
                      onChange={(e) => setEditProgress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Người thực hiện', 'Assignees')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const active = editAssignees.includes(m.employeeId);
                      return (
                        <button
                          key={m.employeeId}
                          type="button"
                          onClick={() =>
                            setEditAssignees((prev) =>
                              prev.includes(m.employeeId)
                                ? prev.filter((id) => id !== m.employeeId)
                                : [...prev, m.employeeId],
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-700'
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
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      {tr('Nhãn', 'Labels')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((l) => {
                        const active = editLabels.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() =>
                              setEditLabels((prev) =>
                                prev.includes(l.id) ? prev.filter((id) => id !== l.id) : [...prev, l.id],
                              )
                            }
                            style={{
                              borderColor: l.colorHex,
                              backgroundColor: active ? l.colorHex : `${l.colorHex}18`,
                              color: active ? '#fff' : l.colorHex,
                            }}
                            className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                          >
                            {l.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    {tr('Hủy', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy ? tr('Đang lưu...', 'Saving...') : tr('Lưu cập nhật', 'Save Update')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* View-first Summary */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {task.description || tr('Chưa có mô tả chi tiết.', 'No description provided.')}
                  </p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs sm:grid-cols-3">
                  <div>
                    <span className="block text-slate-400">{tr('Trạng thái cột', 'Column Status')}</span>
                    {task.canEdit ? (
                      <select
                        value={task.columnId}
                        disabled={busy}
                        onChange={(e) => handleQuickColumnChange(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-800"
                      >
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {ln(c.name, c.nameEn)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="mt-1 inline-block font-semibold text-slate-800">
                        {ln(task.columnName, task.columnNameEn)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="block text-slate-400">{tr('Thời gian', 'Schedule')}</span>
                    <span className="mt-1 inline-block font-medium text-slate-800">
                      {task.startDate ? formatDateVN(task.startDate) : '—'} →{' '}
                      {task.dueDate ? formatDateVN(task.dueDate) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400">{tr('Tiến độ & Giờ ước tính', 'Progress & Est.')}</span>
                    <span className="mt-1 inline-block font-semibold text-slate-800">
                      {task.progressPercent}% • {task.estimatedHours}h
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="block text-slate-400">{tr('Người thực hiện', 'Assignees')}</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {task.assignees.length > 0 ? (
                        task.assignees.map((a) => (
                          <span
                            key={a.employeeId}
                            className="rounded-full bg-white px-2.5 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200"
                          >
                            {a.fullName}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">{tr('Chưa phân công', 'Unassigned')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtasks */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <IconSubtask size={15} />
                      {tr('Công việc con (Subtasks)', 'Subtasks')} ({task.subtasks.length})
                    </h4>
                    {task.canEdit && (
                      <button
                        type="button"
                        onClick={() => onRequestCreateSubtask(task)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        <IconPlus size={13} />
                        {tr('Thêm Subtask', 'Add Subtask')}
                      </button>
                    )}
                  </div>
                  {task.subtasks.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      {tr('Chưa có công việc con nào.', 'No subtasks yet.')}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {task.subtasks.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onSelectTask(sub.id)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-xs hover:border-blue-300 hover:bg-blue-50/40"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono font-semibold text-slate-500">
                              {sub.taskKey}
                            </span>
                            <span
                              className={`truncate font-medium ${
                                sub.statusCategory === 'DONE'
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-800'
                              }`}
                            >
                              {sub.title}
                            </span>
                          </div>
                          <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {ln(sub.columnName, sub.columnNameEn)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Checklists */}
                <div className="space-y-2.5">
                  <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <IconChecklist size={15} />
                    {tr('Danh sách kiểm tra (Checklist)', 'Checklist')} (
                    {task.checklists.filter((c) => c.isCompleted).length}/{task.checklists.length})
                  </h4>
                  <div className="space-y-1.5">
                    {task.checklists.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      >
                        <label className="flex flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.isCompleted}
                            disabled={!task.canEdit || busy}
                            onChange={(e) => handleToggleChecklist(item.id, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                          <span
                            className={
                              item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'
                            }
                          >
                            {item.title}
                          </span>
                        </label>
                        {task.canEdit && (
                          <button
                            type="button"
                            onClick={() => handleArchiveChecklist(item.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <IconTrash size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {task.canEdit && (
                    <form onSubmit={handleAddChecklist} className="flex gap-2">
                      <input
                        type="text"
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        placeholder={tr('Thêm mục kiểm tra mới...', 'Add a checklist item...')}
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={busy || !newChecklistTitle.trim()}
                        className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {tr('Thêm', 'Add')}
                      </button>
                    </form>
                  )}
                </div>

                {/* Dependencies */}
                <div className="space-y-2.5">
                  <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <IconGitMerge size={15} />
                    {tr('Phụ thuộc công việc (Dependencies)', 'Task Dependencies')}
                  </h4>
                  {task.predecessors.length === 0 && task.successors.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      {tr('Chưa thiết lập liên kết phụ thuộc.', 'No dependencies linked yet.')}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {task.predecessors.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs"
                        >
                          <div className="truncate">
                            <span className="mr-1.5 rounded bg-amber-200/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-900">
                              {d.dependencyType}
                            </span>
                            <span className="text-slate-500">{tr('Chờ:', 'Waits on:')} </span>
                            <button
                              type="button"
                              onClick={() => onSelectTask(d.predecessorTaskId)}
                              className="font-semibold text-blue-700 hover:underline"
                            >
                              {d.predecessorTaskKey} — {d.predecessorTitle}
                            </button>
                          </div>
                          {task.canEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDependency(d.id)}
                              className="ml-2 text-slate-400 hover:text-rose-600"
                            >
                              <IconX size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {task.canEdit && candidatePredecessors.length > 0 && (
                    <form onSubmit={handleAddDependency} className="flex flex-wrap gap-2">
                      <select
                        value={depPredecessorId}
                        onChange={(e) => setDepPredecessorId(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
                      >
                        <option value="">
                          {tr('-- Chọn công việc tiền đề --', '-- Select predecessor task --')}
                        </option>
                        {candidatePredecessors.map((pt) => (
                          <option key={pt.id} value={pt.id}>
                            {pt.taskKey} — {pt.title}
                          </option>
                        ))}
                      </select>
                      <select
                        value={depType}
                        onChange={(e) => setDepType(e.target.value as TaskDependencyType)}
                        className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
                      >
                        <option value="FS">FS</option>
                        <option value="SS">SS</option>
                        <option value="FF">FF</option>
                        <option value="SF">SF</option>
                      </select>
                      <button
                        type="submit"
                        disabled={busy || !depPredecessorId}
                        className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {tr('Gắn phụ thuộc', 'Link')}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )
          ) : activeTab === 'comments' ? (
            <div className="space-y-4">
              <form onSubmit={handleSendComment} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {replyToId && (
                  <div className="flex items-center justify-between text-xs text-blue-700">
                    <span>{tr('Đang trả lời bình luận #', 'Replying to comment #')}{replyToId}</span>
                    <button type="button" onClick={() => setReplyToId(null)} className="underline">
                      {tr('Hủy', 'Cancel')}
                    </button>
                  </div>
                )}
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={tr('Viết bình luận trao đổi tiến độ...', 'Write a comment or update...')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] font-medium text-slate-500">@Mention:</span>
                    {members.slice(0, 6).map((m) => {
                      const active = mentionIds.includes(m.employeeId);
                      return (
                        <button
                          key={m.employeeId}
                          type="button"
                          onClick={() =>
                            setMentionIds((prev) =>
                              prev.includes(m.employeeId)
                                ? prev.filter((id) => id !== m.employeeId)
                                : [...prev, m.employeeId],
                            )
                          }
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-600 ring-1 ring-slate-200'
                          }`}
                        >
                          @{m.fullName.split(' ').slice(-1)[0]}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !commentText.trim()}
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <IconSend size={13} />
                    {tr('Gửi', 'Post')}
                  </button>
                </div>
              </form>

              {comments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  <IconMessageCircle className="mx-auto mb-2 text-slate-300" size={28} />
                  {tr('Chưa có bình luận nào cho công việc này.', 'No comments yet on this task.')}
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-2xl border p-3.5 text-xs ${
                        c.parentCommentId ? 'ml-6 border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-white'
                      } ${c.isResolved ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-slate-900">{c.authorName}</span>
                          <span className="ml-2 text-[11px] text-slate-400">
                            {formatDateTimeVN(c.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyToId(c.id)}
                            className="text-[11px] font-medium text-blue-600 hover:underline"
                          >
                            {tr('Trả lời', 'Reply')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleResolveComment(c)}
                            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              c.isResolved
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-50'
                            }`}
                          >
                            <IconCheck size={11} />
                            {c.isResolved ? tr('Đã xong', 'Resolved') : tr('Đánh dấu xong', 'Resolve')}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'files' ? (
            <div className="space-y-4">
              {task.canEdit && (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center hover:border-blue-400 hover:bg-blue-50/30">
                  <IconUpload size={22} className="mb-1.5 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700">
                    {tr('Nhấn để tải tệp đính kèm lên (tối đa 10 MB)', 'Click to upload attachment (max 10 MB)')}
                  </span>
                  <span className="mt-0.5 text-[11px] text-slate-400">
                    PDF, PNG, JPG, DOCX, XLSX, PPTX, CSV, ZIP
                  </span>
                  <input type="file" onChange={handleUploadFile} disabled={busy} className="hidden" />
                </label>
              )}

              {attachments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <IconPaperclip className="mx-auto mb-2 text-slate-300" size={26} />
                  {tr('Chưa có tệp đính kèm nào.', 'No files attached yet.')}
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{att.fileName}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatBytes(att.fileSizeBytes)} • {att.uploadedByName} •{' '}
                          {formatDateTimeVN(att.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/api/v1/tasks/${task.id}/attachments/${att.id}`}
                          className="rounded-lg bg-slate-100 p-1.5 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                          title={tr('Tải xuống', 'Download')}
                        >
                          <IconDownload size={15} />
                        </a>
                        {att.canArchive && (
                          <button
                            type="button"
                            onClick={() => handleArchiveAttachment(att.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title={tr('Gỡ tệp', 'Remove file')}
                          >
                            <IconTrash size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {activities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <IconActivity className="mx-auto mb-2 text-slate-300" size={26} />
                  {tr('Chưa ghi nhận hoạt động nào.', 'No activity recorded yet.')}
                </div>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-800">
                        <strong className="font-semibold">{act.actorName}</strong>{' '}
                        <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                          {act.actionType}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatDateTimeVN(act.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showArchiveConfirm}
        title={tr('Lưu trữ công việc', 'Archive Task')}
        description={tr(
          'Công việc sẽ được ẩn khỏi bảng làm việc nhưng vẫn bảo toàn lịch sử trong cơ sở dữ liệu (không xóa cứng).',
          'This task will be hidden from active views while preserving full audit history (no hard-delete).',
        )}
        confirmLabel={tr('Lưu trữ', 'Archive')}
        variant="danger"
        onCancel={() => setShowArchiveConfirm(false)}
        onConfirm={handleConfirmArchiveTask}
      />
    </div>
  );
}
