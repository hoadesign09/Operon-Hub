import { sql } from 'kysely';
import {
  getDb,
  type TaskDependencyType,
  type TaskPriority,
  type TaskStatusCategory,
  type TaskType,
} from '@/config/database';
import { rankAfter, rankBetween } from '@/lib/portable/fractional-rank';
import { wouldCreateCycle } from '@/lib/portable/tree-utils';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import { recordTaskActivity } from '@/modules/projects/collaboration.service';
import {
  assertProjectAccess,
  resolveEmployeeForUser,
} from '@/modules/projects/projects.access';
import { MAX_TASK_HIERARCHY_DEPTH } from '@/modules/projects/projects.constants';
import type {
  CreateChecklistInput,
  CreateDependencyInput,
  CreateTaskInput,
  MoveTaskInput,
  UpdateChecklistInput,
  UpdateTaskInput,
} from '@/modules/projects/projects.schema';
import { recalculateProjectProgress } from '@/modules/projects/projects.service';
import { AppError } from '@/shared/api-response';

export interface TaskPersonRef {
  employeeId: number;
  fullName: string;
  employeeCode: string;
  role?: 'PRIMARY' | 'COLLABORATOR';
}

export interface TaskLabelRef {
  id: number;
  name: string;
  colorHex: string;
}

export interface TaskChecklistItemView {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
  assigneeEmployeeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  sortOrder: number;
}

export interface TaskDependencyView {
  id: number;
  predecessorTaskId: number;
  predecessorTaskKey: string;
  predecessorTitle: string;
  predecessorStatusCategory: TaskStatusCategory;
  successorTaskId: number;
  successorTaskKey: string;
  successorTitle: string;
  dependencyType: TaskDependencyType;
  lagDays: number;
}

export interface TaskListItem {
  id: number;
  projectId: number;
  projectCode: string;
  projectName: string;
  projectColorHex: string;
  parentTaskId: number | null;
  columnId: number;
  columnName: string;
  columnNameEn?: string | null;
  columnColorHex: string;
  sprintId: number | null;
  milestoneId: number | null;
  taskKey: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  priority: TaskPriority;
  statusCategory: TaskStatusCategory;
  reporterEmployeeId: number;
  reporterName: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: number;
  actualHours: number;
  storyPoints: number | null;
  progressPercent: number;
  sortRank: string;
  isBlocked: boolean;
  blockedReason: string | null;
  version: number;
  assignees: TaskPersonRef[];
  labels: TaskLabelRef[];
  subtaskCount: number;
  completedSubtaskCount: number;
  checklistTotal: number;
  checklistDone: number;
  commentCount: number;
  attachmentCount: number;
  hasUnfinishedPredecessor: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetailView extends TaskListItem {
  watchers: TaskPersonRef[];
  subtasks: TaskListItem[];
  checklists: TaskChecklistItemView[];
  predecessors: TaskDependencyView[];
  successors: TaskDependencyView[];
  canEdit: boolean;
  canArchive: boolean;
}

export interface MyTasksGroupedView {
  overdue: TaskListItem[];
  today: TaskListItem[];
  thisWeek: TaskListItem[];
  upcoming: TaskListItem[];
  noDueDate: TaskListItem[];
  watching: TaskListItem[];
  summary: {
    totalAssignedOpen: number;
    overdueCount: number;
    dueTodayCount: number;
    inProgressCount: number;
    completedLast7Days: number;
  };
}

function toIsoDateOnly(val: Date | string | null | undefined): string | null {
  if (!val) {
    return null;
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

function toIsoDateTime(val: Date | string | null | undefined): string | null {
  if (!val) {
    return null;
  }
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

/**
 * Pure DAG cycle detector for task dependencies (predecessor -> successor).
 */
export function wouldCreateDependencyCycle(
  edges: ReadonlyArray<{ predecessorTaskId: number; successorTaskId: number }>,
  predecessorTaskId: number,
  successorTaskId: number,
): boolean {
  if (predecessorTaskId === successorTaskId) {
    return true;
  }

  const adj = new Map<number, number[]>();
  for (const edge of edges) {
    const list = adj.get(edge.predecessorTaskId) ?? [];
    list.push(edge.successorTaskId);
    adj.set(edge.predecessorTaskId, list);
  }

  // Adding predecessor -> successor creates a cycle iff predecessor is reachable from successor
  const visited = new Set<number>();
  const queue: number[] = [successorTaskId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === predecessorTaskId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const nextNodes = adj.get(current) ?? [];
    for (const next of nextNodes) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }
  return false;
}

/**
 * Pure depth calculator for parent-child task hierarchy (root = depth 1).
 */
export function computeTaskDepth(
  nodes: ReadonlyArray<{ id: number; parentId: number | null }>,
  parentTaskId: number | null,
): number {
  if (parentTaskId === null) {
    return 1;
  }
  const map = new Map<number, number | null>();
  for (const n of nodes) {
    map.set(n.id, n.parentId);
  }

  let depth = 1;
  let cursor: number | null = parentTaskId;
  const seen = new Set<number>();
  while (cursor !== null) {
    if (seen.has(cursor)) {
      return MAX_TASK_HIERARCHY_DEPTH + 1;
    }
    seen.add(cursor);
    depth += 1;
    cursor = map.get(cursor) ?? null;
  }
  return depth;
}

async function hydrateTasks(
  rows: ReadonlyArray<{
    id: number;
    project_id: number;
    project_code: string;
    project_name: string;
    project_color_hex: string;
    parent_task_id: number | null;
    column_id: number;
    column_name: string;
    column_name_en?: string | null;
    column_color_hex: string;
    sprint_id: number | null;
    milestone_id: number | null;
    task_key: string;
    title: string;
    description: string | null;
    task_type: TaskType;
    priority: TaskPriority;
    status_category: TaskStatusCategory;
    reporter_employee_id: number;
    reporter_name: string;
    start_date: Date | string | null;
    due_date: Date | string | null;
    completed_at: Date | null;
    estimated_hours: string | number;
    actual_hours: string | number;
    story_points: string | number | null;
    progress_percent: number;
    sort_rank: string;
    is_blocked: number;
    blocked_reason: string | null;
    version: number;
    created_at: Date;
    updated_at: Date;
  }>,
): Promise<TaskListItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const db = getDb();
  const taskIds = rows.map((r) => Number(r.id));

  const [
    assigneeRows,
    labelRows,
    subtaskCounts,
    checklistCounts,
    commentCounts,
    attachmentCounts,
    unfinishedDeps,
  ] = await Promise.all([
    db
      .selectFrom('task_assignees')
      .innerJoin('employees', 'employees.id', 'task_assignees.employee_id')
      .select([
        'task_assignees.task_id',
        'task_assignees.employee_id',
        'task_assignees.assignment_role',
        'employees.full_name',
        'employees.employee_code',
      ])
      .where('task_assignees.task_id', 'in', taskIds)
      .execute(),
    db
      .selectFrom('task_label_links')
      .innerJoin('project_labels', 'project_labels.id', 'task_label_links.label_id')
      .select([
        'task_label_links.task_id',
        'project_labels.id as label_id',
        'project_labels.name',
        'project_labels.color_hex',
      ])
      .where('task_label_links.task_id', 'in', taskIds)
      .where('project_labels.deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('tasks')
      .select([
        'parent_task_id',
        sql<number>`COUNT(*)`.as('total'),
        sql<number>`SUM(CASE WHEN status_category = 'DONE' THEN 1 ELSE 0 END)`.as('done'),
      ])
      .where('parent_task_id', 'in', taskIds)
      .where('deleted_at', 'is', null)
      .groupBy('parent_task_id')
      .execute(),
    db
      .selectFrom('task_checklists')
      .select([
        'task_id',
        sql<number>`COUNT(*)`.as('total'),
        sql<number>`SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END)`.as('done'),
      ])
      .where('task_id', 'in', taskIds)
      .where('deleted_at', 'is', null)
      .groupBy('task_id')
      .execute(),
    db
      .selectFrom('task_comments')
      .select(['task_id', sql<number>`COUNT(*)`.as('cnt')])
      .where('task_id', 'in', taskIds)
      .where('deleted_at', 'is', null)
      .groupBy('task_id')
      .execute(),
    db
      .selectFrom('task_attachments')
      .select(['task_id', sql<number>`COUNT(*)`.as('cnt')])
      .where('task_id', 'in', taskIds)
      .where('deleted_at', 'is', null)
      .groupBy('task_id')
      .execute(),
    db
      .selectFrom('task_dependencies')
      .innerJoin('tasks as pred', 'pred.id', 'task_dependencies.predecessor_task_id')
      .select(['task_dependencies.successor_task_id'])
      .where('task_dependencies.successor_task_id', 'in', taskIds)
      .where('pred.deleted_at', 'is', null)
      .where('pred.status_category', '!=', 'DONE')
      .distinct()
      .execute(),
  ]);

  const assigneesMap = new Map<number, TaskPersonRef[]>();
  for (const a of assigneeRows) {
    const tid = Number(a.task_id);
    const list = assigneesMap.get(tid) ?? [];
    list.push({
      employeeId: Number(a.employee_id),
      fullName: a.full_name,
      employeeCode: a.employee_code,
      role: a.assignment_role,
    });
    assigneesMap.set(tid, list);
  }

  const labelsMap = new Map<number, TaskLabelRef[]>();
  for (const l of labelRows) {
    const tid = Number(l.task_id);
    const list = labelsMap.get(tid) ?? [];
    list.push({ id: Number(l.label_id), name: l.name, colorHex: l.color_hex });
    labelsMap.set(tid, list);
  }

  const subMap = new Map<number, { total: number; done: number }>();
  for (const s of subtaskCounts) {
    if (s.parent_task_id !== null) {
      subMap.set(Number(s.parent_task_id), { total: Number(s.total ?? 0), done: Number(s.done ?? 0) });
    }
  }

  const checkMap = new Map<number, { total: number; done: number }>();
  for (const c of checklistCounts) {
    checkMap.set(Number(c.task_id), { total: Number(c.total ?? 0), done: Number(c.done ?? 0) });
  }

  const commentMap = new Map<number, number>();
  for (const cm of commentCounts) {
    commentMap.set(Number(cm.task_id), Number(cm.cnt ?? 0));
  }

  const attMap = new Map<number, number>();
  for (const at of attachmentCounts) {
    if (at.task_id !== null) {
      attMap.set(Number(at.task_id), Number(at.cnt ?? 0));
    }
  }

  const blockedByPredSet = new Set<number>(unfinishedDeps.map((d) => Number(d.successor_task_id)));

  return rows.map((r) => {
    const tid = Number(r.id);
    const sub = subMap.get(tid) ?? { total: 0, done: 0 };
    const chk = checkMap.get(tid) ?? { total: 0, done: 0 };
    return {
      id: tid,
      projectId: Number(r.project_id),
      projectCode: r.project_code,
      projectName: r.project_name,
      projectColorHex: r.project_color_hex,
      parentTaskId: r.parent_task_id !== null ? Number(r.parent_task_id) : null,
      columnId: Number(r.column_id),
      columnName: r.column_name,
      columnNameEn: r.column_name_en ?? null,
      columnColorHex: r.column_color_hex,
      sprintId: r.sprint_id !== null ? Number(r.sprint_id) : null,
      milestoneId: r.milestone_id !== null ? Number(r.milestone_id) : null,
      taskKey: r.task_key,
      title: r.title,
      description: r.description,
      taskType: r.task_type,
      priority: r.priority,
      statusCategory: r.status_category,
      reporterEmployeeId: Number(r.reporter_employee_id),
      reporterName: r.reporter_name,
      startDate: toIsoDateOnly(r.start_date),
      dueDate: toIsoDateOnly(r.due_date),
      completedAt: toIsoDateTime(r.completed_at),
      estimatedHours: Number(r.estimated_hours ?? 0),
      actualHours: Number(r.actual_hours ?? 0),
      storyPoints: r.story_points !== null ? Number(r.story_points) : null,
      progressPercent: Number(r.progress_percent ?? 0),
      sortRank: r.sort_rank,
      isBlocked: Number(r.is_blocked) === 1,
      blockedReason: r.blocked_reason,
      version: Number(r.version),
      assignees: assigneesMap.get(tid) ?? [],
      labels: labelsMap.get(tid) ?? [],
      subtaskCount: sub.total,
      completedSubtaskCount: sub.done,
      checklistTotal: chk.total,
      checklistDone: chk.done,
      commentCount: commentMap.get(tid) ?? 0,
      attachmentCount: attMap.get(tid) ?? 0,
      hasUnfinishedPredecessor: blockedByPredSet.has(tid),
      createdAt: toIsoDateTime(r.created_at)!,
      updatedAt: toIsoDateTime(r.updated_at)!,
    };
  });
}

export async function listProjectTasks(
  auth: AuthContext,
  projectIdOrCode: string | number,
  filters: {
    search?: string | null;
    columnId?: string | null;
    priority?: string | null;
    taskType?: string | null;
    assigneeEmployeeId?: string | null;
    labelId?: string | null;
    dueFrom?: string | null;
    dueTo?: string | null;
    rootOnly?: string | null;
  } = {},
): Promise<TaskListItem[]> {
  const access = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const db = getDb();

  let query = db
    .selectFrom('tasks')
    .innerJoin('projects', 'projects.id', 'tasks.project_id')
    .innerJoin('project_board_columns', 'project_board_columns.id', 'tasks.column_id')
    .innerJoin('employees as rep_emp', 'rep_emp.id', 'tasks.reporter_employee_id')
    .select([
      'tasks.id',
      'tasks.project_id',
      'projects.code as project_code',
      'projects.name as project_name',
      'projects.color_hex as project_color_hex',
      'tasks.parent_task_id',
      'tasks.column_id',
      'project_board_columns.name as column_name',
      'project_board_columns.name_en as column_name_en',
      'project_board_columns.color_hex as column_color_hex',
      'tasks.sprint_id',
      'tasks.milestone_id',
      'tasks.task_key',
      'tasks.title',
      'tasks.description',
      'tasks.task_type',
      'tasks.priority',
      'tasks.status_category',
      'tasks.reporter_employee_id',
      'rep_emp.full_name as reporter_name',
      'tasks.start_date',
      'tasks.due_date',
      'tasks.completed_at',
      'tasks.estimated_hours',
      'tasks.actual_hours',
      'tasks.story_points',
      'tasks.progress_percent',
      'tasks.sort_rank',
      'tasks.is_blocked',
      'tasks.blocked_reason',
      'tasks.version',
      'tasks.created_at',
      'tasks.updated_at',
    ])
    .where('tasks.project_id', '=', access.project.id)
    .where('tasks.deleted_at', 'is', null);

  if (filters.rootOnly === 'true') {
    query = query.where('tasks.parent_task_id', 'is', null);
  }
  if (filters.columnId && /^\d+$/.test(filters.columnId)) {
    query = query.where('tasks.column_id', '=', Number(filters.columnId));
  }
  if (filters.priority) {
    query = query.where('tasks.priority', '=', filters.priority as TaskPriority);
  }
  if (filters.taskType) {
    query = query.where('tasks.task_type', '=', filters.taskType as TaskType);
  }
  if (filters.dueFrom) {
    query = query.where('tasks.due_date', '>=', filters.dueFrom);
  }
  if (filters.dueTo) {
    query = query.where('tasks.due_date', '<=', filters.dueTo);
  }
  if (filters.search && filters.search.trim().length > 0) {
    const kw = `%${filters.search.trim()}%`;
    query = query.where((eb) => eb.or([eb('tasks.task_key', 'like', kw), eb('tasks.title', 'like', kw)]));
  }
  if (filters.assigneeEmployeeId && /^\d+$/.test(filters.assigneeEmployeeId)) {
    const assigneeId = Number(filters.assigneeEmployeeId);
    query = query.where(({ exists, selectFrom }) =>
      exists(
        selectFrom('task_assignees')
          .select('task_assignees.task_id')
          .whereRef('task_assignees.task_id', '=', 'tasks.id')
          .where('task_assignees.employee_id', '=', assigneeId),
      ),
    );
  }
  if (filters.labelId && /^\d+$/.test(filters.labelId)) {
    const lid = Number(filters.labelId);
    query = query.where(({ exists, selectFrom }) =>
      exists(
        selectFrom('task_label_links')
          .select('task_label_links.task_id')
          .whereRef('task_label_links.task_id', '=', 'tasks.id')
          .where('task_label_links.label_id', '=', lid),
      ),
    );
  }

  const rows = await query
    .orderBy('tasks.column_id', 'asc')
    .orderBy('tasks.sort_rank', 'asc')
    .orderBy('tasks.id', 'asc')
    .execute();

  return hydrateTasks(rows);
}

export async function listMyTasks(
  auth: AuthContext,
  options: { includeDone?: boolean } = {},
): Promise<MyTasksGroupedView> {
  const employee = await resolveEmployeeForUser(auth.userId);
  if (!employee) {
    return {
      overdue: [],
      today: [],
      thisWeek: [],
      upcoming: [],
      noDueDate: [],
      watching: [],
      summary: {
        totalAssignedOpen: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        inProgressCount: 0,
        completedLast7Days: 0,
      },
    };
  }

  const db = getDb();
  const baseSelect = [
    'tasks.id',
    'tasks.project_id',
    'projects.code as project_code',
    'projects.name as project_name',
    'projects.color_hex as project_color_hex',
    'tasks.parent_task_id',
    'tasks.column_id',
    'project_board_columns.name as column_name',
    'project_board_columns.name_en as column_name_en',
    'project_board_columns.color_hex as column_color_hex',
    'tasks.sprint_id',
    'tasks.milestone_id',
    'tasks.task_key',
    'tasks.title',
    'tasks.description',
    'tasks.task_type',
    'tasks.priority',
    'tasks.status_category',
    'tasks.reporter_employee_id',
    'rep_emp.full_name as reporter_name',
    'tasks.start_date',
    'tasks.due_date',
    'tasks.completed_at',
    'tasks.estimated_hours',
    'tasks.actual_hours',
    'tasks.story_points',
    'tasks.progress_percent',
    'tasks.sort_rank',
    'tasks.is_blocked',
    'tasks.blocked_reason',
    'tasks.version',
    'tasks.created_at',
    'tasks.updated_at',
  ] as const;

  let assignedQuery = db
    .selectFrom('task_assignees')
    .innerJoin('tasks', 'tasks.id', 'task_assignees.task_id')
    .innerJoin('projects', 'projects.id', 'tasks.project_id')
    .innerJoin('project_board_columns', 'project_board_columns.id', 'tasks.column_id')
    .innerJoin('employees as rep_emp', 'rep_emp.id', 'tasks.reporter_employee_id')
    .select([...baseSelect])
    .where('task_assignees.employee_id', '=', employee.id)
    .where('tasks.deleted_at', 'is', null)
    .where('projects.deleted_at', 'is', null)
    .where('projects.status', '!=', 'ARCHIVED');

  if (!options.includeDone) {
    assignedQuery = assignedQuery.where('tasks.status_category', '!=', 'DONE');
  }

  const [assignedRows, watchingRows, done7dRow] = await Promise.all([
    assignedQuery.orderBy('tasks.due_date', 'asc').orderBy('tasks.priority', 'desc').execute(),
    db
      .selectFrom('task_watchers')
      .innerJoin('tasks', 'tasks.id', 'task_watchers.task_id')
      .innerJoin('projects', 'projects.id', 'tasks.project_id')
      .innerJoin('project_board_columns', 'project_board_columns.id', 'tasks.column_id')
      .innerJoin('employees as rep_emp', 'rep_emp.id', 'tasks.reporter_employee_id')
      .select([...baseSelect])
      .where('task_watchers.employee_id', '=', employee.id)
      .where('tasks.deleted_at', 'is', null)
      .where('projects.deleted_at', 'is', null)
      .where('projects.status', '!=', 'ARCHIVED')
      .where('tasks.status_category', '!=', 'DONE')
      .orderBy('tasks.due_date', 'asc')
      .execute(),
    db
      .selectFrom('task_assignees')
      .innerJoin('tasks', 'tasks.id', 'task_assignees.task_id')
      .select(sql<number>`COUNT(*)`.as('cnt'))
      .where('task_assignees.employee_id', '=', employee.id)
      .where('tasks.deleted_at', 'is', null)
      .where('tasks.status_category', '=', 'DONE')
      .where('tasks.completed_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .executeTakeFirst(),
  ]);

  const [assigned, watchingAll] = await Promise.all([
    hydrateTasks(assignedRows),
    hydrateTasks(watchingRows),
  ]);

  const assignedIdSet = new Set(assigned.map((t) => t.id));
  const watching = watchingAll.filter((t) => !assignedIdSet.has(t.id));

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekEndDate = new Date();
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEndStr = weekEndDate.toISOString().slice(0, 10);

  const overdue: TaskListItem[] = [];
  const today: TaskListItem[] = [];
  const thisWeek: TaskListItem[] = [];
  const upcoming: TaskListItem[] = [];
  const noDueDate: TaskListItem[] = [];

  for (const t of assigned) {
    if (!t.dueDate) {
      noDueDate.push(t);
    } else if (t.statusCategory !== 'DONE' && t.dueDate < todayStr) {
      overdue.push(t);
    } else if (t.dueDate === todayStr) {
      today.push(t);
    } else if (t.dueDate <= weekEndStr) {
      thisWeek.push(t);
    } else {
      upcoming.push(t);
    }
  }

  return {
    overdue,
    today,
    thisWeek,
    upcoming,
    noDueDate,
    watching,
    summary: {
      totalAssignedOpen: assigned.filter((t) => t.statusCategory !== 'DONE').length,
      overdueCount: overdue.length,
      dueTodayCount: today.length,
      inProgressCount: assigned.filter((t) => t.statusCategory === 'IN_PROGRESS').length,
      completedLast7Days: Number(done7dRow?.cnt ?? 0),
    },
  };
}

export async function getTaskDetail(auth: AuthContext, taskId: number): Promise<TaskDetailView> {
  const db = getDb();
  const row = await db
    .selectFrom('tasks')
    .innerJoin('projects', 'projects.id', 'tasks.project_id')
    .innerJoin('project_board_columns', 'project_board_columns.id', 'tasks.column_id')
    .innerJoin('employees as rep_emp', 'rep_emp.id', 'tasks.reporter_employee_id')
    .select([
      'tasks.id',
      'tasks.project_id',
      'projects.code as project_code',
      'projects.name as project_name',
      'projects.color_hex as project_color_hex',
      'tasks.parent_task_id',
      'tasks.column_id',
      'project_board_columns.name as column_name',
      'project_board_columns.name_en as column_name_en',
      'project_board_columns.color_hex as column_color_hex',
      'tasks.sprint_id',
      'tasks.milestone_id',
      'tasks.task_key',
      'tasks.title',
      'tasks.description',
      'tasks.task_type',
      'tasks.priority',
      'tasks.status_category',
      'tasks.reporter_employee_id',
      'rep_emp.full_name as reporter_name',
      'tasks.start_date',
      'tasks.due_date',
      'tasks.completed_at',
      'tasks.estimated_hours',
      'tasks.actual_hours',
      'tasks.story_points',
      'tasks.progress_percent',
      'tasks.sort_rank',
      'tasks.is_blocked',
      'tasks.blocked_reason',
      'tasks.version',
      'tasks.created_at',
      'tasks.updated_at',
    ])
    .where('tasks.id', '=', taskId)
    .where('tasks.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc yêu cầu.', 404);
  }

  const access = await assertProjectAccess(auth, Number(row.project_id), 'VIEW');
  const [hydrated] = await hydrateTasks([row]);

  const [watcherRows, subtaskRows, checklistRows, predRows, succRows] = await Promise.all([
    db
      .selectFrom('task_watchers')
      .innerJoin('employees', 'employees.id', 'task_watchers.employee_id')
      .select(['task_watchers.employee_id', 'employees.full_name', 'employees.employee_code'])
      .where('task_watchers.task_id', '=', taskId)
      .execute(),
    db
      .selectFrom('tasks')
      .innerJoin('projects', 'projects.id', 'tasks.project_id')
      .innerJoin('project_board_columns', 'project_board_columns.id', 'tasks.column_id')
      .innerJoin('employees as rep_emp', 'rep_emp.id', 'tasks.reporter_employee_id')
      .select([
        'tasks.id',
        'tasks.project_id',
        'projects.code as project_code',
        'projects.name as project_name',
        'projects.color_hex as project_color_hex',
        'tasks.parent_task_id',
        'tasks.column_id',
        'project_board_columns.name as column_name',
        'project_board_columns.name_en as column_name_en',
        'project_board_columns.color_hex as column_color_hex',
        'tasks.sprint_id',
        'tasks.milestone_id',
        'tasks.task_key',
        'tasks.title',
        'tasks.description',
        'tasks.task_type',
        'tasks.priority',
        'tasks.status_category',
        'tasks.reporter_employee_id',
        'rep_emp.full_name as reporter_name',
        'tasks.start_date',
        'tasks.due_date',
        'tasks.completed_at',
        'tasks.estimated_hours',
        'tasks.actual_hours',
        'tasks.story_points',
        'tasks.progress_percent',
        'tasks.sort_rank',
        'tasks.is_blocked',
        'tasks.blocked_reason',
        'tasks.version',
        'tasks.created_at',
        'tasks.updated_at',
      ])
      .where('tasks.parent_task_id', '=', taskId)
      .where('tasks.deleted_at', 'is', null)
      .orderBy('tasks.sort_rank', 'asc')
      .execute(),
    db
      .selectFrom('task_checklists')
      .leftJoin('employees', 'employees.id', 'task_checklists.assignee_employee_id')
      .select([
        'task_checklists.id',
        'task_checklists.task_id',
        'task_checklists.title',
        'task_checklists.is_completed',
        'task_checklists.assignee_employee_id',
        'employees.full_name as assignee_name',
        'task_checklists.due_date',
        'task_checklists.sort_order',
      ])
      .where('task_checklists.task_id', '=', taskId)
      .where('task_checklists.deleted_at', 'is', null)
      .orderBy('task_checklists.sort_order', 'asc')
      .orderBy('task_checklists.id', 'asc')
      .execute(),
    db
      .selectFrom('task_dependencies')
      .innerJoin('tasks as pred', 'pred.id', 'task_dependencies.predecessor_task_id')
      .innerJoin('tasks as succ', 'succ.id', 'task_dependencies.successor_task_id')
      .select([
        'task_dependencies.id',
        'task_dependencies.predecessor_task_id',
        'pred.task_key as pred_key',
        'pred.title as pred_title',
        'pred.status_category as pred_status',
        'task_dependencies.successor_task_id',
        'succ.task_key as succ_key',
        'succ.title as succ_title',
        'task_dependencies.dependency_type',
        'task_dependencies.lag_days',
      ])
      .where('task_dependencies.successor_task_id', '=', taskId)
      .where('pred.deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('task_dependencies')
      .innerJoin('tasks as pred', 'pred.id', 'task_dependencies.predecessor_task_id')
      .innerJoin('tasks as succ', 'succ.id', 'task_dependencies.successor_task_id')
      .select([
        'task_dependencies.id',
        'task_dependencies.predecessor_task_id',
        'pred.task_key as pred_key',
        'pred.title as pred_title',
        'pred.status_category as pred_status',
        'task_dependencies.successor_task_id',
        'succ.task_key as succ_key',
        'succ.title as succ_title',
        'task_dependencies.dependency_type',
        'task_dependencies.lag_days',
      ])
      .where('task_dependencies.predecessor_task_id', '=', taskId)
      .where('succ.deleted_at', 'is', null)
      .execute(),
  ]);

  const subtasks = await hydrateTasks(subtaskRows);

  const mapDep = (d: (typeof predRows)[number]): TaskDependencyView => ({
    id: Number(d.id),
    predecessorTaskId: Number(d.predecessor_task_id),
    predecessorTaskKey: d.pred_key,
    predecessorTitle: d.pred_title,
    predecessorStatusCategory: d.pred_status,
    successorTaskId: Number(d.successor_task_id),
    successorTaskKey: d.succ_key,
    successorTitle: d.succ_title,
    dependencyType: d.dependency_type,
    lagDays: Number(d.lag_days),
  });

  return {
    ...hydrated!,
    watchers: watcherRows.map((w) => ({
      employeeId: Number(w.employee_id),
      fullName: w.full_name,
      employeeCode: w.employee_code,
    })),
    subtasks,
    checklists: checklistRows.map((c) => ({
      id: Number(c.id),
      taskId: Number(c.task_id),
      title: c.title,
      isCompleted: Number(c.is_completed) === 1,
      assigneeEmployeeId: c.assignee_employee_id !== null ? Number(c.assignee_employee_id) : null,
      assigneeName: c.assignee_name ?? null,
      dueDate: toIsoDateOnly(c.due_date),
      sortOrder: Number(c.sort_order),
    })),
    predecessors: predRows.map(mapDep),
    successors: succRows.map(mapDep),
    canEdit: access.canEditTasks,
    canArchive: access.canEditProject || hydrated!.reporterEmployeeId === access.employeeId,
  };
}

export async function createTask(
  auth: AuthContext,
  input: CreateTaskInput,
  ipAddress: string | null,
): Promise<TaskDetailView> {
  const access = await assertProjectAccess(auth, input.projectId, 'CONTRIBUTE');
  if (input.startDate && input.dueDate && input.dueDate < input.startDate) {
    throw new AppError(
      'INVALID_DATE_RANGE',
      'Hạn chót (Due Date) phải lớn hơn hoặc bằng ngày bắt đầu.',
      400,
    );
  }

  const db = getDb();
  let reporterEmployeeId = access.employeeId;
  if (!reporterEmployeeId) {
    reporterEmployeeId = access.project.managerEmployeeId;
  }

  // Validate parent task & depth limit
  if (input.parentTaskId) {
    const projectTasks = await db
      .selectFrom('tasks')
      .select(['id', 'parent_task_id'])
      .where('project_id', '=', access.project.id)
      .where('deleted_at', 'is', null)
      .execute();

    const parentExists = projectTasks.some((t) => Number(t.id) === input.parentTaskId);
    if (!parentExists) {
      throw new AppError('PARENT_TASK_NOT_FOUND', 'Công việc cha không thuộc dự án này.', 404);
    }

    const depth = computeTaskDepth(
      projectTasks.map((t) => ({
        id: Number(t.id),
        parentId: t.parent_task_id !== null ? Number(t.parent_task_id) : null,
      })),
      input.parentTaskId,
    );

    if (depth > MAX_TASK_HIERARCHY_DEPTH) {
      throw new AppError(
        'MAX_TASK_DEPTH_EXCEEDED',
        `Cấu trúc công việc cha-con chỉ hỗ trợ tối đa ${MAX_TASK_HIERARCHY_DEPTH} cấp.`,
        400,
      );
    }
  }

  // Resolve target column
  const column = input.columnId
    ? await db
        .selectFrom('project_board_columns')
        .select(['id', 'status_category', 'is_done_column'])
        .where('id', '=', input.columnId)
        .where('project_id', '=', access.project.id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
    : await db
        .selectFrom('project_board_columns')
        .select(['id', 'status_category', 'is_done_column'])
        .where('project_id', '=', access.project.id)
        .where('deleted_at', 'is', null)
        .orderBy('is_default_initial', 'desc')
        .orderBy('sort_order', 'asc')
        .executeTakeFirst();

  if (!column) {
    throw new AppError('COLUMN_NOT_FOUND', 'Không tìm thấy cột trạng thái hợp lệ trong dự án.', 404);
  }

  const createdTaskId = await db.transaction().execute(async (trx) => {
    const lockedProject = await trx
      .selectFrom('projects')
      .select(['id', 'code', 'task_seq_counter'])
      .where('id', '=', access.project.id)
      .forUpdate()
      .executeTakeFirstOrThrow();

    const nextSeq = Number(lockedProject.task_seq_counter) + 1;
    const taskKey = `${lockedProject.code}-${nextSeq}`;

    await trx
      .updateTable('projects')
      .set({ task_seq_counter: nextSeq })
      .where('id', '=', access.project.id)
      .execute();

    const lastTaskInCol = await trx
      .selectFrom('tasks')
      .select(['sort_rank'])
      .where('project_id', '=', access.project.id)
      .where('column_id', '=', Number(column.id))
      .where('deleted_at', 'is', null)
      .orderBy('sort_rank', 'desc')
      .executeTakeFirst();

    const nextRank = rankAfter(lastTaskInCol?.sort_rank ?? null);
    const isDone = column.status_category === 'DONE' || Number(column.is_done_column) === 1;

    const inserted = await trx
      .insertInto('tasks')
      .values({
        project_id: access.project.id,
        parent_task_id: input.parentTaskId ?? null,
        column_id: Number(column.id),
        sprint_id: input.sprintId ?? null,
        milestone_id: input.milestoneId ?? null,
        task_key: taskKey,
        title: input.title.trim(),
        description: input.description ?? null,
        task_type: input.taskType,
        priority: input.priority,
        status_category: column.status_category,
        reporter_employee_id: reporterEmployeeId,
        start_date: input.startDate ?? null,
        due_date: input.dueDate ?? null,
        baseline_start_date: input.startDate ?? null,
        baseline_due_date: input.dueDate ?? null,
        completed_at: isDone ? new Date() : null,
        estimated_hours: input.estimatedHours.toFixed(2),
        actual_hours: '0.00',
        story_points:
          input.storyPoints !== undefined && input.storyPoints !== null
            ? input.storyPoints.toFixed(2)
            : null,
        progress_percent: isDone ? 100 : 0,
        sort_rank: nextRank,
        is_blocked: column.status_category === 'BLOCKED' ? 1 : 0,
        blocked_reason: null,
        version: 1,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    const tid = Number(inserted.insertId);

    if (input.assigneeEmployeeIds && input.assigneeEmployeeIds.length > 0) {
      const uniqueIds = Array.from(new Set(input.assigneeEmployeeIds));
      await trx
        .insertInto('task_assignees')
        .values(
          uniqueIds.map((empId, idx) => ({
            task_id: tid,
            employee_id: empId,
            assignment_role: idx === 0 ? ('PRIMARY' as const) : ('COLLABORATOR' as const),
            assigned_by: auth.userId,
          })),
        )
        .execute();
    }

    const watcherSet = new Set<number>(input.watcherEmployeeIds ?? []);
    if (reporterEmployeeId) {
      watcherSet.add(reporterEmployeeId);
    }
    if (watcherSet.size > 0) {
      await trx
        .insertInto('task_watchers')
        .values(Array.from(watcherSet).map((empId) => ({ task_id: tid, employee_id: empId })))
        .execute();
    }

    if (input.labelIds && input.labelIds.length > 0) {
      const uniqueLabels = Array.from(new Set(input.labelIds));
      await trx
        .insertInto('task_label_links')
        .values(uniqueLabels.map((lid) => ({ task_id: tid, label_id: lid })))
        .execute();
    }

    return tid;
  });

  await Promise.all([
    recordTaskActivity({
      projectId: access.project.id,
      taskId: createdTaskId,
      actorUserId: auth.userId,
      actionType: 'CREATED',
      newValue: { title: input.title.trim(), priority: input.priority },
    }),
    recalculateProjectProgress(access.project.id),
    recordAuditLog({
      userId: auth.userId,
      moduleCode: 'projects',
      action: 'TASK_CREATE',
      entityType: 'tasks',
      entityId: String(createdTaskId),
      newValues: { projectId: access.project.id, title: input.title },
      ipAddress,
    }),
  ]);

  // Notify assignees
  if (input.assigneeEmployeeIds && input.assigneeEmployeeIds.length > 0) {
    const empUsers = await db
      .selectFrom('employees')
      .select(['id', 'user_id'])
      .where('id', 'in', input.assigneeEmployeeIds)
      .where('user_id', 'is not', null)
      .execute();

    for (const eu of empUsers) {
      if (eu.user_id && Number(eu.user_id) !== auth.userId) {
        await createNotification({
          userId: Number(eu.user_id),
          moduleCode: 'projects',
          type: 'TASK_ASSIGNED',
          title: `Công việc mới được giao trong [${access.project.code}]`,
          message: `${auth.fullName} đã giao công việc "${input.title.trim()}" cho bạn.`,
          linkUrl: `/projects/${access.project.code}?taskId=${createdTaskId}`,
        });
      }
    }
  }

  return getTaskDetail(auth, createdTaskId);
}

export async function updateTask(
  auth: AuthContext,
  taskId: number,
  input: UpdateTaskInput,
  ipAddress: string | null,
): Promise<TaskDetailView> {
  const db = getDb();
  const current = await db
    .selectFrom('tasks')
    .select([
      'id',
      'project_id',
      'parent_task_id',
      'column_id',
      'title',
      'priority',
      'status_category',
      'start_date',
      'due_date',
      'progress_percent',
      'version',
    ])
    .where('id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc cần cập nhật.', 404);
  }

  const access = await assertProjectAccess(auth, Number(current.project_id), 'CONTRIBUTE');

  if (input.expectedVersion !== undefined && input.expectedVersion !== Number(current.version)) {
    throw new AppError(
      'TASK_VERSION_CONFLICT',
      'Công việc vừa được người khác cập nhật. Vui lòng làm mới để lấy dữ liệu mới nhất.',
      409,
    );
  }

  const nextStart =
    input.startDate !== undefined ? input.startDate : toIsoDateOnly(current.start_date);
  const nextDue = input.dueDate !== undefined ? input.dueDate : toIsoDateOnly(current.due_date);
  if (nextStart && nextDue && nextDue < nextStart) {
    throw new AppError(
      'INVALID_DATE_RANGE',
      'Hạn chót (Due Date) phải lớn hơn hoặc bằng ngày bắt đầu.',
      400,
    );
  }

  if (input.parentTaskId !== undefined && input.parentTaskId !== null) {
    const projectTasks = await db
      .selectFrom('tasks')
      .select(['id', 'parent_task_id'])
      .where('project_id', '=', access.project.id)
      .where('deleted_at', 'is', null)
      .execute();

    const treeNodes = projectTasks.map((t) => ({
      id: Number(t.id),
      parentId: t.parent_task_id !== null ? Number(t.parent_task_id) : null,
    }));

    if (wouldCreateCycle(treeNodes, taskId, input.parentTaskId)) {
      throw new AppError(
        'TASK_CYCLE_DETECTED',
        'Không thể đặt công việc cha gây vòng lặp phân cấp.',
        400,
      );
    }

    const depth = computeTaskDepth(treeNodes, input.parentTaskId);
    if (depth > MAX_TASK_HIERARCHY_DEPTH) {
      throw new AppError(
        'MAX_TASK_DEPTH_EXCEEDED',
        `Cấu trúc công việc cha-con chỉ hỗ trợ tối đa ${MAX_TASK_HIERARCHY_DEPTH} cấp.`,
        400,
      );
    }
  }

  let nextStatusCategory: TaskStatusCategory = current.status_category;
  let nextCompletedAt: Date | null | undefined;
  let nextProgress = input.progressPercent;

  if (input.columnId !== undefined && input.columnId !== Number(current.column_id)) {
    const targetCol = await db
      .selectFrom('project_board_columns')
      .select(['id', 'status_category', 'is_done_column'])
      .where('id', '=', input.columnId)
      .where('project_id', '=', access.project.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!targetCol) {
      throw new AppError('COLUMN_NOT_FOUND', 'Cột trạng thái đích không thuộc dự án này.', 404);
    }
    nextStatusCategory = targetCol.status_category;
    const isDone = targetCol.status_category === 'DONE' || Number(targetCol.is_done_column) === 1;
    nextCompletedAt = isDone ? new Date() : null;
    if (isDone && nextProgress === undefined) {
      nextProgress = 100;
    }
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('tasks')
      .set({
        ...(input.parentTaskId !== undefined ? { parent_task_id: input.parentTaskId } : {}),
        ...(input.columnId !== undefined
          ? { column_id: input.columnId, status_category: nextStatusCategory }
          : {}),
        ...(input.sprintId !== undefined ? { sprint_id: input.sprintId } : {}),
        ...(input.milestoneId !== undefined ? { milestone_id: input.milestoneId } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.taskType !== undefined ? { task_type: input.taskType } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        ...(input.estimatedHours !== undefined
          ? { estimated_hours: input.estimatedHours.toFixed(2) }
          : {}),
        ...(input.storyPoints !== undefined
          ? { story_points: input.storyPoints !== null ? input.storyPoints.toFixed(2) : null }
          : {}),
        ...(nextProgress !== undefined ? { progress_percent: nextProgress } : {}),
        ...(nextCompletedAt !== undefined ? { completed_at: nextCompletedAt } : {}),
        ...(input.isBlocked !== undefined ? { is_blocked: input.isBlocked ? 1 : 0 } : {}),
        ...(input.blockedReason !== undefined ? { blocked_reason: input.blockedReason } : {}),
        version: Number(current.version) + 1,
        updated_by: auth.userId,
      })
      .where('id', '=', taskId)
      .execute();

    if (input.assigneeEmployeeIds !== undefined) {
      await trx.deleteFrom('task_assignees').where('task_id', '=', taskId).execute();
      const uniqueIds = Array.from(new Set(input.assigneeEmployeeIds));
      if (uniqueIds.length > 0) {
        await trx
          .insertInto('task_assignees')
          .values(
            uniqueIds.map((empId, idx) => ({
              task_id: taskId,
              employee_id: empId,
              assignment_role: idx === 0 ? ('PRIMARY' as const) : ('COLLABORATOR' as const),
              assigned_by: auth.userId,
            })),
          )
          .execute();
      }
    }

    if (input.watcherEmployeeIds !== undefined) {
      await trx.deleteFrom('task_watchers').where('task_id', '=', taskId).execute();
      const uniqueWatchers = Array.from(new Set(input.watcherEmployeeIds));
      if (uniqueWatchers.length > 0) {
        await trx
          .insertInto('task_watchers')
          .values(uniqueWatchers.map((empId) => ({ task_id: taskId, employee_id: empId })))
          .execute();
      }
    }

    if (input.labelIds !== undefined) {
      await trx.deleteFrom('task_label_links').where('task_id', '=', taskId).execute();
      const uniqueLabels = Array.from(new Set(input.labelIds));
      if (uniqueLabels.length > 0) {
        await trx
          .insertInto('task_label_links')
          .values(uniqueLabels.map((lid) => ({ task_id: taskId, label_id: lid })))
          .execute();
      }
    }
  });

  if (input.columnId !== undefined && input.columnId !== Number(current.column_id)) {
    await recordTaskActivity({
      projectId: access.project.id,
      taskId,
      actorUserId: auth.userId,
      actionType: 'STATUS_CHANGED',
      fieldName: 'column_id',
      oldValue: { columnId: Number(current.column_id), statusCategory: current.status_category },
      newValue: { columnId: input.columnId, statusCategory: nextStatusCategory },
    });
  } else if (input.priority !== undefined && input.priority !== current.priority) {
    await recordTaskActivity({
      projectId: access.project.id,
      taskId,
      actorUserId: auth.userId,
      actionType: 'PRIORITY_CHANGED',
      fieldName: 'priority',
      oldValue: { priority: current.priority },
      newValue: { priority: input.priority },
    });
  } else if (input.dueDate !== undefined && input.dueDate !== toIsoDateOnly(current.due_date)) {
    await recordTaskActivity({
      projectId: access.project.id,
      taskId,
      actorUserId: auth.userId,
      actionType: 'DUE_DATE_CHANGED',
      fieldName: 'due_date',
      oldValue: { dueDate: toIsoDateOnly(current.due_date) },
      newValue: { dueDate: input.dueDate },
    });
  } else {
    await recordTaskActivity({
      projectId: access.project.id,
      taskId,
      actorUserId: auth.userId,
      actionType: 'UPDATED',
      newValue: { fields: Object.keys(input) },
    });
  }

  await recalculateProjectProgress(access.project.id);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'TASK_UPDATE',
    entityType: 'tasks',
    entityId: String(taskId),
    newValues: { fields: Object.keys(input) },
    ipAddress,
  });

  return getTaskDetail(auth, taskId);
}

export async function moveTask(
  auth: AuthContext,
  taskId: number,
  input: MoveTaskInput,
): Promise<{ task: TaskDetailView; wipLimitExceeded: boolean; wipLimit: number | null }> {
  const db = getDb();
  const current = await db
    .selectFrom('tasks')
    .select(['id', 'project_id', 'column_id', 'status_category', 'sort_rank', 'version'])
    .where('id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc cần di chuyển.', 404);
  }

  const access = await assertProjectAccess(auth, Number(current.project_id), 'CONTRIBUTE');

  if (input.expectedVersion !== undefined && input.expectedVersion !== Number(current.version)) {
    throw new AppError(
      'TASK_VERSION_CONFLICT',
      'Vị trí công việc vừa thay đổi bởi thành viên khác. Đang đồng bộ lại bảng.',
      409,
    );
  }

  const targetCol = await db
    .selectFrom('project_board_columns')
    .select(['id', 'name', 'status_category', 'is_done_column', 'wip_limit'])
    .where('id', '=', input.targetColumnId)
    .where('project_id', '=', access.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!targetCol) {
    throw new AppError('COLUMN_NOT_FOUND', 'Cột đích không hợp lệ.', 404);
  }

  let newRank: string;
  try {
    newRank = rankBetween(input.prevRank ?? null, input.nextRank ?? null);
  } catch {
    const lastInCol = await db
      .selectFrom('tasks')
      .select(['sort_rank'])
      .where('project_id', '=', access.project.id)
      .where('column_id', '=', input.targetColumnId)
      .where('deleted_at', 'is', null)
      .where('id', '!=', taskId)
      .orderBy('sort_rank', 'desc')
      .executeTakeFirst();
    newRank = rankAfter(lastInCol?.sort_rank ?? null);
  }

  const isDone = targetCol.status_category === 'DONE' || Number(targetCol.is_done_column) === 1;

  await db
    .updateTable('tasks')
    .set({
      column_id: input.targetColumnId,
      status_category: targetCol.status_category,
      sort_rank: newRank,
      completed_at: isDone ? new Date() : null,
      progress_percent: isDone ? 100 : undefined,
      is_blocked: targetCol.status_category === 'BLOCKED' ? 1 : 0,
      ...(input.sprintId !== undefined ? { sprint_id: input.sprintId } : {}),
      version: Number(current.version) + 1,
      updated_by: auth.userId,
    })
    .where('id', '=', taskId)
    .execute();

  const colCountRow = await db
    .selectFrom('tasks')
    .select(sql<number>`COUNT(*)`.as('cnt'))
    .where('column_id', '=', input.targetColumnId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const wipLimit = targetCol.wip_limit !== null ? Number(targetCol.wip_limit) : null;
  const wipLimitExceeded = wipLimit !== null && Number(colCountRow?.cnt ?? 0) > wipLimit;

  if (Number(current.column_id) !== input.targetColumnId) {
    await recordTaskActivity({
      projectId: access.project.id,
      taskId,
      actorUserId: auth.userId,
      actionType: 'STATUS_CHANGED',
      fieldName: 'column_id',
      oldValue: { columnId: Number(current.column_id) },
      newValue: { columnId: input.targetColumnId, columnName: targetCol.name },
    });
    await recalculateProjectProgress(access.project.id);

    try {
      const { executeProjectAutomations } = await import(
        '@/modules/projects/templates-automation.service'
      );
      await executeProjectAutomations({
        projectId: access.project.id,
        taskId,
        triggerEvent: 'TASK_MOVED_COLUMN',
        statusCategory: targetCol.status_category,
      });

      if (isDone) {
        const movedRow = await db
          .selectFrom('tasks')
          .select(['parent_task_id'])
          .where('id', '=', taskId)
          .executeTakeFirst();
        if (movedRow?.parent_task_id) {
          const openSiblings = await db
            .selectFrom('tasks')
            .select(['id'])
            .where('parent_task_id', '=', Number(movedRow.parent_task_id))
            .where('status_category', '<>', 'DONE')
            .where('deleted_at', 'is', null)
            .executeTakeFirst();
          if (!openSiblings) {
            await executeProjectAutomations({
              projectId: access.project.id,
              taskId: Number(movedRow.parent_task_id),
              triggerEvent: 'ALL_SUBTASKS_DONE',
            });
          }
        }
      }
    } catch {
      // Automation errors never block task movement
    }
  }

  const task = await getTaskDetail(auth, taskId);
  return { task, wipLimitExceeded, wipLimit };
}

export async function archiveTask(
  auth: AuthContext,
  taskId: number,
  ipAddress: string | null,
): Promise<{ id: number; archived: true }> {
  const db = getDb();
  const current = await db
    .selectFrom('tasks')
    .select(['id', 'project_id', 'task_key', 'title', 'reporter_employee_id'])
    .where('id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  const access = await assertProjectAccess(auth, Number(current.project_id), 'CONTRIBUTE');
  const isReporter = access.employeeId !== null && access.employeeId === Number(current.reporter_employee_id);
  if (!access.canEditProject && !isReporter) {
    throw new AppError(
      'TASK_ARCHIVE_DENIED',
      'Chỉ Quản lý dự án hoặc người tạo công việc mới được phép lưu trữ công việc này.',
      403,
    );
  }

  await db
    .updateTable('tasks')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', taskId)
    .execute();

  await Promise.all([
    recordTaskActivity({
      projectId: access.project.id,
      taskId,
      actorUserId: auth.userId,
      actionType: 'ARCHIVED',
      oldValue: { taskKey: current.task_key, title: current.title },
    }),
    recalculateProjectProgress(access.project.id),
    recordAuditLog({
      userId: auth.userId,
      moduleCode: 'projects',
      action: 'TASK_ARCHIVE',
      entityType: 'tasks',
      entityId: String(taskId),
      oldValues: { taskKey: current.task_key, title: current.title },
      ipAddress,
    }),
  ]);

  return { id: taskId, archived: true };
}

export async function addChecklistItem(
  auth: AuthContext,
  taskId: number,
  input: CreateChecklistInput,
): Promise<TaskChecklistItemView[]> {
  const db = getDb();
  const task = await db
    .selectFrom('tasks')
    .select(['id', 'project_id'])
    .where('id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  await assertProjectAccess(auth, Number(task.project_id), 'CONTRIBUTE');

  const maxSort = await db
    .selectFrom('task_checklists')
    .select(sql<number>`COALESCE(MAX(sort_order), -1)`.as('max_sort'))
    .where('task_id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  await db
    .insertInto('task_checklists')
    .values({
      task_id: taskId,
      title: input.title.trim(),
      is_completed: 0,
      assignee_employee_id: input.assigneeEmployeeId ?? null,
      due_date: input.dueDate ?? null,
      sort_order: Number(maxSort?.max_sort ?? -1) + 1,
      completed_at: null,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .execute();

  const detail = await getTaskDetail(auth, taskId);
  return detail.checklists;
}

export async function updateChecklistItem(
  auth: AuthContext,
  taskId: number,
  checklistId: number,
  input: UpdateChecklistInput,
): Promise<TaskChecklistItemView[]> {
  const db = getDb();
  const item = await db
    .selectFrom('task_checklists')
    .innerJoin('tasks', 'tasks.id', 'task_checklists.task_id')
    .select(['task_checklists.id', 'tasks.project_id'])
    .where('task_checklists.id', '=', checklistId)
    .where('task_checklists.task_id', '=', taskId)
    .where('task_checklists.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!item) {
    throw new AppError('CHECKLIST_NOT_FOUND', 'Không tìm thấy mục checklist.', 404);
  }

  await assertProjectAccess(auth, Number(item.project_id), 'CONTRIBUTE');

  await db
    .updateTable('task_checklists')
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.isCompleted !== undefined
        ? { is_completed: input.isCompleted ? 1 : 0, completed_at: input.isCompleted ? new Date() : null }
        : {}),
      ...(input.assigneeEmployeeId !== undefined
        ? { assignee_employee_id: input.assigneeEmployeeId }
        : {}),
      ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
      ...(input.archive ? { deleted_at: new Date() } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', checklistId)
    .execute();

  const detail = await getTaskDetail(auth, taskId);
  return detail.checklists;
}

export async function addTaskDependency(
  auth: AuthContext,
  successorTaskId: number,
  input: CreateDependencyInput,
): Promise<{ predecessors: TaskDependencyView[]; successors: TaskDependencyView[] }> {
  const db = getDb();
  const [successor, predecessor] = await Promise.all([
    db
      .selectFrom('tasks')
      .select(['id', 'project_id', 'task_key'])
      .where('id', '=', successorTaskId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('tasks')
      .select(['id', 'project_id', 'task_key'])
      .where('id', '=', input.predecessorTaskId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
  ]);

  if (!successor || !predecessor) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc nguồn hoặc đích.', 404);
  }
  if (Number(successor.project_id) !== Number(predecessor.project_id)) {
    throw new AppError(
      'CROSS_PROJECT_DEPENDENCY',
      'Chỉ hỗ trợ tạo phụ thuộc giữa các công việc trong cùng 1 dự án.',
      400,
    );
  }

  const projectId = Number(successor.project_id);
  await assertProjectAccess(auth, projectId, 'CONTRIBUTE');

  const existingDeps = await db
    .selectFrom('task_dependencies')
    .select(['predecessor_task_id', 'successor_task_id'])
    .where('project_id', '=', projectId)
    .execute();

  const alreadyExists = existingDeps.some(
    (d) =>
      Number(d.predecessor_task_id) === input.predecessorTaskId &&
      Number(d.successor_task_id) === successorTaskId,
  );
  if (alreadyExists) {
    throw new AppError('DEPENDENCY_EXISTS', 'Liên kết phụ thuộc này đã tồn tại.', 409);
  }

  if (
    wouldCreateDependencyCycle(
      existingDeps.map((d) => ({
        predecessorTaskId: Number(d.predecessor_task_id),
        successorTaskId: Number(d.successor_task_id),
      })),
      input.predecessorTaskId,
      successorTaskId,
    )
  ) {
    throw new AppError(
      'DEPENDENCY_CYCLE_DETECTED',
      'Không thể thêm phụ thuộc này vì sẽ tạo vòng lặp vô hạn (Cycle) giữa các công việc.',
      409,
    );
  }

  await db
    .insertInto('task_dependencies')
    .values({
      project_id: projectId,
      predecessor_task_id: input.predecessorTaskId,
      successor_task_id: successorTaskId,
      dependency_type: input.dependencyType,
      lag_days: input.lagDays,
      created_by: auth.userId,
    })
    .execute();

  await recordTaskActivity({
    projectId,
    taskId: successorTaskId,
    actorUserId: auth.userId,
    actionType: 'DEPENDENCY_ADDED',
    newValue: {
      predecessorTaskKey: predecessor.task_key,
      dependencyType: input.dependencyType,
      lagDays: input.lagDays,
    },
  });

  const detail = await getTaskDetail(auth, successorTaskId);
  return { predecessors: detail.predecessors, successors: detail.successors };
}

export async function removeTaskDependency(
  auth: AuthContext,
  taskId: number,
  dependencyId: number,
): Promise<{ predecessors: TaskDependencyView[]; successors: TaskDependencyView[] }> {
  const db = getDb();
  const dep = await db
    .selectFrom('task_dependencies')
    .select(['id', 'project_id', 'predecessor_task_id', 'successor_task_id'])
    .where('id', '=', dependencyId)
    .executeTakeFirst();

  if (
    !dep ||
    (Number(dep.predecessor_task_id) !== taskId && Number(dep.successor_task_id) !== taskId)
  ) {
    throw new AppError('DEPENDENCY_NOT_FOUND', 'Không tìm thấy liên kết phụ thuộc.', 404);
  }

  await assertProjectAccess(auth, Number(dep.project_id), 'CONTRIBUTE');
  await db.deleteFrom('task_dependencies').where('id', '=', dependencyId).execute();

  const detail = await getTaskDetail(auth, taskId);
  return { predecessors: detail.predecessors, successors: detail.successors };
}
