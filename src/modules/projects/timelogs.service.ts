import { getDb, type TimeLogApprovalStatus } from '@/config/database';
import { roundCurrency } from '@/lib/portable/currency-utils';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import { recordTaskActivity } from '@/modules/projects/collaboration.service';
import {
  assertProjectAccess,
  resolveEmployeeForUser,
} from '@/modules/projects/projects.access';
import { MAX_RUNNING_TIMER_WARNING_HOURS } from '@/modules/projects/projects.constants';
import type {
  CreateManualTimeLogInput,
  ReviewTimeLogsInput,
  StartTimerInput,
  StopTimerInput,
  SubmitWeekTimesheetInput,
  UpdateTimeLogInput,
} from '@/modules/projects/projects-advanced.schema';
import { AppError } from '@/shared/api-response';

export interface TimeLogItemView {
  id: number;
  projectId: number;
  projectCode: string;
  projectName: string;
  taskId: number;
  taskKey: string;
  taskTitle: string;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  loggedDate: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  isBillable: boolean;
  hourlyCostSnapshot: number;
  estimatedCost: number;
  description: string | null;
  approvalStatus: TimeLogApprovalStatus;
  rejectionReason: string | null;
  isRunning: boolean;
  exceededWarningHours: boolean;
}

function toIsoDate(val: Date | string | null | undefined): string {
  if (!val) return '';
  return val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
}

function toIsoDateTime(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : String(val);
}

export async function recalculateTaskActualHours(taskId: number): Promise<void> {
  const db = getDb();
  const agg = await db
    .selectFrom('task_time_logs')
    .select((eb) => eb.fn.sum<string>('duration_minutes').as('totalMinutes'))
    .where('task_id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const totalHours = Math.round((Number(agg?.totalMinutes ?? 0) / 60) * 100) / 100;
  await db
    .updateTable('tasks')
    .set({ actual_hours: totalHours })
    .where('id', '=', taskId)
    .execute();
}

export async function syncProjectLaborCost(projectId: number, actorUserId: number): Promise<void> {
  const db = getDb();
  const approvedLogs = await db
    .selectFrom('task_time_logs')
    .select(['duration_minutes', 'hourly_cost_snapshot'])
    .where('project_id', '=', projectId)
    .where('approval_status', '=', 'APPROVED')
    .where('deleted_at', 'is', null)
    .execute();

  let laborCost = 0;
  for (const log of approvedLogs) {
    const hours = Number(log.duration_minutes) / 60;
    laborCost += hours * Number(log.hourly_cost_snapshot);
  }
  laborCost = roundCurrency(laborCost);

  const nonLaborAgg = await db
    .selectFrom('project_budget_items')
    .select((eb) => eb.fn.sum<string>('actual_amount').as('sumActual'))
    .where('project_id', '=', projectId)
    .where('category', '<>', 'LABOR')
    .where('status', 'in', ['APPROVED', 'SPENT'])
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const manualLaborAgg = await db
    .selectFrom('project_budget_items')
    .select((eb) => eb.fn.sum<string>('actual_amount').as('sumActual'))
    .where('project_id', '=', projectId)
    .where('category', '=', 'LABOR')
    .where('status', 'in', ['APPROVED', 'SPENT'])
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const totalActualCost = roundCurrency(
    Math.max(laborCost, Number(manualLaborAgg?.sumActual ?? 0)) +
      Number(nonLaborAgg?.sumActual ?? 0),
  );

  await db
    .updateTable('projects')
    .set({ actual_cost: totalActualCost, updated_by: actorUserId })
    .where('id', '=', projectId)
    .execute();
}

async function resolveHourlyRate(projectId: number, employeeId: number): Promise<number> {
  const db = getDb();
  const member = await db
    .selectFrom('project_members')
    .select(['hourly_cost_rate'])
    .where('project_id', '=', projectId)
    .where('employee_id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  return Number(member?.hourly_cost_rate ?? 0);
}

function mapTimeLogRow(row: {
  id: number;
  project_id: number;
  project_code: string;
  project_name: string;
  task_id: number;
  task_key: string;
  task_title: string;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  logged_date: Date | string;
  started_at: Date | string | null;
  ended_at: Date | string | null;
  duration_minutes: number;
  is_billable: number;
  hourly_cost_snapshot: string | number;
  description: string | null;
  approval_status: TimeLogApprovalStatus;
  rejection_reason: string | null;
}): TimeLogItemView {
  const isRunning = row.started_at !== null && row.ended_at === null;
  const startedMs = row.started_at ? new Date(row.started_at).getTime() : 0;
  const elapsedHours = isRunning ? (Date.now() - startedMs) / 3600000 : 0;
  const durationMinutes = isRunning
    ? Math.max(1, Math.round((Date.now() - startedMs) / 60000))
    : Number(row.duration_minutes);
  const rate = Number(row.hourly_cost_snapshot);

  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    projectCode: row.project_code,
    projectName: row.project_name,
    taskId: Number(row.task_id),
    taskKey: row.task_key,
    taskTitle: row.task_title,
    employeeId: Number(row.employee_id),
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    loggedDate: toIsoDate(row.logged_date),
    startedAt: toIsoDateTime(row.started_at),
    endedAt: toIsoDateTime(row.ended_at),
    durationMinutes,
    isBillable: Number(row.is_billable) === 1,
    hourlyCostSnapshot: rate,
    estimatedCost: roundCurrency((durationMinutes / 60) * rate),
    description: row.description,
    approvalStatus: row.approval_status,
    rejectionReason: row.rejection_reason,
    isRunning,
    exceededWarningHours: isRunning && elapsedHours >= MAX_RUNNING_TIMER_WARNING_HOURS,
  };
}

export async function getActiveRunningTimer(auth: AuthContext): Promise<TimeLogItemView | null> {
  const emp = await resolveEmployeeForUser(auth.userId);
  if (!emp) {
    return null;
  }
  const db = getDb();
  const row = await db
    .selectFrom('task_time_logs as l')
    .innerJoin('projects as p', 'p.id', 'l.project_id')
    .innerJoin('tasks as t', 't.id', 'l.task_id')
    .innerJoin('employees as e', 'e.id', 'l.employee_id')
    .select([
      'l.id',
      'l.project_id',
      'p.code as project_code',
      'p.name as project_name',
      'l.task_id',
      't.task_key',
      't.title as task_title',
      'l.employee_id',
      'e.full_name as employee_name',
      'e.employee_code',
      'l.logged_date',
      'l.started_at',
      'l.ended_at',
      'l.duration_minutes',
      'l.is_billable',
      'l.hourly_cost_snapshot',
      'l.description',
      'l.approval_status',
      'l.rejection_reason',
    ])
    .where('l.employee_id', '=', emp.id)
    .where('l.started_at', 'is not', null)
    .where('l.ended_at', 'is', null)
    .where('l.deleted_at', 'is', null)
    .orderBy('l.started_at', 'desc')
    .executeTakeFirst();

  return row ? mapTimeLogRow(row) : null;
}

export async function startTaskTimer(
  auth: AuthContext,
  input: StartTimerInput,
): Promise<TimeLogItemView> {
  const emp = await resolveEmployeeForUser(auth.userId);
  if (!emp) {
    throw new AppError('EMPLOYEE_REQUIRED', 'Tài khoản chưa gắn hồ sơ nhân viên để chấm giờ.', 400);
  }

  const db = getDb();
  const task = await db
    .selectFrom('tasks')
    .select(['id', 'project_id'])
    .where('id', '=', input.taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  await assertProjectAccess(auth, Number(task.project_id), 'VIEW');

  // Stop any existing running timer for this employee cleanly
  const running = await db
    .selectFrom('task_time_logs')
    .select(['id', 'task_id', 'started_at'])
    .where('employee_id', '=', emp.id)
    .where('started_at', 'is not', null)
    .where('ended_at', 'is', null)
    .where('deleted_at', 'is', null)
    .execute();

  const now = new Date();
  for (const prev of running) {
    const startMs = prev.started_at ? new Date(prev.started_at).getTime() : now.getTime();
    const mins = Math.max(1, Math.min(1440, Math.round((now.getTime() - startMs) / 60000)));
    await db
      .updateTable('task_time_logs')
      .set({
        ended_at: now,
        duration_minutes: mins,
        updated_by: auth.userId,
      })
      .where('id', '=', Number(prev.id))
      .execute();
    await recalculateTaskActualHours(Number(prev.task_id));
  }

  const rate = await resolveHourlyRate(Number(task.project_id), emp.id);
  const todayIso = now.toISOString().slice(0, 10);

  await db
    .insertInto('task_time_logs')
    .values({
      project_id: Number(task.project_id),
      task_id: input.taskId,
      employee_id: emp.id,
      logged_date: todayIso,
      started_at: now,
      ended_at: null,
      duration_minutes: 0,
      is_billable: input.isBillable ? 1 : 0,
      hourly_cost_snapshot: rate,
      description: input.description ?? null,
      approval_status: 'DRAFT',
      approved_by_user_id: null,
      approved_at: null,
      rejection_reason: null,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .execute();

  const active = await getActiveRunningTimer(auth);
  if (!active) {
    throw new AppError('TIMER_START_FAILED', 'Không thể khởi động đồng hồ bấm giờ.', 500);
  }
  return active;
}

export async function stopTaskTimer(
  auth: AuthContext,
  input: StopTimerInput,
): Promise<TimeLogItemView> {
  const emp = await resolveEmployeeForUser(auth.userId);
  if (!emp) {
    throw new AppError('EMPLOYEE_REQUIRED', 'Tài khoản chưa gắn hồ sơ nhân viên.', 400);
  }

  const db = getDb();
  let query = db
    .selectFrom('task_time_logs')
    .selectAll()
    .where('employee_id', '=', emp.id)
    .where('started_at', 'is not', null)
    .where('ended_at', 'is', null)
    .where('deleted_at', 'is', null);

  if (input.logId) {
    query = query.where('id', '=', input.logId);
  }

  const running = await query.orderBy('started_at', 'desc').executeTakeFirst();
  if (!running) {
    throw new AppError('NO_RUNNING_TIMER', 'Hiện không có đồng hồ bấm giờ nào đang chạy.', 404);
  }

  const now = new Date();
  const startMs = running.started_at ? new Date(running.started_at).getTime() : now.getTime();
  const mins = Math.max(1, Math.min(1440, Math.round((now.getTime() - startMs) / 60000)));

  await db
    .updateTable('task_time_logs')
    .set({
      ended_at: now,
      duration_minutes: mins,
      ...(input.description !== undefined ? { description: input.description } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', Number(running.id))
    .execute();

  await recalculateTaskActualHours(Number(running.task_id));
  await recordTaskActivity({
    projectId: Number(running.project_id),
    taskId: Number(running.task_id),
    actorUserId: auth.userId,
    actionType: 'TIME_LOGGED',
    newValue: { durationMinutes: mins, source: 'TIMER' },
  });

  const logs = await listTimeLogs(auth, { taskId: Number(running.task_id), mineOnly: true });
  return logs.find((l) => l.id === Number(running.id))!;
}

export async function listTimeLogs(
  auth: AuthContext,
  filters: {
    projectId?: number;
    taskId?: number;
    employeeId?: number;
    startDate?: string;
    endDate?: string;
    status?: TimeLogApprovalStatus;
    mineOnly?: boolean;
  } = {},
): Promise<TimeLogItemView[]> {
  const emp = await resolveEmployeeForUser(auth.userId);
  const canApprove =
    auth.isSuperAdmin || hasRequiredPermission(auth, 'pm.timelogs.approve');

  if (filters.projectId) {
    await assertProjectAccess(auth, filters.projectId, 'VIEW');
  }

  const db = getDb();
  let query = db
    .selectFrom('task_time_logs as l')
    .innerJoin('projects as p', 'p.id', 'l.project_id')
    .innerJoin('tasks as t', 't.id', 'l.task_id')
    .innerJoin('employees as e', 'e.id', 'l.employee_id')
    .select([
      'l.id',
      'l.project_id',
      'p.code as project_code',
      'p.name as project_name',
      'l.task_id',
      't.task_key',
      't.title as task_title',
      'l.employee_id',
      'e.full_name as employee_name',
      'e.employee_code',
      'l.logged_date',
      'l.started_at',
      'l.ended_at',
      'l.duration_minutes',
      'l.is_billable',
      'l.hourly_cost_snapshot',
      'l.description',
      'l.approval_status',
      'l.rejection_reason',
    ])
    .where('l.deleted_at', 'is', null);

  if (filters.projectId) {
    query = query.where('l.project_id', '=', filters.projectId);
  }
  if (filters.taskId) {
    query = query.where('l.task_id', '=', filters.taskId);
  }
  if (filters.startDate) {
    query = query.where('l.logged_date', '>=', filters.startDate);
  }
  if (filters.endDate) {
    query = query.where('l.logged_date', '<=', filters.endDate);
  }
  if (filters.status) {
    query = query.where('l.approval_status', '=', filters.status);
  }

  if (filters.mineOnly || !canApprove) {
    if (!emp) {
      return [];
    }
    query = query.where('l.employee_id', '=', emp.id);
  } else if (filters.employeeId) {
    query = query.where('l.employee_id', '=', filters.employeeId);
  }

  const rows = await query.orderBy('l.logged_date', 'desc').orderBy('l.id', 'desc').limit(500).execute();
  return rows.map(mapTimeLogRow);
}

export async function createManualTimeLog(
  auth: AuthContext,
  input: CreateManualTimeLogInput,
): Promise<TimeLogItemView> {
  const emp = await resolveEmployeeForUser(auth.userId);
  if (!emp) {
    throw new AppError('EMPLOYEE_REQUIRED', 'Tài khoản chưa gắn hồ sơ nhân viên.', 400);
  }

  const db = getDb();
  const task = await db
    .selectFrom('tasks')
    .select(['id', 'project_id'])
    .where('id', '=', input.taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  await assertProjectAccess(auth, Number(task.project_id), 'VIEW');
  const rate = await resolveHourlyRate(Number(task.project_id), emp.id);

  const inserted = await db
    .insertInto('task_time_logs')
    .values({
      project_id: Number(task.project_id),
      task_id: input.taskId,
      employee_id: emp.id,
      logged_date: input.loggedDate,
      started_at: null,
      ended_at: null,
      duration_minutes: input.durationMinutes,
      is_billable: input.isBillable ? 1 : 0,
      hourly_cost_snapshot: rate,
      description: input.description ?? null,
      approval_status: 'DRAFT',
      approved_by_user_id: null,
      approved_at: null,
      rejection_reason: null,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .executeTakeFirstOrThrow();

  await recalculateTaskActualHours(input.taskId);
  await recordTaskActivity({
    projectId: Number(task.project_id),
    taskId: input.taskId,
    actorUserId: auth.userId,
    actionType: 'TIME_LOGGED',
    newValue: { durationMinutes: input.durationMinutes, loggedDate: input.loggedDate },
  });

  const logs = await listTimeLogs(auth, { taskId: input.taskId, mineOnly: true });
  return logs.find((l) => l.id === Number(inserted.insertId))!;
}

export async function updateTimeLog(
  auth: AuthContext,
  logId: number,
  input: UpdateTimeLogInput,
): Promise<TimeLogItemView> {
  const emp = await resolveEmployeeForUser(auth.userId);
  const db = getDb();
  const existing = await db
    .selectFrom('task_time_logs')
    .selectAll()
    .where('id', '=', logId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('TIMELOG_NOT_FOUND', 'Không tìm thấy bản ghi giờ công.', 404);
  }

  if (!auth.isSuperAdmin && (!emp || Number(existing.employee_id) !== emp.id)) {
    throw new AppError('TIMELOG_FORBIDDEN', 'Bạn chỉ có thể chỉnh sửa giờ công của chính mình.', 403);
  }
  if (existing.approval_status === 'APPROVED') {
    throw new AppError('TIMELOG_LOCKED', 'Bản ghi giờ công đã được phê duyệt, không thể sửa.', 409);
  }

  await db
    .updateTable('task_time_logs')
    .set({
      ...(input.loggedDate !== undefined ? { logged_date: input.loggedDate } : {}),
      ...(input.durationMinutes !== undefined ? { duration_minutes: input.durationMinutes } : {}),
      ...(input.isBillable !== undefined ? { is_billable: input.isBillable ? 1 : 0 } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      approval_status: 'DRAFT',
      rejection_reason: null,
      updated_by: auth.userId,
    })
    .where('id', '=', logId)
    .execute();

  await recalculateTaskActualHours(Number(existing.task_id));
  const logs = await listTimeLogs(auth, { taskId: Number(existing.task_id) });
  return logs.find((l) => l.id === logId)!;
}

export async function submitWeeklyTimesheet(
  auth: AuthContext,
  input: SubmitWeekTimesheetInput,
): Promise<{ submittedCount: number }> {
  const emp = await resolveEmployeeForUser(auth.userId);
  if (!emp) {
    throw new AppError('EMPLOYEE_REQUIRED', 'Tài khoản chưa gắn hồ sơ nhân viên.', 400);
  }

  const db = getDb();
  let query = db
    .updateTable('task_time_logs')
    .set({
      approval_status: 'SUBMITTED',
      rejection_reason: null,
      updated_by: auth.userId,
    })
    .where('employee_id', '=', emp.id)
    .where('logged_date', '>=', input.weekStart)
    .where('logged_date', '<=', input.weekEnd)
    .where('approval_status', 'in', ['DRAFT', 'REJECTED'])
    .where('duration_minutes', '>', 0)
    .where('deleted_at', 'is', null);

  if (input.projectId) {
    query = query.where('project_id', '=', input.projectId);
  }

  const res = await query.executeTakeFirst();
  return { submittedCount: Number(res.numUpdatedRows ?? 0) };
}

export async function reviewTimeLogs(
  auth: AuthContext,
  input: ReviewTimeLogsInput,
): Promise<{ updatedCount: number }> {
  if (!auth.isSuperAdmin && !hasRequiredPermission(auth, 'pm.timelogs.approve')) {
    throw new AppError('TIMELOG_APPROVE_DENIED', 'Bạn không có quyền phê duyệt Timesheet.', 403);
  }

  const db = getDb();
  const rows = await db
    .selectFrom('task_time_logs')
    .select(['id', 'project_id', 'approval_status'])
    .where('id', 'in', input.logIds)
    .where('deleted_at', 'is', null)
    .execute();

  if (rows.length === 0) {
    throw new AppError('TIMELOG_NOT_FOUND', 'Không tìm thấy bản ghi giờ công hợp lệ.', 404);
  }

  const projectIds = Array.from(new Set(rows.map((r) => Number(r.project_id))));
  for (const pid of projectIds) {
    await assertProjectAccess(auth, pid, 'VIEW');
  }

  const res = await db
    .updateTable('task_time_logs')
    .set({
      approval_status: input.decision,
      approved_by_user_id: auth.userId,
      approved_at: new Date(),
      rejection_reason: input.decision === 'REJECTED' ? input.rejectionReason ?? 'Từ chối duyệt' : null,
      updated_by: auth.userId,
    })
    .where('id', 'in', input.logIds)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  for (const pid of projectIds) {
    await syncProjectLaborCost(pid, auth.userId);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: input.decision === 'APPROVED' ? 'APPROVE_TIMESHEET' : 'REJECT_TIMESHEET',
    entityType: 'task_time_logs',
    entityId: input.logIds.join(','),
    newValues: { decision: input.decision, count: rows.length },
  });

  return { updatedCount: Number(res.numUpdatedRows ?? 0) };
}
