import { getDb, type SprintStatus } from '@/config/database';
import {
  computeBurndownSeries,
  computeVelocitySeries,
  type BurndownPoint,
  type VelocitySeriesResult,
} from '@/lib/portable/agile-metrics';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { recordTaskActivity } from '@/modules/projects/collaboration.service';
import { assertProjectAccess } from '@/modules/projects/projects.access';
import type {
  CompleteSprintInput,
  CreateSprintInput,
  StartSprintInput,
  UpdateSprintInput,
} from '@/modules/projects/projects-advanced.schema';
import { AppError } from '@/shared/api-response';

export interface ProjectSprintView {
  id: number;
  projectId: number;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  committedPoints: number;
  completedPoints: number;
  completedAt: string | null;
  taskCount: number;
  completedTaskCount: number;
  totalPoints: number;
  donePoints: number;
}

export interface SprintAnalyticsView {
  sprint: ProjectSprintView;
  burndown: BurndownPoint[];
  velocity: VelocitySeriesResult;
}

function toIsoDate(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
}

function toIsoDateTime(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : String(val);
}

export async function listProjectSprints(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<ProjectSprintView[]> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const db = getDb();

  const [sprints, tasks] = await Promise.all([
    db
      .selectFrom('project_sprints')
      .selectAll()
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .orderBy('id', 'desc')
      .execute(),
    db
      .selectFrom('tasks')
      .select(['id', 'sprint_id', 'status_category', 'story_points', 'estimated_hours'])
      .where('project_id', '=', ctx.project.id)
      .where('sprint_id', 'is not', null)
      .where('deleted_at', 'is', null)
      .execute(),
  ]);

  const bySprint = new Map<
    number,
    { total: number; done: number; totalPts: number; donePts: number }
  >();
  for (const t of tasks) {
    const sid = Number(t.sprint_id);
    const stats = bySprint.get(sid) ?? { total: 0, done: 0, totalPts: 0, donePts: 0 };
    const pts = t.story_points !== null ? Number(t.story_points) : Number(t.estimated_hours) || 1;
    stats.total += 1;
    stats.totalPts += pts;
    if (t.status_category === 'DONE') {
      stats.done += 1;
      stats.donePts += pts;
    }
    bySprint.set(sid, stats);
  }

  return sprints.map((s) => {
    const sid = Number(s.id);
    const stats = bySprint.get(sid) ?? { total: 0, done: 0, totalPts: 0, donePts: 0 };
    return {
      id: sid,
      projectId: Number(s.project_id),
      name: s.name,
      goal: s.goal,
      startDate: toIsoDate(s.start_date),
      endDate: toIsoDate(s.end_date),
      status: s.status,
      committedPoints: Number(s.committed_points),
      completedPoints: Number(s.completed_points),
      completedAt: toIsoDateTime(s.completed_at),
      taskCount: stats.total,
      completedTaskCount: stats.done,
      totalPoints: Math.round(stats.totalPts * 100) / 100,
      donePoints: Math.round(stats.donePts * 100) / 100,
    };
  });
}

export async function createProjectSprint(
  auth: AuthContext,
  projectIdOrCode: string | number,
  input: CreateSprintInput,
): Promise<ProjectSprintView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new AppError('INVALID_DATE_RANGE', 'Ngày kết thúc Sprint phải sau ngày bắt đầu.', 400);
  }

  const db = getDb();
  const res = await db
    .insertInto('project_sprints')
    .values({
      project_id: ctx.project.id,
      name: input.name,
      goal: input.goal ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      status: 'PLANNED',
      committed_points: 0,
      completed_points: 0,
      completed_at: null,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .executeTakeFirstOrThrow();

  const sprintId = Number(res.insertId);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'CREATE_SPRINT',
    entityType: 'project_sprints',
    entityId: String(sprintId),
    newValues: { projectId: ctx.project.id, name: input.name },
  });

  const list = await listProjectSprints(auth, ctx.project.id);
  const created = list.find((s) => s.id === sprintId);
  if (!created) {
    throw new AppError('SPRINT_NOT_FOUND', 'Không tìm thấy Sprint vừa tạo.', 500);
  }
  return created;
}

export async function updateProjectSprint(
  auth: AuthContext,
  projectIdOrCode: string | number,
  sprintId: number,
  input: UpdateSprintInput,
): Promise<ProjectSprintView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  const existing = await db
    .selectFrom('project_sprints')
    .selectAll()
    .where('id', '=', sprintId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('SPRINT_NOT_FOUND', 'Không tìm thấy Sprint trong dự án.', 404);
  }

  const nextStart = input.startDate !== undefined ? input.startDate : toIsoDate(existing.start_date);
  const nextEnd = input.endDate !== undefined ? input.endDate : toIsoDate(existing.end_date);
  if (nextStart && nextEnd && nextEnd < nextStart) {
    throw new AppError('INVALID_DATE_RANGE', 'Ngày kết thúc Sprint phải sau ngày bắt đầu.', 400);
  }

  await db
    .updateTable('project_sprints')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
      ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
      ...(input.endDate !== undefined ? { end_date: input.endDate } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', sprintId)
    .execute();

  const list = await listProjectSprints(auth, ctx.project.id);
  const updated = list.find((s) => s.id === sprintId);
  if (!updated) {
    throw new AppError('SPRINT_NOT_FOUND', 'Không tìm thấy Sprint sau cập nhật.', 404);
  }
  return updated;
}

export async function startProjectSprint(
  auth: AuthContext,
  projectIdOrCode: string | number,
  sprintId: number,
  input: StartSprintInput,
): Promise<ProjectSprintView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  await db.transaction().execute(async (trx) => {
    const sprint = await trx
      .selectFrom('project_sprints')
      .selectAll()
      .where('id', '=', sprintId)
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!sprint) {
      throw new AppError('SPRINT_NOT_FOUND', 'Không tìm thấy Sprint.', 404);
    }
    if (sprint.status !== 'PLANNED') {
      throw new AppError(
        'SPRINT_INVALID_STATE',
        'Chỉ có thể bắt đầu Sprint đang ở trạng thái Dự kiến (PLANNED).',
        409,
      );
    }

    const activeOther = await trx
      .selectFrom('project_sprints')
      .select(['id', 'name'])
      .where('project_id', '=', ctx.project.id)
      .where('status', '=', 'ACTIVE')
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (activeOther) {
      throw new AppError(
        'ACTIVE_SPRINT_EXISTS',
        `Dự án đang có Sprint hoạt động (${activeOther.name}). Vui lòng chốt Sprint hiện tại trước.`,
        409,
      );
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultEnd = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);
    const startDate = input.startDate ?? toIsoDate(sprint.start_date) ?? todayIso;
    const endDate = input.endDate ?? toIsoDate(sprint.end_date) ?? defaultEnd;
    if (endDate < startDate) {
      throw new AppError('INVALID_DATE_RANGE', 'Ngày kết thúc Sprint phải sau ngày bắt đầu.', 400);
    }

    const sprintTasks = await trx
      .selectFrom('tasks')
      .select(['story_points', 'estimated_hours'])
      .where('project_id', '=', ctx.project.id)
      .where('sprint_id', '=', sprintId)
      .where('deleted_at', 'is', null)
      .execute();

    const committed = sprintTasks.reduce(
      (sum, t) => sum + (t.story_points !== null ? Number(t.story_points) : Number(t.estimated_hours) || 1),
      0,
    );

    await trx
      .updateTable('project_sprints')
      .set({
        status: 'ACTIVE',
        start_date: startDate,
        end_date: endDate,
        committed_points: Math.round(committed * 100) / 100,
        updated_by: auth.userId,
      })
      .where('id', '=', sprintId)
      .execute();
  });

  await recordTaskActivity({
    projectId: ctx.project.id,
    taskId: null,
    actorUserId: auth.userId,
    actionType: 'SPRINT_STARTED',
    newValue: { sprintId },
  });

  const list = await listProjectSprints(auth, ctx.project.id);
  return list.find((s) => s.id === sprintId)!;
}

export async function completeProjectSprint(
  auth: AuthContext,
  projectIdOrCode: string | number,
  sprintId: number,
  input: CompleteSprintInput,
): Promise<{
  sprint: ProjectSprintView;
  completedTaskCount: number;
  carriedOverCount: number;
}> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  let completedTaskCount = 0;
  let carriedOverCount = 0;

  await db.transaction().execute(async (trx) => {
    const sprint = await trx
      .selectFrom('project_sprints')
      .selectAll()
      .where('id', '=', sprintId)
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!sprint) {
      throw new AppError('SPRINT_NOT_FOUND', 'Không tìm thấy Sprint.', 404);
    }
    if (sprint.status !== 'ACTIVE') {
      throw new AppError(
        'SPRINT_INVALID_STATE',
        'Chỉ có thể chốt (Complete) Sprint đang hoạt động (ACTIVE).',
        409,
      );
    }

    let destinationSprintId: number | null = null;
    if (input.carryoverAction === 'NEXT_SPRINT') {
      if (!input.targetSprintId || input.targetSprintId === sprintId) {
        throw new AppError(
          'INVALID_TARGET_SPRINT',
          'Vui lòng chọn Sprint kế tiếp hợp lệ để chuyển các công việc chưa hoàn thành.',
          400,
        );
      }
      const nextSprint = await trx
        .selectFrom('project_sprints')
        .select(['id', 'status'])
        .where('id', '=', input.targetSprintId)
        .where('project_id', '=', ctx.project.id)
        .where('status', '=', 'PLANNED')
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      if (!nextSprint) {
        throw new AppError(
          'TARGET_SPRINT_NOT_FOUND',
          'Sprint đích không tồn tại hoặc không ở trạng thái Dự kiến (PLANNED).',
          404,
        );
      }
      destinationSprintId = Number(nextSprint.id);
    }

    const sprintTasks = await trx
      .selectFrom('tasks')
      .select(['id', 'status_category', 'story_points', 'estimated_hours'])
      .where('project_id', '=', ctx.project.id)
      .where('sprint_id', '=', sprintId)
      .where('deleted_at', 'is', null)
      .execute();

    let completedPoints = 0;
    const unfinishedIds: number[] = [];

    for (const t of sprintTasks) {
      const pts = t.story_points !== null ? Number(t.story_points) : Number(t.estimated_hours) || 1;
      if (t.status_category === 'DONE') {
        completedTaskCount += 1;
        completedPoints += pts;
      } else {
        unfinishedIds.push(Number(t.id));
      }
    }

    carriedOverCount = unfinishedIds.length;
    if (unfinishedIds.length > 0) {
      await trx
        .updateTable('tasks')
        .set({
          sprint_id: destinationSprintId,
          updated_by: auth.userId,
        })
        .where('id', 'in', unfinishedIds)
        .execute();
    }

    await trx
      .updateTable('project_sprints')
      .set({
        status: 'COMPLETED',
        completed_points: Math.round(completedPoints * 100) / 100,
        completed_at: new Date(),
        updated_by: auth.userId,
      })
      .where('id', '=', sprintId)
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'COMPLETE_SPRINT',
    entityType: 'project_sprints',
    entityId: String(sprintId),
    newValues: {
      projectId: ctx.project.id,
      completedTaskCount,
      carriedOverCount,
      carryoverAction: input.carryoverAction,
    },
  });

  const list = await listProjectSprints(auth, ctx.project.id);
  return {
    sprint: list.find((s) => s.id === sprintId)!,
    completedTaskCount,
    carriedOverCount,
  };
}

export async function getSprintBurndownAndVelocity(
  auth: AuthContext,
  projectIdOrCode: string | number,
  sprintId: number,
): Promise<SprintAnalyticsView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const db = getDb();

  const sprints = await listProjectSprints(auth, ctx.project.id);
  const sprint = sprints.find((s) => s.id === sprintId);
  if (!sprint) {
    throw new AppError('SPRINT_NOT_FOUND', 'Không tìm thấy Sprint trong dự án.', 404);
  }

  const tasks = await db
    .selectFrom('tasks')
    .select(['story_points', 'estimated_hours', 'status_category', 'completed_at'])
    .where('project_id', '=', ctx.project.id)
    .where('sprint_id', '=', sprintId)
    .where('deleted_at', 'is', null)
    .execute();

  const todayIso = new Date().toISOString().slice(0, 10);
  const startDate = sprint.startDate ?? todayIso;
  const endDate =
    sprint.endDate ?? new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);

  const burndown = computeBurndownSeries({
    startDate,
    endDate,
    asOfDate: sprint.status === 'COMPLETED' ? endDate : todayIso,
    tasks: tasks.map((t) => ({
      effort: t.story_points !== null ? Number(t.story_points) : Number(t.estimated_hours) || 1,
      completedDate:
        t.status_category === 'DONE' ? toIsoDate(t.completed_at) ?? todayIso : null,
    })),
  });

  const recentSprints = [...sprints]
    .filter((s) => s.status === 'COMPLETED' || s.status === 'ACTIVE')
    .slice(0, 6)
    .reverse();

  const velocity = computeVelocitySeries(
    recentSprints.map((s) => ({
      sprintId: s.id,
      name: s.name,
      committedPoints: s.committedPoints > 0 ? s.committedPoints : s.totalPoints,
      completedPoints: s.status === 'COMPLETED' ? s.completedPoints : s.donePoints,
    })),
  );

  return { sprint, burndown, velocity };
}
