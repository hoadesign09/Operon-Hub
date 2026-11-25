import dayjs from 'dayjs';
import {
  getDb,
  type ProjectAutomationAction,
  type ProjectAutomationTrigger,
  type ProjectMethodology,
  type TaskPriority,
  type TaskRecurrenceFrequency,
  type TaskStatusCategory,
  type TaskType,
} from '@/config/database';
import { generateInitialRanks } from '@/lib/portable/fractional-rank';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import { assertProjectAccess } from '@/modules/projects/projects.access';
import { MAX_AUTOMATION_DEPTH } from '@/modules/projects/projects.constants';
import type {
  CreateAutomationRuleInput,
  CreateProjectTemplateInput,
  CreateRecurrenceRuleInput,
  SaveAsTemplateInput,
  UpdateAutomationRuleInput,
  UpdateProjectTemplateInput,
  UpdateRecurrenceRuleInput,
} from '@/modules/projects/projects-advanced.schema';
import { createTask } from '@/modules/projects/tasks.service';
import { AppError } from '@/shared/api-response';

export interface TemplateColumnPayload {
  code: string;
  name: string;
  nameEn?: string | null;
  statusCategory: TaskStatusCategory;
  colorHex: string;
  wipLimit?: number | null;
  isDefaultInitial?: boolean;
  isDoneColumn?: boolean;
}

export interface TemplateTaskPayload {
  title: string;
  description?: string | null;
  taskType: TaskType;
  priority: TaskPriority;
  columnCode?: string;
  startOffsetDays: number;
  durationDays: number;
  estimatedHours: number;
  checklists?: string[];
}

export interface ProjectTemplatePayload {
  columns: TemplateColumnPayload[];
  tasks: TemplateTaskPayload[];
}

export interface ProjectTemplateView {
  id: number;
  branchId: number | null;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  methodology: ProjectMethodology;
  payload: ProjectTemplatePayload;
  isActive: boolean;
  createdAt: string;
}

export interface AutomationRuleView {
  id: number;
  projectId: number;
  name: string;
  triggerEvent: ProjectAutomationTrigger;
  condition: Record<string, unknown> | null;
  actionType: ProjectAutomationAction;
  actionPayload: Record<string, unknown> | null;
  isActive: boolean;
}

export interface RecurrenceRuleView {
  id: number;
  projectId: number;
  templateTaskId: number;
  templateTaskKey: string;
  templateTaskTitle: string;
  frequency: TaskRecurrenceFrequency;
  intervalValue: number;
  weekdays: number[] | null;
  dayOfMonth: number | null;
  nextRunDate: string;
  endDate: string | null;
  isActive: boolean;
}

function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

function toIsoDate(val: Date | string | null | undefined): string {
  if (!val) return '';
  return val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
}

// --- Project Templates ---

export async function listProjectTemplates(
  auth: AuthContext,
  onlyActive: boolean = false,
): Promise<ProjectTemplateView[]> {
  const db = getDb();
  let query = db
    .selectFrom('project_templates')
    .selectAll()
    .where('deleted_at', 'is', null);

  if (onlyActive) {
    query = query.where('is_active', '=', 1);
  }
  if (!auth.isSuperAdmin && auth.dataScope !== 'ALL' && auth.branchIds.length > 0) {
    query = query.where((eb) =>
      eb.or([eb('branch_id', 'is', null), eb('branch_id', 'in', auth.branchIds)]),
    );
  }

  const rows = await query.orderBy('id', 'desc').execute();
  return rows.map((r) => ({
    id: Number(r.id),
    branchId: r.branch_id ? Number(r.branch_id) : null,
    code: r.code,
    name: r.name,
    nameEn: r.name_en ?? null,
    description: r.description,
    methodology: r.methodology,
    payload: parseJsonSafe<ProjectTemplatePayload>(r.template_payload_json, {
      columns: [],
      tasks: [],
    }),
    isActive: Number(r.is_active) === 1,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function createProjectTemplate(
  auth: AuthContext,
  input: CreateProjectTemplateInput,
): Promise<ProjectTemplateView> {
  const db = getDb();
  const code = input.code.toUpperCase();

  const existing = await db
    .selectFrom('project_templates')
    .select(['id'])
    .where('code', '=', code)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (existing) {
    throw new AppError('TEMPLATE_CODE_EXISTS', `Mã mẫu dự án ${code} đã tồn tại.`, 409);
  }

  const payload: ProjectTemplatePayload = {
    columns: input.columns,
    tasks: input.tasks,
  };

  const res = await db
    .insertInto('project_templates')
    .values({
      branch_id: input.branchId ?? null,
      code,
      name: input.name,
      name_en: input.nameEn?.trim() || null,
      description: input.description ?? null,
      methodology: input.methodology,
      template_payload_json: JSON.stringify(payload),
      is_active: 1,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .executeTakeFirstOrThrow();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'CREATE_TEMPLATE',
    entityType: 'project_templates',
    entityId: String(res.insertId),
    newValues: { code, name: input.name },
  });

  const all = await listProjectTemplates(auth);
  return all.find((t) => t.id === Number(res.insertId))!;
}

export async function updateProjectTemplate(
  auth: AuthContext,
  templateId: number,
  input: UpdateProjectTemplateInput,
): Promise<ProjectTemplateView> {
  const db = getDb();
  const existing = await db
    .selectFrom('project_templates')
    .select(['id'])
    .where('id', '=', templateId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('TEMPLATE_NOT_FOUND', 'Không tìm thấy mẫu dự án.', 404);
  }

  await db
    .updateTable('project_templates')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nameEn !== undefined ? { name_en: input.nameEn?.trim() || null } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.methodology !== undefined ? { methodology: input.methodology } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive ? 1 : 0 } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', templateId)
    .execute();

  const all = await listProjectTemplates(auth);
  return all.find((t) => t.id === templateId)!;
}

export async function saveProjectAsTemplate(
  auth: AuthContext,
  projectIdOrCode: string | number,
  input: SaveAsTemplateInput,
): Promise<ProjectTemplateView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  const db = getDb();

  const [projectRow, columns, tasks, checklists] = await Promise.all([
    db
      .selectFrom('projects')
      .select(['methodology', 'start_date', 'branch_id'])
      .where('id', '=', ctx.project.id)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('project_board_columns')
      .selectAll()
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .orderBy('sort_order', 'asc')
      .execute(),
    db
      .selectFrom('tasks')
      .select([
        'id',
        'column_id',
        'title',
        'description',
        'task_type',
        'priority',
        'start_date',
        'due_date',
        'estimated_hours',
      ])
      .where('project_id', '=', ctx.project.id)
      .where('parent_task_id', 'is', null)
      .where('deleted_at', 'is', null)
      .orderBy('id', 'asc')
      .limit(100)
      .execute(),
    db
      .selectFrom('task_checklists')
      .select(['task_id', 'title'])
      .where('deleted_at', 'is', null)
      .orderBy('sort_order', 'asc')
      .execute(),
  ]);

  const colIdToCode = new Map<number, string>();
  for (const c of columns) {
    colIdToCode.set(Number(c.id), c.code);
  }

  const checklistsByTask = new Map<number, string[]>();
  for (const cl of checklists) {
    const tid = Number(cl.task_id);
    const list = checklistsByTask.get(tid) ?? [];
    list.push(cl.title);
    checklistsByTask.set(tid, list);
  }

  const baseDate = dayjs(
    projectRow.start_date ? toIsoDate(projectRow.start_date) : dayjs().format('YYYY-MM-DD'),
  );

  const taskPayloads: TemplateTaskPayload[] = tasks.map((t) => {
    const sDate = t.start_date ? dayjs(toIsoDate(t.start_date)) : baseDate;
    const eDate = t.due_date ? dayjs(toIsoDate(t.due_date)) : sDate.add(2, 'day');
    const startOffsetDays = Math.max(0, sDate.diff(baseDate, 'day'));
    const durationDays = Math.max(1, eDate.diff(sDate, 'day') + 1);
    return {
      title: t.title,
      description: t.description,
      taskType: t.task_type,
      priority: t.priority,
      columnCode: colIdToCode.get(Number(t.column_id)),
      startOffsetDays,
      durationDays,
      estimatedHours: Number(t.estimated_hours) || 4,
      checklists: checklistsByTask.get(Number(t.id)) ?? [],
    };
  });

  return createProjectTemplate(auth, {
    code: input.code,
    name: input.name,
    nameEn: input.nameEn ?? null,
    description: input.description ?? null,
    branchId: input.isCompanyWide ? null : Number(projectRow.branch_id),
    methodology: projectRow.methodology,
    columns: columns.map((c) => ({
      code: c.code,
      name: c.name,
      nameEn: c.name_en ?? null,
      statusCategory: c.status_category,
      colorHex: c.color_hex,
      wipLimit: c.wip_limit,
      isDefaultInitial: Number(c.is_default_initial) === 1,
      isDoneColumn: Number(c.is_done_column) === 1,
    })),
    tasks: taskPayloads,
  });
}

export async function applyTemplateToNewProject(params: {
  templateId: number;
  projectId: number;
  projectCode: string;
  projectStartDate: string | null;
  reporterEmployeeId: number;
  actorUserId: number;
}): Promise<void> {
  const db = getDb();
  const tpl = await db
    .selectFrom('project_templates')
    .select(['template_payload_json'])
    .where('id', '=', params.templateId)
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!tpl) {
    return;
  }

  const payload = parseJsonSafe<ProjectTemplatePayload>(tpl.template_payload_json, {
    columns: [],
    tasks: [],
  });

  const colCodeToId = new Map<string, number>();
  if (payload.columns.length > 0) {
    // Replace default columns with template columns cleanly via soft-delete
    await db
      .updateTable('project_board_columns')
      .set({ deleted_at: new Date(), updated_by: params.actorUserId })
      .where('project_id', '=', params.projectId)
      .where('deleted_at', 'is', null)
      .execute();

    for (let idx = 0; idx < payload.columns.length; idx += 1) {
      const col = payload.columns[idx];
      const inserted = await db
        .insertInto('project_board_columns')
        .values({
          project_id: params.projectId,
          code: col.code,
          name: col.name,
          name_en: col.nameEn ?? null,
          status_category: col.statusCategory,
          color_hex: col.colorHex || '#3B82F6',
          wip_limit: col.wipLimit ?? null,
          sort_order: idx,
          is_default_initial: col.isDefaultInitial ? 1 : idx === 0 ? 1 : 0,
          is_done_column: col.isDoneColumn || col.statusCategory === 'DONE' ? 1 : 0,
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
          deleted_at: null,
        })
        .executeTakeFirstOrThrow();
      colCodeToId.set(col.code, Number(inserted.insertId));
    }
  } else {
    const existingCols = await db
      .selectFrom('project_board_columns')
      .select(['id', 'code'])
      .where('project_id', '=', params.projectId)
      .where('deleted_at', 'is', null)
      .execute();
    for (const c of existingCols) {
      colCodeToId.set(c.code, Number(c.id));
    }
  }

  const firstColId = Array.from(colCodeToId.values())[0];
  if (!firstColId || payload.tasks.length === 0) {
    return;
  }

  const baseDate = dayjs(params.projectStartDate ?? dayjs().format('YYYY-MM-DD'));
  const ranks = generateInitialRanks(payload.tasks.length);
  let seq = 0;

  for (let i = 0; i < payload.tasks.length; i += 1) {
    const t = payload.tasks[i];
    seq += 1;
    const targetColId = (t.columnCode && colCodeToId.get(t.columnCode)) || firstColId;
    const startDate = baseDate.add(t.startOffsetDays || 0, 'day').format('YYYY-MM-DD');
    const dueDate = baseDate
      .add((t.startOffsetDays || 0) + Math.max(1, t.durationDays || 1) - 1, 'day')
      .format('YYYY-MM-DD');

    const insertedTask = await db
      .insertInto('tasks')
      .values({
        project_id: params.projectId,
        parent_task_id: null,
        column_id: targetColId,
        sprint_id: null,
        milestone_id: null,
        task_key: `${params.projectCode}-${seq}`,
        title: t.title,
        description: t.description ?? null,
        task_type: t.taskType ?? 'TASK',
        priority: t.priority ?? 'MEDIUM',
        status_category: 'TODO',
        reporter_employee_id: params.reporterEmployeeId,
        start_date: startDate,
        due_date: dueDate,
        baseline_start_date: null,
        baseline_due_date: null,
        completed_at: null,
        estimated_hours: t.estimatedHours ?? 4,
        actual_hours: 0,
        story_points: null,
        progress_percent: 0,
        sort_rank: ranks[i],
        is_blocked: 0,
        blocked_reason: null,
        version: 1,
        created_by: params.actorUserId,
        updated_by: params.actorUserId,
        deleted_at: null,
      })
      .executeTakeFirstOrThrow();

    const taskId = Number(insertedTask.insertId);
    if (t.checklists && t.checklists.length > 0) {
      for (let cIdx = 0; cIdx < t.checklists.length; cIdx += 1) {
        await db
          .insertInto('task_checklists')
          .values({
            task_id: taskId,
            title: t.checklists[cIdx],
            is_completed: 0,
            assignee_employee_id: null,
            due_date: null,
            sort_order: cIdx,
            completed_at: null,
            created_by: params.actorUserId,
            updated_by: params.actorUserId,
            deleted_at: null,
          })
          .execute();
      }
    }
  }

  await db
    .updateTable('projects')
    .set({ task_seq_counter: seq })
    .where('id', '=', params.projectId)
    .execute();
}

// --- Automation Rules ---

export async function listProjectAutomations(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<AutomationRuleView[]> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const db = getDb();

  const rows = await db
    .selectFrom('project_automation_rules')
    .selectAll()
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .orderBy('id', 'desc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    projectId: Number(r.project_id),
    name: r.name,
    triggerEvent: r.trigger_event,
    condition: parseJsonSafe<Record<string, unknown> | null>(r.condition_json, null),
    actionType: r.action_type,
    actionPayload: parseJsonSafe<Record<string, unknown> | null>(r.action_payload_json, null),
    isActive: Number(r.is_active) === 1,
  }));
}

export async function createProjectAutomation(
  auth: AuthContext,
  projectIdOrCode: string | number,
  input: CreateAutomationRuleInput,
): Promise<AutomationRuleView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  const db = getDb();

  const res = await db
    .insertInto('project_automation_rules')
    .values({
      project_id: ctx.project.id,
      name: input.name,
      trigger_event: input.triggerEvent,
      condition_json: input.condition ? JSON.stringify(input.condition) : null,
      action_type: input.actionType,
      action_payload_json: input.actionPayload ? JSON.stringify(input.actionPayload) : null,
      is_active: input.isActive ? 1 : 0,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .executeTakeFirstOrThrow();

  const list = await listProjectAutomations(auth, ctx.project.id);
  return list.find((r) => r.id === Number(res.insertId))!;
}

export async function updateProjectAutomation(
  auth: AuthContext,
  projectIdOrCode: string | number,
  ruleId: number,
  input: UpdateAutomationRuleInput,
): Promise<AutomationRuleView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  const db = getDb();

  const existing = await db
    .selectFrom('project_automation_rules')
    .select(['id'])
    .where('id', '=', ruleId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('AUTOMATION_NOT_FOUND', 'Không tìm thấy luật tự động hóa.', 404);
  }

  await db
    .updateTable('project_automation_rules')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.condition !== undefined
        ? { condition_json: input.condition ? JSON.stringify(input.condition) : null }
        : {}),
      ...(input.actionPayload !== undefined
        ? { action_payload_json: input.actionPayload ? JSON.stringify(input.actionPayload) : null }
        : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive ? 1 : 0 } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', ruleId)
    .execute();

  const list = await listProjectAutomations(auth, ctx.project.id);
  return list.find((r) => r.id === ruleId)!;
}

/**
 * Thực thi luật tự động hóa an toàn (anti-loop depth guard <= MAX_AUTOMATION_DEPTH).
 */
export async function executeProjectAutomations(params: {
  projectId: number;
  taskId: number;
  triggerEvent: ProjectAutomationTrigger;
  statusCategory?: TaskStatusCategory;
  depth?: number;
}): Promise<number> {
  const depth = params.depth ?? 0;
  if (depth >= MAX_AUTOMATION_DEPTH) {
    return 0;
  }

  const db = getDb();
  const rules = await db
    .selectFrom('project_automation_rules')
    .selectAll()
    .where('project_id', '=', params.projectId)
    .where('trigger_event', '=', params.triggerEvent)
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null)
    .execute();

  if (rules.length === 0) {
    return 0;
  }

  const [project, task] = await Promise.all([
    db
      .selectFrom('projects')
      .select(['id', 'code', 'manager_employee_id'])
      .where('id', '=', params.projectId)
      .executeTakeFirst(),
    db
      .selectFrom('tasks')
      .select(['id', 'task_key', 'title', 'status_category'])
      .where('id', '=', params.taskId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
  ]);

  if (!project || !task) {
    return 0;
  }

  let executed = 0;
  for (const rule of rules) {
    const cond = parseJsonSafe<Record<string, unknown>>(rule.condition_json, {});
    const payload = parseJsonSafe<Record<string, unknown>>(rule.action_payload_json, {});

    if (
      cond.statusCategory &&
      params.statusCategory &&
      String(cond.statusCategory) !== params.statusCategory
    ) {
      continue;
    }

    if (rule.action_type === 'NOTIFY_PM') {
      const pmEmp = await db
        .selectFrom('employees')
        .select(['user_id'])
        .where('id', '=', Number(project.manager_employee_id))
        .executeTakeFirst();
      if (pmEmp?.user_id) {
        await createNotification({
          userId: Number(pmEmp.user_id),
          moduleCode: 'projects',
          type: 'PROJECT_AUTOMATION',
          title: `[Automation] ${rule.name}`,
          message: `Công việc ${task.task_key} (${task.title}) đã kích hoạt sự kiện ${params.triggerEvent}.`,
          linkUrl: `/projects/${project.code}?taskId=${task.id}`,
        });
        executed += 1;
      }
    } else if (rule.action_type === 'SET_BLOCKED') {
      await db
        .updateTable('tasks')
        .set({
          is_blocked: 1,
          blocked_reason: String(payload.reason ?? rule.name),
        })
        .where('id', '=', task.id)
        .execute();
      executed += 1;
    } else if (rule.action_type === 'MOVE_COLUMN' && payload.targetColumnId) {
      const targetCol = await db
        .selectFrom('project_board_columns')
        .select(['id', 'status_category'])
        .where('id', '=', Number(payload.targetColumnId))
        .where('project_id', '=', params.projectId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
      if (targetCol) {
        await db
          .updateTable('tasks')
          .set({
            column_id: Number(targetCol.id),
            status_category: targetCol.status_category,
          })
          .where('id', '=', task.id)
          .execute();
        executed += 1;
      }
    }
  }

  return executed;
}

// --- Recurrence Rules ---

export async function listProjectRecurrences(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<RecurrenceRuleView[]> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const db = getDb();

  const rows = await db
    .selectFrom('task_recurrence_rules as r')
    .innerJoin('tasks as t', 't.id', 'r.template_task_id')
    .select([
      'r.id',
      'r.project_id',
      'r.template_task_id',
      't.task_key as template_task_key',
      't.title as template_task_title',
      'r.frequency',
      'r.interval_value',
      'r.weekdays_json',
      'r.day_of_month',
      'r.next_run_date',
      'r.end_date',
      'r.is_active',
    ])
    .where('r.project_id', '=', ctx.project.id)
    .where('r.deleted_at', 'is', null)
    .orderBy('r.next_run_date', 'asc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    projectId: Number(r.project_id),
    templateTaskId: Number(r.template_task_id),
    templateTaskKey: r.template_task_key,
    templateTaskTitle: r.template_task_title,
    frequency: r.frequency,
    intervalValue: Number(r.interval_value),
    weekdays: parseJsonSafe<number[] | null>(r.weekdays_json, null),
    dayOfMonth: r.day_of_month !== null ? Number(r.day_of_month) : null,
    nextRunDate: toIsoDate(r.next_run_date),
    endDate: r.end_date ? toIsoDate(r.end_date) : null,
    isActive: Number(r.is_active) === 1,
  }));
}

export async function createProjectRecurrence(
  auth: AuthContext,
  projectIdOrCode: string | number,
  input: CreateRecurrenceRuleInput,
): Promise<RecurrenceRuleView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  const db = getDb();

  const task = await db
    .selectFrom('tasks')
    .select(['id'])
    .where('id', '=', input.templateTaskId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc gốc trong dự án.', 404);
  }

  const res = await db
    .insertInto('task_recurrence_rules')
    .values({
      project_id: ctx.project.id,
      template_task_id: input.templateTaskId,
      frequency: input.frequency,
      interval_value: input.intervalValue,
      weekdays_json: input.weekdays ? JSON.stringify(input.weekdays) : null,
      day_of_month: input.dayOfMonth ?? null,
      next_run_date: input.nextRunDate,
      end_date: input.endDate ?? null,
      is_active: 1,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .executeTakeFirstOrThrow();

  const list = await listProjectRecurrences(auth, ctx.project.id);
  return list.find((r) => r.id === Number(res.insertId))!;
}

export async function updateProjectRecurrence(
  auth: AuthContext,
  projectIdOrCode: string | number,
  ruleId: number,
  input: UpdateRecurrenceRuleInput,
): Promise<RecurrenceRuleView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  const db = getDb();

  const existing = await db
    .selectFrom('task_recurrence_rules')
    .select(['id'])
    .where('id', '=', ruleId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('RECURRENCE_NOT_FOUND', 'Không tìm thấy lịch lặp công việc.', 404);
  }

  await db
    .updateTable('task_recurrence_rules')
    .set({
      ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
      ...(input.intervalValue !== undefined ? { interval_value: input.intervalValue } : {}),
      ...(input.nextRunDate !== undefined ? { next_run_date: input.nextRunDate } : {}),
      ...(input.endDate !== undefined ? { end_date: input.endDate } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive ? 1 : 0 } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', ruleId)
    .execute();

  const list = await listProjectRecurrences(auth, ctx.project.id);
  return list.find((r) => r.id === ruleId)!;
}

function advanceNextRunDate(
  currentIso: string,
  frequency: TaskRecurrenceFrequency,
  intervalValue: number,
): string {
  const base = dayjs(currentIso);
  if (frequency === 'DAILY') {
    return base.add(intervalValue, 'day').format('YYYY-MM-DD');
  }
  if (frequency === 'WEEKLY') {
    return base.add(intervalValue, 'week').format('YYYY-MM-DD');
  }
  return base.add(intervalValue, 'month').format('YYYY-MM-DD');
}

export async function runDueRecurrenceRules(
  auth: AuthContext,
  projectId?: number,
): Promise<{ generatedCount: number }> {
  const db = getDb();
  const todayIso = dayjs().format('YYYY-MM-DD');

  let query = db
    .selectFrom('task_recurrence_rules')
    .selectAll()
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null)
    .where('next_run_date', '<=', todayIso);

  if (projectId) {
    await assertProjectAccess(auth, projectId, 'MANAGE');
    query = query.where('project_id', '=', projectId);
  }

  const dueRules = await query.execute();
  let generatedCount = 0;

  for (const rule of dueRules) {
    const templateTask = await db
      .selectFrom('tasks')
      .selectAll()
      .where('id', '=', Number(rule.template_task_id))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!templateTask) {
      continue;
    }

    const runIso = toIsoDate(rule.next_run_date);
    await createTask(
      auth,
      {
        projectId: Number(rule.project_id),
        title: `${templateTask.title} (${runIso})`,
        description: templateTask.description,
        taskType: templateTask.task_type,
        priority: templateTask.priority,
        startDate: runIso,
        dueDate: runIso,
        estimatedHours: Number(templateTask.estimated_hours) || 2,
        assigneeEmployeeIds: [],
        watcherEmployeeIds: [],
        labelIds: [],
      },
      null,
    );

    const nextDate = advanceNextRunDate(runIso, rule.frequency, Number(rule.interval_value));
    const endIso = rule.end_date ? toIsoDate(rule.end_date) : null;
    const shouldStayActive = !endIso || nextDate <= endIso;

    await db
      .updateTable('task_recurrence_rules')
      .set({
        next_run_date: nextDate,
        is_active: shouldStayActive ? 1 : 0,
        updated_by: auth.userId,
      })
      .where('id', '=', Number(rule.id))
      .execute();

    generatedCount += 1;
  }

  return { generatedCount };
}
