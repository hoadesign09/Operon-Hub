'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconAlertTriangle,
  IconCalendar,
  IconChecklist,
  IconGripVertical,
  IconMessageCircle,
  IconPaperclip,
  IconPlus,
  IconSubtask,
} from '@tabler/icons-react';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { ProjectColumnView } from '@/modules/projects/projects.service';
import type { TaskListItem } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import { pickLabel, TASK_PRIORITY_META, TASK_TYPE_META } from './project-ui-helpers';

interface ProjectKanbanBoardProps {
  columns: ProjectColumnView[];
  tasks: TaskListItem[];
  canEditTasks: boolean;
  onSelectTask: (taskId: number) => void;
  onAddTaskInColumn: (columnId: number) => void;
  onMoveTask: (params: {
    taskId: number;
    targetColumnId: number;
    prevRank: string | null;
    nextRank: string | null;
    expectedVersion: number;
  }) => Promise<void>;
}

type SwimlaneMode = 'NONE' | 'PRIORITY' | 'ASSIGNEE';

function KanbanTaskCard({
  task,
  canDrag,
  onClick,
}: {
  task: TaskListItem;
  canDrag: boolean;
  onClick: () => void;
}) {
  const { locale, tr } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task-${task.id}`,
    data: { taskId: task.id, columnId: task.columnId },
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  const isOverdue = Boolean(
    task.dueDate && task.statusCategory !== 'DONE' && task.dueDate < todayStr,
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`group cursor-pointer rounded-xl border bg-white p-3 shadow-xs transition hover:border-blue-300 hover:shadow-md ${
        isDragging ? 'opacity-40 ring-2 ring-blue-500' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-slate-500">{task.taskKey}</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TASK_PRIORITY_META[task.priority].cls}`}
          >
            {pickLabel(TASK_PRIORITY_META[task.priority], locale)}
          </span>
          {task.taskType !== 'TASK' && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TASK_TYPE_META[task.taskType].cls}`}
            >
              {pickLabel(TASK_TYPE_META[task.taskType], locale)}
            </span>
          )}
        </div>
        {canDrag && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
            aria-label={tr('Kéo để di chuyển', 'Drag to move')}
          >
            <IconGripVertical size={14} />
          </button>
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-slate-900">{task.title}</p>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((lbl) => (
            <span
              key={lbl.id}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${lbl.colorHex}18`, color: lbl.colorHex }}
            >
              {lbl.name}
            </span>
          ))}
        </div>
      )}

      {task.hasUnfinishedPredecessor && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
          <IconAlertTriangle size={11} />
          {tr('Chờ phụ thuộc', 'Waiting predecessor')}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                isOverdue ? 'text-rose-600' : 'text-slate-500'
              }`}
            >
              <IconCalendar size={12} />
              {formatDateVN(task.dueDate).slice(0, 5)}
            </span>
          )}
          {task.subtaskCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <IconSubtask size={12} />
              {task.completedSubtaskCount}/{task.subtaskCount}
            </span>
          )}
          {task.checklistTotal > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <IconChecklist size={12} />
              {task.checklistDone}/{task.checklistTotal}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <IconMessageCircle size={12} />
              {task.commentCount}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <IconPaperclip size={12} />
              {task.attachmentCount}
            </span>
          )}
        </div>

        <div className="flex -space-x-1">
          {task.assignees.slice(0, 2).map((a) => (
            <span
              key={a.employeeId}
              title={a.fullName}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[9px] font-bold text-white ring-2 ring-white"
            >
              {a.fullName
                .trim()
                .split(/\s+/)
                .slice(-2)
                .map((p) => p[0])
                .join('')
                .toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanColumnDroppable({
  column,
  tasks,
  canEditTasks,
  onSelectTask,
  onAddTaskInColumn,
}: {
  column: ProjectColumnView;
  tasks: TaskListItem[];
  canEditTasks: boolean;
  onSelectTask: (taskId: number) => void;
  onAddTaskInColumn: (columnId: number) => void;
}) {
  const { tr, ln } = useI18n();
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.id}`,
    data: { columnId: column.id },
  });

  const isWipExceeded = column.wipLimit !== null && tasks.length > column.wipLimit;

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[290px] shrink-0 flex-col rounded-2xl border transition ${
        isOver
          ? 'border-blue-400 bg-blue-50/40'
          : isWipExceeded
            ? 'border-amber-300 bg-amber-50/30'
            : 'border-slate-200 bg-slate-50/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: column.colorHex }}
          />
          <h3 className="truncate text-xs font-bold text-slate-900">
            {ln(column.name, column.nameEn)}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isWipExceeded ? 'bg-amber-200 text-amber-900' : 'bg-slate-200/80 text-slate-700'
            }`}
          >
            {tasks.length}
            {column.wipLimit !== null ? `/${column.wipLimit}` : ''}
          </span>
        </div>
        {canEditTasks && (
          <button
            type="button"
            onClick={() => onAddTaskInColumn(column.id)}
            className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-blue-600"
            title={tr('Thêm công việc vào cột này', 'Add task to this column')}
          >
            <IconPlus size={15} />
          </button>
        )}
      </div>

      <SortableContext
        items={tasks.map((t) => `task-${t.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[260px] flex-1 flex-col gap-2.5 p-2.5">
          {tasks.map((t) => (
            <KanbanTaskCard
              key={t.id}
              task={t}
              canDrag={canEditTasks}
              onClick={() => onSelectTask(t.id)}
            />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400">
              {tr('Kéo thả công việc vào đây', 'Drop tasks here')}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function ProjectKanbanBoard({
  columns,
  tasks,
  canEditTasks,
  onSelectTask,
  onAddTaskInColumn,
  onMoveTask,
}: ProjectKanbanBoardProps) {
  const { locale, tr } = useI18n();
  const [swimlane, setSwimlane] = useState<SwimlaneMode>('NONE');
  const [activeDragTask, setActiveDragTask] = useState<TaskListItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const rootAndVisibleTasks = useMemo(
    () => [...tasks].sort((a, b) => (a.sortRank < b.sortRank ? -1 : a.sortRank > b.sortRank ? 1 : a.id - b.id)),
    [tasks],
  );

  const lanes = useMemo(() => {
    if (swimlane === 'NONE') {
      return [{ key: 'ALL', label: null as string | null, tasks: rootAndVisibleTasks }];
    }
    if (swimlane === 'PRIORITY') {
      const order: Array<TaskListItem['priority']> = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
      return order
        .map((p) => ({
          key: p,
          label: pickLabel(TASK_PRIORITY_META[p], locale),
          tasks: rootAndVisibleTasks.filter((t) => t.priority === p),
        }))
        .filter((l) => l.tasks.length > 0);
    }
    const byAssignee = new Map<string, { key: string; label: string; tasks: TaskListItem[] }>();
    for (const t of rootAndVisibleTasks) {
      const primary = t.assignees[0];
      const key = primary ? `emp-${primary.employeeId}` : 'unassigned';
      const label = primary ? primary.fullName : tr('Chưa phân công', 'Unassigned');
      const group = byAssignee.get(key) ?? { key, label, tasks: [] };
      group.tasks.push(t);
      byAssignee.set(key, group);
    }
    return Array.from(byAssignee.values());
  }, [locale, rootAndVisibleTasks, swimlane, tr]);

  function handleDragStart(event: DragStartEvent) {
    const taskId = Number(String(event.active.id).replace('task-', ''));
    const found = tasks.find((t) => t.id === taskId) ?? null;
    setActiveDragTask(found);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTaskId = Number(String(active.id).replace('task-', ''));
    const draggedTask = tasks.find((t) => t.id === draggedTaskId);
    if (!draggedTask) return;

    const overIdStr = String(over.id);
    let targetColumnId = draggedTask.columnId;
    let overTaskId: number | null = null;

    if (overIdStr.startsWith('col-')) {
      targetColumnId = Number(overIdStr.replace('col-', ''));
    } else if (overIdStr.startsWith('task-')) {
      overTaskId = Number(overIdStr.replace('task-', ''));
      const overTask = tasks.find((t) => t.id === overTaskId);
      if (overTask) {
        targetColumnId = overTask.columnId;
      }
    }

    if (overTaskId === draggedTaskId && targetColumnId === draggedTask.columnId) {
      return;
    }

    const colTasks = rootAndVisibleTasks.filter(
      (t) => t.columnId === targetColumnId && t.id !== draggedTaskId,
    );

    let prevRank: string | null = null;
    let nextRank: string | null = null;
    if (overTaskId !== null) {
      const idx = colTasks.findIndex((t) => t.id === overTaskId);
      if (idx >= 0) {
        prevRank = idx > 0 ? colTasks[idx - 1]!.sortRank : null;
        nextRank = colTasks[idx]!.sortRank;
      } else {
        prevRank = colTasks[colTasks.length - 1]?.sortRank ?? null;
      }
    } else {
      prevRank = colTasks[colTasks.length - 1]?.sortRank ?? null;
    }

    await onMoveTask({
      taskId: draggedTaskId,
      targetColumnId,
      prevRank,
      nextRank,
      expectedVersion: draggedTask.version,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-500">{tr('Nhóm dòng (Swimlane):', 'Swimlane:')}</span>
          {(
            [
              { id: 'NONE', label: tr('Mặc định', 'None') },
              { id: 'PRIORITY', label: tr('Theo độ ưu tiên', 'By Priority') },
              { id: 'ASSIGNEE', label: tr('Theo người thực hiện', 'By Assignee') },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setSwimlane(mode.id)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                swimlane === mode.id
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          {canEditTasks
            ? tr('Kéo biểu tượng ⋮⋮ trên thẻ để di chuyển giữa các cột Kanban.', 'Drag the ⋮⋮ handle on any card to move across Kanban columns.')
            : tr('Chế độ chỉ xem (Viewer).', 'Read-only view.')}
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
          {lanes.map((lane) => (
            <div key={lane.key} className="space-y-2.5">
              {lane.label && (
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                    {lane.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({lane.tasks.length} {tr('công việc', 'tasks')})
                  </span>
                </div>
              )}
              <div className="flex gap-4 overflow-x-auto pb-3">
                {columns.map((col) => (
                  <KanbanColumnDroppable
                    key={col.id}
                    column={col}
                    tasks={lane.tasks.filter((t) => t.columnId === col.id)}
                    canEditTasks={canEditTasks}
                    onSelectTask={onSelectTask}
                    onAddTaskInColumn={onAddTaskInColumn}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeDragTask ? (
            <div className="w-[270px] rounded-xl border-2 border-blue-500 bg-white p-3 shadow-xl">
              <span className="font-mono text-[11px] font-semibold text-blue-600">
                {activeDragTask.taskKey}
              </span>
              <p className="mt-1 text-xs font-semibold text-slate-900">{activeDragTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
