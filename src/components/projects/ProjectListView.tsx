'use client';

import { useMemo, useState } from 'react';
import {
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconSubtask,
} from '@tabler/icons-react';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { ProjectColumnView } from '@/modules/projects/projects.service';
import type { TaskListItem } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import { pickLabel, TASK_PRIORITY_META, TASK_TYPE_META } from './project-ui-helpers';

interface ProjectListViewProps {
  columns: ProjectColumnView[];
  tasks: TaskListItem[];
  canEditTasks: boolean;
  onSelectTask: (taskId: number) => void;
  onQuickColumnChange: (task: TaskListItem, nextColumnId: number) => Promise<void>;
  onCreateTask: () => void;
}

interface TreeRow {
  task: TaskListItem;
  depth: number;
  hasChildren: boolean;
}

export function ProjectListView({
  columns,
  tasks,
  canEditTasks,
  onSelectTask,
  onQuickColumnChange,
  onCreateTask,
}: ProjectListViewProps) {
  const { locale, tr, ln } = useI18n();
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

  const flatRows = useMemo<TreeRow[]>(() => {
    const byId = new Map<number, TaskListItem>(tasks.map((t) => [t.id, t]));
    const childrenMap = new Map<number | null, TaskListItem[]>();

    for (const t of tasks) {
      const parentKey = t.parentTaskId && byId.has(t.parentTaskId) ? t.parentTaskId : null;
      const list = childrenMap.get(parentKey) ?? [];
      list.push(t);
      childrenMap.set(parentKey, list);
    }

    const result: TreeRow[] = [];
    const visit = (parentId: number | null, depth: number) => {
      const items = childrenMap.get(parentId) ?? [];
      for (const item of items) {
        const kids = childrenMap.get(item.id) ?? [];
        result.push({ task: item, depth, hasChildren: kids.length > 0 });
        if (kids.length > 0 && !collapsedIds.has(item.id)) {
          visit(item.id, depth + 1);
        }
      }
    };
    visit(null, 0);
    return result;
  }, [collapsedIds, tasks]);

  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));

  function toggleCollapse(id: number) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <p className="text-sm font-semibold text-slate-800">
          {tr('Dự án chưa có công việc nào', 'No tasks in this project yet')}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {tr(
            'Tạo công việc đầu tiên để bắt đầu theo dõi phân cấp, tiến độ và hạn chót.',
            'Create your first task to start tracking hierarchy, progress, and deadlines.',
          )}
        </p>
        {canEditTasks && (
          <button
            type="button"
            onClick={onCreateTask}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconPlus size={15} />
            {tr('Tạo công việc đầu tiên', 'Create First Task')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{tr('Mã & Công việc', 'Key & Task')}</th>
              <th className="px-3 py-3">{tr('Trạng thái', 'Status')}</th>
              <th className="px-3 py-3">{tr('Ưu tiên', 'Priority')}</th>
              <th className="px-3 py-3">{tr('Người thực hiện', 'Assignees')}</th>
              <th className="px-3 py-3">{tr('Hạn chót', 'Due Date')}</th>
              <th className="px-3 py-3">{tr('Tiến độ', 'Progress')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {flatRows.map(({ task, depth, hasChildren }) => {
              const isOverdue = Boolean(
                task.dueDate && task.statusCategory !== 'DONE' && task.dueDate < todayStr,
              );
              const isCollapsed = collapsedIds.has(task.id);
              return (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className="cursor-pointer hover:bg-blue-50/40"
                >
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-1.5"
                      style={{ paddingLeft: `${depth * 20}px` }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapse(task.id);
                          }}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        >
                          {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                        </button>
                      ) : depth > 0 ? (
                        <IconSubtask size={13} className="shrink-0 text-slate-300" />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                      <span className="font-mono font-semibold text-slate-500">{task.taskKey}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TASK_TYPE_META[task.taskType].cls}`}
                      >
                        {pickLabel(TASK_TYPE_META[task.taskType], locale)}
                      </span>
                      <span
                        className={`max-w-[320px] truncate font-semibold ${
                          task.statusCategory === 'DONE'
                            ? 'text-slate-400 line-through'
                            : 'text-slate-900'
                        }`}
                        title={task.title}
                      >
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    {canEditTasks ? (
                      <select
                        value={task.columnId}
                        onChange={(e) => void onQuickColumnChange(task, Number(e.target.value))}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                      >
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {ln(c.name, c.nameEn)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                        {ln(task.columnName, task.columnNameEn)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TASK_PRIORITY_META[task.priority].cls}`}
                    >
                      {pickLabel(TASK_PRIORITY_META[task.priority], locale)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {task.assignees.length > 0
                      ? task.assignees.map((a) => a.fullName).join(', ')
                      : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={isOverdue ? 'font-semibold text-rose-600' : 'text-slate-600'}>
                      {task.dueDate ? formatDateVN(task.dueDate) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${task.progressPercent}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-600">{task.progressPercent}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
