import { getDb, type ApproverType } from '@/config/database';
import type { WorkflowConditionRule } from '@/lib/portable/approval-engine';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { CreateWorkflowInput, UpdateWorkflowInput } from '@/modules/approvals/approvals.schema';
import { AppError } from '@/shared/api-response';

export interface WorkflowStepView {
  id: number;
  stepOrder: number;
  approverType: ApproverType;
  approverRoleId: number | null;
  approverRoleName: string | null;
  approverRoleNameEn: string | null;
  approverUserId: number | null;
  approverUserName: string | null;
}

export interface WorkflowItem {
  id: number;
  moduleCode: string;
  requestType: string;
  branchId: number | null;
  branchName: string | null;
  branchNameEn: string | null;
  name: string;
  nameEn: string | null;
  description: string | null;
  conditions: WorkflowConditionRule | null;
  isActive: boolean;
  steps: WorkflowStepView[];
  createdAt: string;
}

function parseConditions(raw: unknown): WorkflowConditionRule | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as WorkflowConditionRule;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as WorkflowConditionRule;
  }
  return null;
}

async function fetchStepsByWorkflowIds(
  workflowIds: number[],
): Promise<Map<number, WorkflowStepView[]>> {
  const map = new Map<number, WorkflowStepView[]>();
  if (workflowIds.length === 0) {
    return map;
  }

  const db = getDb();
  const rows = await db
    .selectFrom('approval_workflow_steps as s')
    .leftJoin('roles as r', 'r.id', 's.approver_role_id')
    .leftJoin('users as u', 'u.id', 's.approver_user_id')
    .select([
      's.id',
      's.workflow_id',
      's.step_order',
      's.approver_type',
      's.approver_role_id',
      'r.name as role_name',
      'r.name_en as role_name_en',
      's.approver_user_id',
      'u.full_name as user_name',
    ])
    .where('s.workflow_id', 'in', workflowIds)
    .orderBy('s.step_order', 'asc')
    .execute();

  for (const row of rows) {
    const wid = Number(row.workflow_id);
    const list = map.get(wid) ?? [];
    list.push({
      id: Number(row.id),
      stepOrder: Number(row.step_order),
      approverType: row.approver_type,
      approverRoleId: row.approver_role_id !== null ? Number(row.approver_role_id) : null,
      approverRoleName: row.role_name ?? null,
      approverRoleNameEn: row.role_name_en ?? null,
      approverUserId: row.approver_user_id !== null ? Number(row.approver_user_id) : null,
      approverUserName: row.user_name ?? null,
    });
    map.set(wid, list);
  }

  return map;
}

async function validateStepReferences(
  steps: Array<{ approverRoleId?: number | null; approverUserId?: number | null }>,
  branchId?: number | null,
): Promise<void> {
  const db = getDb();

  if (branchId) {
    const branch = await db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', branchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!branch) {
      throw new AppError('INVALID_BRANCH', 'Chi nhánh được chọn không tồn tại.', 400);
    }
  }

  const roleIds = Array.from(
    new Set(steps.map((s) => s.approverRoleId).filter((id): id is number => Boolean(id))),
  );
  if (roleIds.length > 0) {
    const foundRoles = await db
      .selectFrom('roles')
      .select(['id'])
      .where('id', 'in', roleIds)
      .where('deleted_at', 'is', null)
      .execute();
    if (foundRoles.length !== roleIds.length) {
      throw new AppError('INVALID_ROLE', 'Một hoặc nhiều vai trò duyệt không tồn tại.', 400);
    }
  }

  const userIds = Array.from(
    new Set(steps.map((s) => s.approverUserId).filter((id): id is number => Boolean(id))),
  );
  if (userIds.length > 0) {
    const foundUsers = await db
      .selectFrom('users')
      .select(['id'])
      .where('id', 'in', userIds)
      .where('status', '=', 'ACTIVE')
      .where('deleted_at', 'is', null)
      .execute();
    if (foundUsers.length !== userIds.length) {
      throw new AppError(
        'INVALID_APPROVER_USER',
        'Người duyệt cụ thể không tồn tại hoặc đang bị khóa.',
        400,
      );
    }
  }
}

export async function listWorkflows(query: {
  moduleCode?: string | null;
  requestType?: string | null;
}): Promise<WorkflowItem[]> {
  const db = getDb();

  let baseQuery = db
    .selectFrom('approval_workflows as w')
    .leftJoin('branches as b', 'b.id', 'w.branch_id')
    .where('w.deleted_at', 'is', null);

  if (query.moduleCode && query.moduleCode.trim().length > 0) {
    baseQuery = baseQuery.where('w.module_code', '=', query.moduleCode.trim());
  }
  if (query.requestType && query.requestType.trim().length > 0) {
    baseQuery = baseQuery.where('w.request_type', '=', query.requestType.trim().toUpperCase());
  }

  const rows = await baseQuery
    .select([
      'w.id',
      'w.module_code',
      'w.request_type',
      'w.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'w.name',
      'w.name_en',
      'w.description',
      'w.conditions_json',
      'w.is_active',
      'w.created_at',
    ])
    .orderBy('w.module_code', 'asc')
    .orderBy('w.request_type', 'asc')
    .orderBy('w.id', 'desc')
    .execute();

  const ids = rows.map((r) => Number(r.id));
  const stepsMap = await fetchStepsByWorkflowIds(ids);

  return rows.map((row) => {
    const id = Number(row.id);
    return {
      id,
      moduleCode: row.module_code,
      requestType: row.request_type,
      branchId: row.branch_id !== null ? Number(row.branch_id) : null,
      branchName: row.branch_name ?? null,
      branchNameEn: row.branch_name_en ?? null,
      name: row.name,
      nameEn: row.name_en ?? null,
      description: row.description,
      conditions: parseConditions(row.conditions_json),
      isActive: Boolean(row.is_active),
      steps: stepsMap.get(id) ?? [],
      createdAt: new Date(row.created_at).toISOString(),
    };
  });
}

export async function createWorkflow(
  input: CreateWorkflowInput,
  actorId: number,
  ipAddress: string | null,
): Promise<WorkflowItem> {
  const db = getDb();
  await validateStepReferences(input.steps, input.branchId);

  const createdId = await db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('approval_workflows')
      .values({
        module_code: input.moduleCode,
        request_type: input.requestType,
        branch_id: input.branchId ?? null,
        name: input.name,
        name_en: input.nameEn?.trim() || null,
        description: input.description ?? null,
        conditions_json: input.conditions ? JSON.stringify(input.conditions) : null,
        is_active: input.isActive ? 1 : 0,
        created_by: actorId,
        updated_by: actorId,
      })
      .executeTakeFirstOrThrow();

    const workflowId = Number(inserted.insertId);
    for (let idx = 0; idx < input.steps.length; idx += 1) {
      const step = input.steps[idx];
      await trx
        .insertInto('approval_workflow_steps')
        .values({
          workflow_id: workflowId,
          step_order: idx + 1,
          approver_type: step.approverType,
          approver_role_id: step.approverRoleId ?? null,
          approver_user_id: step.approverUserId ?? null,
        })
        .execute();
    }

    return workflowId;
  });

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'WORKFLOW_CREATE',
    entityType: 'approval_workflows',
    entityId: createdId,
    newValues: { name: input.name, moduleCode: input.moduleCode, requestType: input.requestType },
    ipAddress,
  });

  const all = await listWorkflows({});
  const found = all.find((w) => w.id === createdId);
  if (!found) {
    throw new AppError('WORKFLOW_NOT_FOUND', 'Không thể đọc lại quy trình vừa tạo.', 500);
  }
  return found;
}

export async function updateWorkflow(
  workflowId: number,
  input: UpdateWorkflowInput,
  actorId: number,
  ipAddress: string | null,
): Promise<WorkflowItem> {
  const db = getDb();

  const existing = await db
    .selectFrom('approval_workflows')
    .select([
      'id',
      'module_code',
      'request_type',
      'branch_id',
      'name',
      'name_en',
      'description',
      'conditions_json',
      'is_active',
    ])
    .where('id', '=', workflowId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('WORKFLOW_NOT_FOUND', 'Không tìm thấy quy trình phê duyệt.', 404);
  }

  const nextBranchId = input.branchId !== undefined ? input.branchId : existing.branch_id;
  if (input.steps) {
    await validateStepReferences(input.steps, nextBranchId);
  } else if (input.branchId) {
    await validateStepReferences([], input.branchId);
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('approval_workflows')
      .set({
        module_code: input.moduleCode ?? existing.module_code,
        request_type: input.requestType ?? existing.request_type,
        branch_id: nextBranchId ?? null,
        name: input.name ?? existing.name,
        name_en: input.nameEn !== undefined ? input.nameEn?.trim() || null : existing.name_en,
        description: input.description !== undefined ? input.description : existing.description,
        conditions_json:
          input.conditions !== undefined
            ? input.conditions
              ? JSON.stringify(input.conditions)
              : null
            : existing.conditions_json,
        is_active:
          input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
        updated_by: actorId,
      })
      .where('id', '=', workflowId)
      .execute();

    if (input.steps) {
      await trx
        .deleteFrom('approval_workflow_steps')
        .where('workflow_id', '=', workflowId)
        .execute();

      for (let idx = 0; idx < input.steps.length; idx += 1) {
        const step = input.steps[idx];
        await trx
          .insertInto('approval_workflow_steps')
          .values({
            workflow_id: workflowId,
            step_order: idx + 1,
            approver_type: step.approverType,
            approver_role_id: step.approverRoleId ?? null,
            approver_user_id: step.approverUserId ?? null,
          })
          .execute();
      }
    }
  });

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'WORKFLOW_UPDATE',
    entityType: 'approval_workflows',
    entityId: workflowId,
    oldValues: { name: existing.name, isActive: Boolean(existing.is_active) },
    newValues: { name: input.name ?? existing.name, isActive: input.isActive ?? Boolean(existing.is_active) },
    ipAddress,
  });

  const all = await listWorkflows({});
  const found = all.find((w) => w.id === workflowId);
  if (!found) {
    throw new AppError('WORKFLOW_NOT_FOUND', 'Không tìm thấy quy trình sau khi cập nhật.', 404);
  }
  return found;
}

export async function softDeleteWorkflow(
  workflowId: number,
  actorId: number,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();

  const existing = await db
    .selectFrom('approval_workflows')
    .select(['id', 'name'])
    .where('id', '=', workflowId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('WORKFLOW_NOT_FOUND', 'Không tìm thấy quy trình phê duyệt.', 404);
  }

  await db
    .updateTable('approval_workflows')
    .set({ deleted_at: new Date(), is_active: 0, updated_by: actorId })
    .where('id', '=', workflowId)
    .execute();

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'WORKFLOW_DELETE',
    entityType: 'approval_workflows',
    entityId: workflowId,
    oldValues: { name: existing.name },
    ipAddress,
  });
}
