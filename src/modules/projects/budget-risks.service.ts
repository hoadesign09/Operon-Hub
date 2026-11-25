import {
  getDb,
  type ProjectBudgetCategory,
  type ProjectBudgetStatus,
  type ProjectRiskItemType,
  type ProjectRiskStatus,
} from '@/config/database';
import { computeProjectEvm, type ProjectEvmMetrics } from '@/lib/portable/agile-metrics';
import { roundCurrency } from '@/lib/portable/currency-utils';
import { createApprovalRequest } from '@/modules/approvals/approvals.service';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import { assertProjectAccess } from '@/modules/projects/projects.access';
import {
  PROJECT_BUDGET_ENTITY_TYPE,
  PROJECT_BUDGET_REQUEST_TYPE,
} from '@/modules/projects/projects.constants';
import type {
  CreateBudgetItemInput,
  CreateRiskInput,
  UpdateBudgetItemInput,
  UpdateRiskInput,
} from '@/modules/projects/projects-advanced.schema';
import { createTask, type TaskDetailView } from '@/modules/projects/tasks.service';
import { syncProjectLaborCost } from '@/modules/projects/timelogs.service';
import { AppError } from '@/shared/api-response';

export interface ProjectBudgetItemView {
  id: number;
  projectId: number;
  category: ProjectBudgetCategory;
  title: string;
  plannedAmount: number;
  actualAmount: number;
  variance: number;
  incurredDate: string | null;
  status: ProjectBudgetStatus;
  approvalRequestId: number | null;
  note: string | null;
}

export interface ProjectBudgetOverview {
  projectId: number;
  plannedBudget: number;
  actualCost: number;
  approvedLaborCost: number;
  totalItemsPlanned: number;
  totalItemsActual: number;
  variance: number;
  evm: ProjectEvmMetrics;
  items: ProjectBudgetItemView[];
}

export interface ProjectRiskItemView {
  id: number;
  projectId: number;
  code: string;
  itemType: ProjectRiskItemType;
  title: string;
  description: string | null;
  probability: number;
  impact: number;
  severityScore: number;
  status: ProjectRiskStatus;
  ownerEmployeeId: number | null;
  ownerName: string | null;
  mitigationPlan: string | null;
  linkedTaskId: number | null;
  linkedTaskKey: string | null;
  identifiedDate: string;
  resolvedAt: string | null;
}

function toIsoDate(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
}

function toIsoDateTime(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : String(val);
}

export async function getProjectBudgetOverview(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<ProjectBudgetOverview> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  if (!ctx.canViewBudget) {
    throw new AppError('BUDGET_VIEW_DENIED', 'Bạn không có quyền xem ngân sách dự án này.', 403);
  }

  const db = getDb();
  const [projectRow, itemRows, laborRows] = await Promise.all([
    db
      .selectFrom('projects')
      .select(['planned_budget', 'actual_cost', 'progress_percent'])
      .where('id', '=', ctx.project.id)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('project_budget_items')
      .selectAll()
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .orderBy('id', 'desc')
      .execute(),
    db
      .selectFrom('task_time_logs')
      .select(['duration_minutes', 'hourly_cost_snapshot'])
      .where('project_id', '=', ctx.project.id)
      .where('approval_status', '=', 'APPROVED')
      .where('deleted_at', 'is', null)
      .execute(),
  ]);

  let approvedLaborCost = 0;
  for (const log of laborRows) {
    approvedLaborCost += (Number(log.duration_minutes) / 60) * Number(log.hourly_cost_snapshot);
  }
  approvedLaborCost = roundCurrency(approvedLaborCost);

  const items: ProjectBudgetItemView[] = itemRows.map((r) => {
    const planned = roundCurrency(Number(r.planned_amount));
    const actual = roundCurrency(Number(r.actual_amount));
    return {
      id: Number(r.id),
      projectId: Number(r.project_id),
      category: r.category,
      title: r.title,
      plannedAmount: planned,
      actualAmount: actual,
      variance: roundCurrency(planned - actual),
      incurredDate: toIsoDate(r.incurred_date),
      status: r.status,
      approvalRequestId: r.approval_request_id ? Number(r.approval_request_id) : null,
      note: r.note,
    };
  });

  const activeItems = items.filter((i) => i.status !== 'CANCELLED');
  const totalItemsPlanned = roundCurrency(
    activeItems.reduce((sum, i) => sum + i.plannedAmount, 0),
  );
  const totalItemsActual = roundCurrency(
    activeItems.reduce((sum, i) => sum + i.actualAmount, 0),
  );

  const plannedBudget = roundCurrency(Number(projectRow.planned_budget));
  const actualCost = roundCurrency(
    Math.max(Number(projectRow.actual_cost), totalItemsActual, approvedLaborCost),
  );

  const evm = computeProjectEvm({
    plannedBudget: plannedBudget > 0 ? plannedBudget : totalItemsPlanned,
    actualCost,
    progressPercent: Number(projectRow.progress_percent),
  });

  return {
    projectId: ctx.project.id,
    plannedBudget,
    actualCost,
    approvedLaborCost,
    totalItemsPlanned,
    totalItemsActual,
    variance: roundCurrency(plannedBudget - actualCost),
    evm,
    items,
  };
}

export async function createBudgetItem(
  auth: AuthContext,
  projectIdOrCode: string | number,
  input: CreateBudgetItemInput,
): Promise<ProjectBudgetOverview> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  if (!auth.isSuperAdmin && !ctx.canEditProject && !hasRequiredPermission(auth, 'pm.budget.manage')) {
    throw new AppError('BUDGET_MANAGE_DENIED', 'Bạn không có quyền quản trị ngân sách dự án.', 403);
  }

  const db = getDb();
  const res = await db
    .insertInto('project_budget_items')
    .values({
      project_id: ctx.project.id,
      category: input.category,
      title: input.title,
      planned_amount: roundCurrency(input.plannedAmount),
      actual_amount: roundCurrency(input.actualAmount),
      incurred_date: input.incurredDate ?? null,
      status: input.status ?? 'PLANNED',
      approval_request_id: null,
      note: input.note ?? null,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .executeTakeFirstOrThrow();

  await syncProjectLaborCost(ctx.project.id, auth.userId);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'CREATE_BUDGET_ITEM',
    entityType: 'project_budget_items',
    entityId: String(res.insertId),
    newValues: { projectId: ctx.project.id, title: input.title, plannedAmount: input.plannedAmount },
  });

  return getProjectBudgetOverview(auth, ctx.project.id);
}

export async function updateBudgetItem(
  auth: AuthContext,
  projectIdOrCode: string | number,
  itemId: number,
  input: UpdateBudgetItemInput,
): Promise<ProjectBudgetOverview> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  const db = getDb();

  const existing = await db
    .selectFrom('project_budget_items')
    .select(['id'])
    .where('id', '=', itemId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('BUDGET_ITEM_NOT_FOUND', 'Không tìm thấy hạng mục ngân sách.', 404);
  }

  await db
    .updateTable('project_budget_items')
    .set({
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.plannedAmount !== undefined
        ? { planned_amount: roundCurrency(input.plannedAmount) }
        : {}),
      ...(input.actualAmount !== undefined
        ? { actual_amount: roundCurrency(input.actualAmount) }
        : {}),
      ...(input.incurredDate !== undefined ? { incurred_date: input.incurredDate } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', itemId)
    .execute();

  await syncProjectLaborCost(ctx.project.id, auth.userId);
  return getProjectBudgetOverview(auth, ctx.project.id);
}

export async function requestBudgetItemApproval(
  auth: AuthContext,
  projectIdOrCode: string | number,
  itemId: number,
): Promise<ProjectBudgetOverview> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'MANAGE');
  const db = getDb();

  const item = await db
    .selectFrom('project_budget_items')
    .selectAll()
    .where('id', '=', itemId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!item) {
    throw new AppError('BUDGET_ITEM_NOT_FOUND', 'Không tìm thấy hạng mục ngân sách.', 404);
  }
  if (item.status === 'PENDING_APPROVAL' || item.status === 'APPROVED') {
    throw new AppError('BUDGET_ALREADY_SUBMITTED', 'Hạng mục ngân sách đã trình duyệt hoặc đã duyệt.', 409);
  }

  const approval = await createApprovalRequest({
    moduleCode: 'projects',
    requestType: PROJECT_BUDGET_REQUEST_TYPE,
    entityType: PROJECT_BUDGET_ENTITY_TYPE,
    entityId: itemId,
    branchId: ctx.project.branchId,
    requesterId: auth.userId,
    title: `Điều chỉnh ngân sách [${ctx.project.code}]: ${item.title}`,
    summary: `Hạng mục ${item.category} — Kế hoạch ${Number(item.planned_amount).toLocaleString('vi-VN')} VNĐ.`,
    evalContext: { amount: Number(item.planned_amount) },
  });

  await db
    .updateTable('project_budget_items')
    .set({
      status: 'PENDING_APPROVAL',
      approval_request_id: approval.approvalRequestId,
      updated_by: auth.userId,
    })
    .where('id', '=', itemId)
    .execute();

  return getProjectBudgetOverview(auth, ctx.project.id);
}

// --- RAID Risks & Issues ---

export async function listProjectRisks(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<ProjectRiskItemView[]> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const db = getDb();

  const rows = await db
    .selectFrom('project_risks as r')
    .leftJoin('employees as e', 'e.id', 'r.owner_employee_id')
    .leftJoin('tasks as t', 't.id', 'r.linked_task_id')
    .select([
      'r.id',
      'r.project_id',
      'r.code',
      'r.item_type',
      'r.title',
      'r.description',
      'r.probability',
      'r.impact',
      'r.severity_score',
      'r.status',
      'r.owner_employee_id',
      'e.full_name as owner_name',
      'r.mitigation_plan',
      'r.linked_task_id',
      't.task_key as linked_task_key',
      'r.identified_date',
      'r.resolved_at',
    ])
    .where('r.project_id', '=', ctx.project.id)
    .where('r.deleted_at', 'is', null)
    .orderBy('r.severity_score', 'desc')
    .orderBy('r.id', 'desc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    projectId: Number(r.project_id),
    code: r.code,
    itemType: r.item_type,
    title: r.title,
    description: r.description,
    probability: Number(r.probability),
    impact: Number(r.impact),
    severityScore: Number(r.severity_score),
    status: r.status,
    ownerEmployeeId: r.owner_employee_id ? Number(r.owner_employee_id) : null,
    ownerName: r.owner_name ?? null,
    mitigationPlan: r.mitigation_plan,
    linkedTaskId: r.linked_task_id ? Number(r.linked_task_id) : null,
    linkedTaskKey: r.linked_task_key ?? null,
    identifiedDate: toIsoDate(r.identified_date) ?? '',
    resolvedAt: toIsoDateTime(r.resolved_at),
  }));
}

export async function createProjectRisk(
  auth: AuthContext,
  projectIdOrCode: string | number,
  input: CreateRiskInput,
): Promise<ProjectRiskItemView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  const existingCount = await db
    .selectFrom('project_risks')
    .select((eb) => eb.fn.count<number>('id').as('cnt'))
    .where('project_id', '=', ctx.project.id)
    .executeTakeFirst();

  const nextSeq = Number(existingCount?.cnt ?? 0) + 1;
  const prefix = input.itemType === 'ISSUE' ? 'ISS' : 'RSK';
  const code = `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  const severityScore = input.probability * input.impact;
  const todayIso = new Date().toISOString().slice(0, 10);

  const res = await db
    .insertInto('project_risks')
    .values({
      project_id: ctx.project.id,
      code,
      item_type: input.itemType,
      title: input.title,
      description: input.description ?? null,
      probability: input.probability,
      impact: input.impact,
      severity_score: severityScore,
      status: 'OPEN',
      owner_employee_id: input.ownerEmployeeId ?? ctx.employeeId,
      mitigation_plan: input.mitigationPlan ?? null,
      linked_task_id: null,
      identified_date: input.identifiedDate ?? todayIso,
      resolved_at: null,
      created_by: auth.userId,
      updated_by: auth.userId,
      deleted_at: null,
    })
    .executeTakeFirstOrThrow();

  const list = await listProjectRisks(auth, ctx.project.id);
  return list.find((r) => r.id === Number(res.insertId))!;
}

export async function updateProjectRisk(
  auth: AuthContext,
  projectIdOrCode: string | number,
  riskId: number,
  input: UpdateRiskInput,
): Promise<ProjectRiskItemView> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  const existing = await db
    .selectFrom('project_risks')
    .selectAll()
    .where('id', '=', riskId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('RISK_NOT_FOUND', 'Không tìm thấy mục rủi ro / vấn đề.', 404);
  }

  const nextProb = input.probability ?? Number(existing.probability);
  const nextImp = input.impact ?? Number(existing.impact);
  const nextResolvedAt =
    input.status === 'RESOLVED' || input.status === 'CLOSED'
      ? new Date()
      : input.status
        ? null
        : existing.resolved_at;

  await db
    .updateTable('project_risks')
    .set({
      ...(input.itemType !== undefined ? { item_type: input.itemType } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      probability: nextProb,
      impact: nextImp,
      severity_score: nextProb * nextImp,
      ...(input.status !== undefined ? { status: input.status, resolved_at: nextResolvedAt } : {}),
      ...(input.ownerEmployeeId !== undefined ? { owner_employee_id: input.ownerEmployeeId } : {}),
      ...(input.mitigationPlan !== undefined ? { mitigation_plan: input.mitigationPlan } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', riskId)
    .execute();

  const list = await listProjectRisks(auth, ctx.project.id);
  return list.find((r) => r.id === riskId)!;
}

export async function convertRiskToActionTask(
  auth: AuthContext,
  projectIdOrCode: string | number,
  riskId: number,
): Promise<{ risk: ProjectRiskItemView; task: TaskDetailView }> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'CONTRIBUTE');
  const db = getDb();

  const risk = await db
    .selectFrom('project_risks')
    .selectAll()
    .where('id', '=', riskId)
    .where('project_id', '=', ctx.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!risk) {
    throw new AppError('RISK_NOT_FOUND', 'Không tìm thấy mục rủi ro / vấn đề.', 404);
  }
  if (risk.linked_task_id) {
    throw new AppError('RISK_ALREADY_LINKED', 'Rủi ro/Vấn đề này đã có công việc khắc phục liên kết.', 409);
  }

  const priority =
    Number(risk.severity_score) >= 15
      ? 'URGENT'
      : Number(risk.severity_score) >= 9
        ? 'HIGH'
        : 'MEDIUM';

  const task = await createTask(
    auth,
    {
      projectId: ctx.project.id,
      title: `[${risk.code}] Khắc phục: ${risk.title}`,
      description: [risk.description, risk.mitigation_plan ? `Phương án xử lý:\n${risk.mitigation_plan}` : '']
        .filter(Boolean)
        .join('\n\n'),
      taskType: risk.item_type === 'ISSUE' ? 'BUG' : 'TASK',
      priority,
      estimatedHours: 4,
      assigneeEmployeeIds: risk.owner_employee_id ? [Number(risk.owner_employee_id)] : [],
      watcherEmployeeIds: [],
      labelIds: [],
    },
    null,
  );

  await db
    .updateTable('project_risks')
    .set({
      linked_task_id: task.id,
      status: risk.status === 'OPEN' ? 'MITIGATING' : risk.status,
      updated_by: auth.userId,
    })
    .where('id', '=', riskId)
    .execute();

  const risks = await listProjectRisks(auth, ctx.project.id);
  return {
    risk: risks.find((r) => r.id === riskId)!,
    task,
  };
}
