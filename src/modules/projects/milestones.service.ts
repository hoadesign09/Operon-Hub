import { getDb, type MilestoneStatus, type TaskDependencyType, type TaskPriority, type TaskStatusCategory } from '@/config/database';
import {
  autoShiftDependents,
  computeCriticalPath,
  type CriticalPathResult,
} from '@/lib/portable/gantt-scheduler';
import { createApprovalRequest } from '@/modules/approvals/approvals.service';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { assertProjectAccess } from '@/modules/projects/projects.access';
import {
  PROJECT_MILESTONE_ENTITY_TYPE,
  PROJECT_MILESTONE_REQUEST_TYPE,
} from '@/modules/projects/projects.constants';
import type {
  CreateMilestoneInput,
  RescheduleGanttTaskInput,
  UpdateMilestoneInput,
} from '@/modules/projects/projects-advanced.schema';
import { AppError } from '@/shared/api-response';

export interface ProjectMilestoneView {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  dueDate: string;
  completedAt: string | null;
  status: MilestoneStatus;
  requiresSignoff: boolean;
  approvalRequestId: number | null;
  ownerEmployeeId: number | null;
  ownerName: string | null;
  sortOrder: number;
  taskCount: number;
  completedTaskCount: number;
  progressPercent: number;
}

export interface GanttTaskView {
  id: number;
  taskKey: string;
  title: string;
  parentTaskId: number | null;
  milestoneId: number | null;
  priority: TaskPriority;
  statusCategory: TaskStatusCategory;
  progressPercent: number;
  startDate: string | null;
  dueDate: string | null;
  baselineStartDate: string | null;
  baselineDueDate: string | null;
  isCritical: boolean;
  slackDays: number;
  assigneeNames: string[];
}

export interface GanttDependencyItemView {
  id: number;
  predecessorTaskId: number;
  successorTaskId: number;
  dependencyType: TaskDependencyType;
  lagDays: number;
}

export interface ProjectGanttPayload {
  projectId: number;
  projectCode: string;
  projectStartDate: string | null;
  projectTargetEndDate: string | null;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  tasks: GanttTaskView[];
  milestones: ProjectMilestoneView[];
  dependencies: GanttDependencyItemView[];
  criticalPath: CriticalPathResult;
}

function toIsoDate(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
}

function toIsoDateTime(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : String(val);
}

export async function listProjectMilestones(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<ProjectMilestoneView[]> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const db = getDb();

  const [rows, tasks] = await Promise.all([
    db
      .selectFrom('project_milestones as m')
      .leftJoin('employees as e', 'e.id', 'm.owner_employee_id')
      .select([
        'm.id',
        'm.project_id',
        'm.name',
        'm.description',
        'm.due_date',
        'm.completed_at',
        'm.status',
        'm.requires_signoff',
        'm.approval_request_id',
        'm.owner_employee_id',
        'm.sort_order',
        'e.full_name as owner_name',
      ])
      .where('m.project_id', '=', ctx.project.id)
      .where('m.deleted_at', 'is', null)
      .orderBy('m.due_date', 'asc')
      .orderBy('m.sort_order', 'asc')
      .execute(),
    db
      .selectFrom('tasks')
      .select(['milestone_id', 'status_category'])
      .where('project_id', '=', ctx.project.id)
      .where('milestone_id', 'is not', null)
      .where('deleted_at', 'is', null)
      .execute(),
  ]);

  const counts = new Map<number, { total: number; done: number }>();
  for (const t of tasks) {
    const mid = Number(t.milestone_id);
    const entry = counts.get(mid) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (t.status_category === 'DONE') {
      entry.done += 1;
    }
    counts.set(mid, entry);
  }

  return rows.map((r) => {
    const mid = Number(r.id);
    const stat = counts.get(mid) ?? { total: 0, done: 0 };
    const progressPercent =
      r.status === 'COMPLETED'
        ? 100
        : stat.total > 0
          ? Math.round((stat.done / stat.total) * 100)
          : 0;
    return {
      id: mid,
      projectId: Number(r.project_id),
      name: r.name,
      description: r.description,
      dueDate: toIsoDate(r.due_date) ?? '',
      completedAt: toIsoDateTime(r.completed_at),
      status: r.status,
      requiresSignoff: Number(r.requires_signoff) === 1,
      approvalRequestId: r.approval_request_id ? Number(r.approval_request_id) : null,
      ownerEmployeeId: r.owner_employee_id ? Number(r.owner_employee_id) : null,
      ownerName: r.owner_name ?? null,
      sortOrder: Number(r.sort_order),
      taskCount: stat.total,
      completedTaskCount: stat.done,
      progressPercent,
    };
  });
}

export async function createProjectMilestone(
  auth: AuthContext,
  projectIdOrCode: string | number,
  input: CreateMilestoneInput,
): Promise<ProjectMilestoneView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  const res = await db
    .insertInto('project_milestones')
    .values({
      project_id: ctx.project.id,
      name: input.name,
      description: input.description ?? null,
      due_date: input.dueDate,
      completed_at: null,
      status: 'UPCOMING',
      requires_signoff: input.requiresSignoff ? 1 : 0,
      approval_request_id: null,
      owner_employee_id: input.ownerEmployeeId ?? ctx.employeeId,
      sort_order: input.sortOrder ?? 0,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .executeTakeFirstOrThrow();

  const mid = Number(res.insertId);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'CREATE_MILESTONE',
    entityType: 'project_milestones',
    entityId: String(mid),
    newValues: { projectId: ctx.project.id, name: input.name, dueDate: input.dueDate },
  });

  const list = await listProjectMilestones(auth, ctx.project.id);
  return list.find((m) => m.id === mid)!;
}

export async function updateProjectMilestone(
  auth: AuthContext,
  projectIdOrCode: string | number,
  milestoneId: number,
  input: UpdateMilestoneInput,
): Promise<ProjectMilestoneView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  const existing = await db
    .selectFrom('project_milestones')
    .selectAll()
    .where('id', '=', milestoneId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('MILESTONE_NOT_FOUND', 'Không tìm thấy cột mốc dự án.', 404);
  }

  const nextCompletedAt =
    input.status === 'COMPLETED'
      ? new Date()
      : input.status !== undefined
        ? null
        : existing.completed_at;

  await db
    .updateTable('project_milestones')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
      ...(input.status !== undefined ? { status: input.status, completed_at: nextCompletedAt } : {}),
      ...(input.requiresSignoff !== undefined
        ? { requires_signoff: input.requiresSignoff ? 1 : 0 }
        : {}),
      ...(input.ownerEmployeeId !== undefined ? { owner_employee_id: input.ownerEmployeeId } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', milestoneId)
    .execute();

  const list = await listProjectMilestones(auth, ctx.project.id);
  return list.find((m) => m.id === milestoneId)!;
}

export async function requestMilestoneSignoff(
  auth: AuthContext,
  projectIdOrCode: string | number,
  milestoneId: number,
): Promise<ProjectMilestoneView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  const milestone = await db
    .selectFrom('project_milestones')
    .selectAll()
    .where('id', '=', milestoneId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!milestone) {
    throw new AppError('MILESTONE_NOT_FOUND', 'Không tìm thấy cột mốc dự án.', 404);
  }
  if (milestone.status === 'PENDING_SIGNOFF' || milestone.status === 'COMPLETED') {
    throw new AppError(
      'MILESTONE_ALREADY_SUBMITTED',
      'Cột mốc đã gửi nghiệm thu hoặc đã hoàn thành.',
      409,
    );
  }

  const approval = await createApprovalRequest({
    moduleCode: 'projects',
    requestType: PROJECT_MILESTONE_REQUEST_TYPE,
    entityType: PROJECT_MILESTONE_ENTITY_TYPE,
    entityId: milestoneId,
    branchId: ctx.project.branchId,
    requesterId: auth.userId,
    title: `Nghiệm thu mốc [${ctx.project.code}]: ${milestone.name}`,
    summary: `Đề nghị phê duyệt nghiệm thu cột mốc dự án ${ctx.project.name} (hạn ${toIsoDate(milestone.due_date)}).`,
  });

  await db
    .updateTable('project_milestones')
    .set({
      status: 'PENDING_SIGNOFF',
      requires_signoff: 1,
      approval_request_id: approval.approvalRequestId,
      updated_by: auth.userId,
    })
    .where('id', '=', milestoneId)
    .execute();

  const list = await listProjectMilestones(auth, ctx.project.id);
  return list.find((m) => m.id === milestoneId)!;
}

export async function captureProjectBaseline(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<{ capturedTasksCount: number; capturedAt: string }> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  const db = getDb();

  const capturedTasksCount = await db.transaction().execute(async (trx) => {
    const project = await trx
      .selectFrom('projects')
      .select(['start_date', 'target_end_date'])
      .where('id', '=', ctx.project.id)
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('projects')
      .set({
        baseline_start_date: project.start_date,
        baseline_end_date: project.target_end_date,
        updated_by: auth.userId,
      })
      .where('id', '=', ctx.project.id)
      .execute();

    const tasks = await trx
      .selectFrom('tasks')
      .select(['id', 'start_date', 'due_date'])
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .execute();

    for (const t of tasks) {
      await trx
        .updateTable('tasks')
        .set({
          baseline_start_date: t.start_date ?? t.due_date,
          baseline_due_date: t.due_date ?? t.start_date,
          updated_by: auth.userId,
        })
        .where('id', '=', Number(t.id))
        .execute();
    }

    return tasks.length;
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'CAPTURE_BASELINE',
    entityType: 'projects',
    entityId: String(ctx.project.id),
    newValues: { capturedTasksCount },
  });

  return {
    capturedTasksCount,
    capturedAt: new Date().toISOString(),
  };
}

export async function getProjectGanttData(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<ProjectGanttPayload> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const db = getDb();

  const [projectRow, taskRows, assigneeRows, depRows, milestones] = await Promise.all([
    db
      .selectFrom('projects')
      .select([
        'id',
        'code',
        'start_date',
        'target_end_date',
        'baseline_start_date',
        'baseline_end_date',
      ])
      .where('id', '=', ctx.project.id)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('tasks')
      .select([
        'id',
        'task_key',
        'title',
        'parent_task_id',
        'milestone_id',
        'priority',
        'status_category',
        'progress_percent',
        'start_date',
        'due_date',
        'baseline_start_date',
        'baseline_due_date',
      ])
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .orderBy('start_date', 'asc')
      .orderBy('id', 'asc')
      .execute(),
    db
      .selectFrom('task_assignees as ta')
      .innerJoin('employees as e', 'e.id', 'ta.employee_id')
      .innerJoin('tasks as t', 't.id', 'ta.task_id')
      .select(['ta.task_id', 'e.full_name'])
      .where('t.project_id', '=', ctx.project.id)
      .where('t.deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('task_dependencies')
      .select(['id', 'predecessor_task_id', 'successor_task_id', 'dependency_type', 'lag_days'])
      .where('project_id', '=', ctx.project.id)
      .execute(),
    listProjectMilestones(auth, ctx.project.id),
  ]);

  const assigneesMap = new Map<number, string[]>();
  for (const row of assigneeRows) {
    const tid = Number(row.task_id);
    const list = assigneesMap.get(tid) ?? [];
    list.push(row.full_name);
    assigneesMap.set(tid, list);
  }

  const ganttNodes = taskRows.map((t) => ({
    id: Number(t.id),
    startDate: toIsoDate(t.start_date) ?? toIsoDate(t.due_date),
    dueDate: toIsoDate(t.due_date) ?? toIsoDate(t.start_date),
  }));

  const ganttEdges = depRows.map((d) => ({
    predecessorId: Number(d.predecessor_task_id),
    successorId: Number(d.successor_task_id),
    type: d.dependency_type,
    lagDays: Number(d.lag_days),
  }));

  const criticalPath = computeCriticalPath(ganttNodes, ganttEdges);

  const tasks: GanttTaskView[] = taskRows.map((t) => {
    const tid = Number(t.id);
    const cpmNode = criticalPath.nodes[tid];
    return {
      id: tid,
      taskKey: t.task_key,
      title: t.title,
      parentTaskId: t.parent_task_id ? Number(t.parent_task_id) : null,
      milestoneId: t.milestone_id ? Number(t.milestone_id) : null,
      priority: t.priority,
      statusCategory: t.status_category,
      progressPercent: Number(t.progress_percent),
      startDate: toIsoDate(t.start_date),
      dueDate: toIsoDate(t.due_date),
      baselineStartDate: toIsoDate(t.baseline_start_date),
      baselineDueDate: toIsoDate(t.baseline_due_date),
      isCritical: cpmNode?.isCritical ?? false,
      slackDays: cpmNode?.slackDays ?? 0,
      assigneeNames: assigneesMap.get(tid) ?? [],
    };
  });

  return {
    projectId: Number(projectRow.id),
    projectCode: projectRow.code,
    projectStartDate: toIsoDate(projectRow.start_date),
    projectTargetEndDate: toIsoDate(projectRow.target_end_date),
    baselineStartDate: toIsoDate(projectRow.baseline_start_date),
    baselineEndDate: toIsoDate(projectRow.baseline_end_date),
    tasks,
    milestones,
    dependencies: depRows.map((d) => ({
      id: Number(d.id),
      predecessorTaskId: Number(d.predecessor_task_id),
      successorTaskId: Number(d.successor_task_id),
      dependencyType: d.dependency_type,
      lagDays: Number(d.lag_days),
    })),
    criticalPath,
  };
}

export async function rescheduleGanttTask(
  auth: AuthContext,
  projectIdOrCode: string | number,
  input: RescheduleGanttTaskInput,
): Promise<{ shiftedCount: number; gantt: ProjectGanttPayload }> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  if (input.dueDate < input.startDate) {
    throw new AppError('INVALID_DATE_RANGE', 'Ngày hạn chót phải bằng hoặc sau ngày bắt đầu.', 400);
  }

  const db = getDb();
  let shiftedCount = 0;

  await db.transaction().execute(async (trx) => {
    const task = await trx
      .selectFrom('tasks')
      .select(['id'])
      .where('id', '=', input.taskId)
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!task) {
      throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc trong dự án.', 404);
    }

    await trx
      .updateTable('tasks')
      .set({
        start_date: input.startDate,
        due_date: input.dueDate,
        updated_by: auth.userId,
      })
      .where('id', '=', input.taskId)
      .execute();

    if (input.autoShift) {
      const [allTasks, allDeps] = await Promise.all([
        trx
          .selectFrom('tasks')
          .select(['id', 'start_date', 'due_date'])
          .where('project_id', '=', ctx.project.id)
          .where('deleted_at', 'is', null)
          .execute(),
        trx
          .selectFrom('task_dependencies')
          .select(['predecessor_task_id', 'successor_task_id', 'dependency_type', 'lag_days'])
          .where('project_id', '=', ctx.project.id)
          .execute(),
      ]);

      const shifts = autoShiftDependents(
        allTasks.map((t) => ({
          id: Number(t.id),
          startDate: toIsoDate(t.start_date),
          dueDate: toIsoDate(t.due_date),
        })),
        allDeps.map((d) => ({
          predecessorId: Number(d.predecessor_task_id),
          successorId: Number(d.successor_task_id),
          type: d.dependency_type,
          lagDays: Number(d.lag_days),
        })),
        input.taskId,
        input.startDate,
        input.dueDate,
      );

      shiftedCount = shifts.length;
      for (const s of shifts) {
        await trx
          .updateTable('tasks')
          .set({
            start_date: s.startDate,
            due_date: s.dueDate,
            updated_by: auth.userId,
          })
          .where('id', '=', s.taskId)
          .execute();
      }
    }
  });

  const gantt = await getProjectGanttData(auth, ctx.project.id);
  return { shiftedCount, gantt };
}
