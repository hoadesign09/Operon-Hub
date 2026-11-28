import type { Kysely, Transaction } from 'kysely';
import {
  getDb,
  type ApprovalHistoryAction,
  type ApprovalRequestStatus,
  type DatabaseSchema,
} from '@/config/database';
import { dispatchApprovalCompletionHook } from '@/modules/approvals/approval-hooks';
import {
  computeApprovalTransition,
  evaluateWorkflowConditions,
  type ApprovalActionType,
  type WorkflowConditionRule,
  type WorkflowEvalContext,
} from '@/lib/portable/approval-engine';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { resolveEmployeeAccessScope } from '@/modules/hrm/employees/employees.scope';
import {
  createNotification,
  createNotificationsForRole,
} from '@/modules/notifications/notifications.service';
import { AppError } from '@/shared/api-response';

export interface CreateApprovalRequestInput {
  moduleCode: string;
  requestType: string;
  entityType: string;
  entityId: number;
  branchId?: number | null;
  requesterId: number;
  directManagerUserId?: number | null;
  title: string;
  summary?: string | null;
  evalContext?: WorkflowEvalContext;
}

export interface ApprovalRequestItem {
  id: number;
  workflowId: number;
  moduleCode: string;
  requestType: string;
  entityType: string;
  entityId: number;
  branchId: number | null;
  requesterId: number;
  requesterName: string | null;
  title: string;
  summary: string | null;
  currentStep: number;
  totalSteps: number;
  currentApproverUserId: number | null;
  currentApproverRoleId: number | null;
  currentApproverRoleName: string | null;
  currentApproverRoleNameEn?: string | null;
  status: ApprovalRequestStatus;
  submittedAt: string;
  completedAt: string | null;
}

export interface ApprovalHistoryView {
  id: number;
  stepOrder: number;
  actorId: number;
  actorName: string | null;
  action: ApprovalHistoryAction;
  comment: string | null;
  actedAt: string;
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
  return typeof raw === 'object' ? (raw as WorkflowConditionRule) : null;
}

function resolveStepAssignee(
  step: {
    approver_type: 'DIRECT_MANAGER' | 'ROLE' | 'SPECIFIC_USER';
    approver_role_id: number | null;
    approver_user_id: number | null;
  },
  directManagerUserId?: number | null,
): { approverUserId: number | null; approverRoleId: number | null } {
  if (step.approver_type === 'SPECIFIC_USER') {
    return {
      approverUserId: step.approver_user_id !== null ? Number(step.approver_user_id) : null,
      approverRoleId: null,
    };
  }
  if (step.approver_type === 'DIRECT_MANAGER' && directManagerUserId) {
    return {
      approverUserId: directManagerUserId,
      approverRoleId: null,
    };
  }
  return {
    approverUserId: null,
    approverRoleId: step.approver_role_id !== null ? Number(step.approver_role_id) : null,
  };
}

async function notifyStepApprovers(input: {
  approverUserId: number | null;
  approverRoleId: number | null;
  branchId: number | null;
  requesterId: number;
  moduleCode: string;
  title: string;
  stepOrder: number;
}): Promise<void> {
  const linkUrl = '/approvals';
  const notifTitle = `Yêu cầu cần duyệt (Bước ${input.stepOrder})`;
  const notifMessage = `Bạn có yêu cầu mới chờ phê duyệt: "${input.title}".`;

  if (input.approverUserId) {
    await createNotification({
      userId: input.approverUserId,
      moduleCode: input.moduleCode,
      type: 'APPROVAL_PENDING',
      title: notifTitle,
      message: notifMessage,
      linkUrl,
    });
    return;
  }

  if (input.approverRoleId) {
    await createNotificationsForRole({
      roleId: input.approverRoleId,
      branchId: input.branchId,
      excludeUserId: input.requesterId,
      moduleCode: input.moduleCode,
      type: 'APPROVAL_PENDING',
      title: notifTitle,
      message: notifMessage,
      linkUrl,
    });
  }
}

export async function createApprovalRequest(
  input: CreateApprovalRequestInput,
  externalTrx?: Transaction<DatabaseSchema>,
): Promise<{ approvalRequestId: number; workflowId: number; totalSteps: number }> {
  const executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema> = externalTrx ?? getDb();

  const workflows = await executor
    .selectFrom('approval_workflows')
    .select(['id', 'branch_id', 'conditions_json'])
    .where('module_code', '=', input.moduleCode)
    .where('request_type', '=', input.requestType.toUpperCase())
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null)
    .where((eb) =>
      input.branchId
        ? eb.or([eb('branch_id', '=', input.branchId), eb('branch_id', 'is', null)])
        : eb('branch_id', 'is', null),
    )
    .orderBy('branch_id', 'desc')
    .orderBy('id', 'asc')
    .execute();

  const matchedWorkflow = workflows.find((wf) =>
    evaluateWorkflowConditions(parseConditions(wf.conditions_json), input.evalContext),
  );

  if (!matchedWorkflow) {
    throw new AppError(
      'WORKFLOW_NOT_FOUND',
      `Chưa cấu hình quy trình duyệt đang hoạt động cho "${input.moduleCode}/${input.requestType}".`,
      400,
    );
  }

  const workflowId = Number(matchedWorkflow.id);
  const steps = await executor
    .selectFrom('approval_workflow_steps')
    .select(['step_order', 'approver_type', 'approver_role_id', 'approver_user_id'])
    .where('workflow_id', '=', workflowId)
    .orderBy('step_order', 'asc')
    .execute();

  if (steps.length === 0) {
    throw new AppError('WORKFLOW_NO_STEPS', 'Quy trình duyệt chưa có bước phê duyệt nào.', 400);
  }

  const firstAssignee = resolveStepAssignee(steps[0], input.directManagerUserId);

  const insertInside = async (trx: Transaction<DatabaseSchema>): Promise<number> => {
    const inserted = await trx
      .insertInto('approval_requests')
      .values({
        workflow_id: workflowId,
        module_code: input.moduleCode,
        request_type: input.requestType.toUpperCase(),
        entity_type: input.entityType,
        entity_id: input.entityId,
        branch_id: input.branchId ?? null,
        requester_id: input.requesterId,
        title: input.title,
        summary: input.summary ?? null,
        current_step: 1,
        total_steps: steps.length,
        current_approver_user_id: firstAssignee.approverUserId,
        current_approver_role_id: firstAssignee.approverRoleId,
        status: 'PENDING',
      })
      .executeTakeFirstOrThrow();

    const createdId = Number(inserted.insertId);
    await trx
      .insertInto('approval_histories')
      .values({
        approval_request_id: createdId,
        step_order: 1,
        actor_id: input.requesterId,
        action: 'SUBMIT',
        comment: 'Gửi yêu cầu phê duyệt',
      })
      .execute();

    return createdId;
  };

  const requestId = externalTrx
    ? await insertInside(externalTrx)
    : await getDb().transaction().execute(insertInside);

  if (!externalTrx) {
    await notifyStepApprovers({
      approverUserId: firstAssignee.approverUserId,
      approverRoleId: firstAssignee.approverRoleId,
      branchId: input.branchId ?? null,
      requesterId: input.requesterId,
      moduleCode: input.moduleCode,
      title: input.title,
      stepOrder: 1,
    });
  }

  return { approvalRequestId: requestId, workflowId, totalSteps: steps.length };
}

export async function notifyApprovalRequestCreated(approvalRequestId: number): Promise<void> {
  const db = getDb();
  const row = await db
    .selectFrom('approval_requests')
    .select([
      'module_code',
      'branch_id',
      'requester_id',
      'title',
      'current_step',
      'current_approver_user_id',
      'current_approver_role_id',
    ])
    .where('id', '=', approvalRequestId)
    .executeTakeFirst();
  if (!row) {
    return;
  }
  await notifyStepApprovers({
    approverUserId:
      row.current_approver_user_id !== null ? Number(row.current_approver_user_id) : null,
    approverRoleId:
      row.current_approver_role_id !== null ? Number(row.current_approver_role_id) : null,
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    requesterId: Number(row.requester_id),
    moduleCode: row.module_code,
    title: row.title,
    stepOrder: Number(row.current_step),
  });
}

export function canUserActOnApproval(
  request: {
    requesterId: number;
    currentApproverUserId: number | null;
    currentApproverRoleId: number | null;
    branchId?: number | null;
    requesterDepartmentId?: number | null;
  },
  actor: Pick<AuthContext, 'userId' | 'isSuperAdmin' | 'roles'> & {
    permissions?: readonly string[];
    hasAllBranches?: boolean;
    branchIds?: readonly number[];
    departmentIds?: readonly number[];
  },
  action: ApprovalActionType,
): boolean {
  if (action === 'CANCEL') {
    return actor.isSuperAdmin || request.requesterId === actor.userId;
  }
  if (actor.isSuperAdmin) {
    return true;
  }
  // Prevent self-approval on APPROVE / REJECT
  if (request.requesterId === actor.userId) {
    return false;
  }
  // Enforce core.approvals.act when full AuthContext permissions are provided
  if (actor.permissions && !actor.permissions.includes('core.approvals.act')) {
    return false;
  }
  // If a specific approver user is assigned (SPECIFIC_USER or resolved DIRECT_MANAGER),
  // ONLY that exact user may act — do NOT fall through to currentApproverRoleId.
  if (request.currentApproverUserId !== null) {
    return request.currentApproverUserId === actor.userId;
  }
  if (request.currentApproverRoleId !== null) {
    const matchingRoles = actor.roles.filter((r) => r.id === request.currentApproverRoleId);
    if (matchingRoles.length === 0) {
      return false;
    }

    // Enforce branch boundary for branch-scoped role assignments
    if (request.branchId !== undefined && request.branchId !== null) {
      const branchAllowed = matchingRoles.some(
        (r) =>
          (r.branchId === null && (r.dataScope === 'ALL' || actor.hasAllBranches !== false)) ||
          r.branchId === request.branchId,
      );
      if (!branchAllowed) {
        return false;
      }
    }

    // Enforce department boundary when every matching role is DEPARTMENT-scoped
    const requiresDeptMatch = matchingRoles.every((r) => r.dataScope === 'DEPARTMENT');
    if (
      requiresDeptMatch &&
      actor.departmentIds !== undefined &&
      request.requesterDepartmentId !== undefined
    ) {
      return (
        request.requesterDepartmentId !== null &&
        actor.departmentIds.includes(request.requesterDepartmentId)
      );
    }

    return true;
  }
  return false;
}

export async function canAuthActOnApproval(
  request: {
    requesterId: number;
    currentApproverUserId: number | null;
    currentApproverRoleId: number | null;
    branchId?: number | null;
    requesterDepartmentId?: number | null;
  },
  auth: AuthContext,
  action: ApprovalActionType,
): Promise<boolean> {
  if (action === 'CANCEL' || auth.isSuperAdmin) {
    return canUserActOnApproval(request, auth, action);
  }
  if (request.requesterId === auth.userId || !auth.permissions.includes('core.approvals.act')) {
    return false;
  }
  if (request.currentApproverUserId !== null) {
    return request.currentApproverUserId === auth.userId;
  }

  let requesterDepartmentId = request.requesterDepartmentId;
  let departmentIds: number[] | undefined;

  if (request.currentApproverRoleId !== null) {
    const matchingRoles = auth.roles.filter((r) => r.id === request.currentApproverRoleId);
    if (matchingRoles.length === 0) {
      return false;
    }
    const requiresDeptMatch = matchingRoles.every((r) => r.dataScope === 'DEPARTMENT');
    if (requiresDeptMatch) {
      const scope = await resolveEmployeeAccessScope(auth);
      departmentIds = scope.departmentIds;
      if (requesterDepartmentId === undefined) {
        const db = getDb();
        const reqEmp = await db
          .selectFrom('employees')
          .select(['department_id'])
          .where('user_id', '=', request.requesterId)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();
        requesterDepartmentId = reqEmp ? Number(reqEmp.department_id) : null;
      }
    }
  }

  return canUserActOnApproval(
    { ...request, requesterDepartmentId },
    { ...auth, departmentIds },
    action,
  );
}

export async function listActionablePendingApprovals(
  auth: AuthContext,
  moduleCode?: string,
  entityType?: string,
): Promise<Array<{ id: number; entityId: number; entityType: string }>> {
  if (!auth.isSuperAdmin && !auth.permissions.includes('core.approvals.act')) {
    return [];
  }

  const db = getDb();
  const roleIds = auth.roles.map((r) => r.id);

  let q = db
    .selectFrom('approval_requests as ar')
    .leftJoin('employees as req_emp', (join) =>
      join.onRef('req_emp.user_id', '=', 'ar.requester_id').on('req_emp.deleted_at', 'is', null),
    )
    .select([
      'ar.id',
      'ar.entity_id',
      'ar.entity_type',
      'ar.branch_id',
      'ar.requester_id',
      'ar.current_approver_user_id',
      'ar.current_approver_role_id',
      'req_emp.department_id as requester_department_id',
    ])
    .where('ar.status', '=', 'PENDING');

  if (moduleCode) {
    q = q.where('ar.module_code', '=', moduleCode);
  }
  if (entityType) {
    q = q.where('ar.entity_type', '=', entityType);
  }
  if (!auth.isSuperAdmin) {
    q = q.where('ar.requester_id', '!=', auth.userId);
    q = q.where((eb) => {
      const conds = [eb('ar.current_approver_user_id', '=', auth.userId)];
      if (roleIds.length > 0) {
        conds.push(
          eb.and([
            eb('ar.current_approver_user_id', 'is', null),
            eb('ar.current_approver_role_id', 'in', roleIds),
          ]),
        );
      }
      return eb.or(conds);
    });
  }

  const rows = await q.execute();
  if (auth.isSuperAdmin) {
    return rows.map((r) => ({
      id: Number(r.id),
      entityId: Number(r.entity_id),
      entityType: r.entity_type,
    }));
  }

  const hasDeptScopedRole = auth.roles.some((r) => r.dataScope === 'DEPARTMENT');
  const departmentIds = hasDeptScopedRole
    ? (await resolveEmployeeAccessScope(auth)).departmentIds
    : undefined;

  const actor = { ...auth, departmentIds };
  return rows
    .filter((r) =>
      canUserActOnApproval(
        {
          requesterId: Number(r.requester_id),
          currentApproverUserId:
            r.current_approver_user_id !== null ? Number(r.current_approver_user_id) : null,
          currentApproverRoleId:
            r.current_approver_role_id !== null ? Number(r.current_approver_role_id) : null,
          branchId: r.branch_id !== null ? Number(r.branch_id) : null,
          requesterDepartmentId:
            r.requester_department_id !== null ? Number(r.requester_department_id) : null,
        },
        actor,
        'APPROVE',
      ),
    )
    .map((r) => ({
      id: Number(r.id),
      entityId: Number(r.entity_id),
      entityType: r.entity_type,
    }));
}

export async function listApprovalInbox(
  auth: AuthContext,
  query: {
    scope?: string | null;
    moduleCode?: string | null;
    status?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: ApprovalRequestItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const scope = query.scope ?? 'pending_my_action';
  const actionablePendingIds = !auth.isSuperAdmin
    ? (await listActionablePendingApprovals(auth, query.moduleCode?.trim() || undefined)).map(
        (x) => x.id,
      )
    : [];

  let baseQuery = db.selectFrom('approval_requests as ar');

  if (scope === 'sent_by_me') {
    baseQuery = baseQuery.where('ar.requester_id', '=', auth.userId);
  } else if (scope === 'pending_my_action') {
    baseQuery = baseQuery.where('ar.status', '=', 'PENDING');
    if (!auth.isSuperAdmin) {
      if (actionablePendingIds.length === 0) {
        return {
          items: [],
          meta: buildPaginationMeta(0, pagination.page, pagination.limit),
        };
      }
      baseQuery = baseQuery.where('ar.id', 'in', actionablePendingIds);
    }
  } else if (!auth.isSuperAdmin) {
    const actedRows = await db
      .selectFrom('approval_histories')
      .select(['approval_request_id'])
      .where('actor_id', '=', auth.userId)
      .distinct()
      .execute();
    const actedIds = actedRows.map((r) => Number(r.approval_request_id));
    const visibleIds = Array.from(new Set([...actionablePendingIds, ...actedIds]));
    baseQuery = baseQuery.where((eb) => {
      const conditions = [eb('ar.requester_id', '=', auth.userId)];
      if (visibleIds.length > 0) {
        conditions.push(eb('ar.id', 'in', visibleIds));
      }
      return eb.or(conditions);
    });
  }

  if (query.moduleCode && query.moduleCode.trim().length > 0) {
    baseQuery = baseQuery.where('ar.module_code', '=', query.moduleCode.trim());
  }
  if (
    query.status &&
    ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(query.status)
  ) {
    baseQuery = baseQuery.where('ar.status', '=', query.status as ApprovalRequestStatus);
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('ar.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .leftJoin('users as req_user', 'req_user.id', 'ar.requester_id')
    .leftJoin('roles as app_role', 'app_role.id', 'ar.current_approver_role_id')
    .select([
      'ar.id',
      'ar.workflow_id',
      'ar.module_code',
      'ar.request_type',
      'ar.entity_type',
      'ar.entity_id',
      'ar.branch_id',
      'ar.requester_id',
      'req_user.full_name as requester_name',
      'ar.title',
      'ar.summary',
      'ar.current_step',
      'ar.total_steps',
      'ar.current_approver_user_id',
      'ar.current_approver_role_id',
      'app_role.name as approver_role_name',
      'app_role.name_en as approver_role_name_en',
      'ar.status',
      'ar.submitted_at',
      'ar.completed_at',
    ])
    .orderBy('ar.submitted_at', 'desc')
    .orderBy('ar.id', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: ApprovalRequestItem[] = rows.map((row) => ({
    id: Number(row.id),
    workflowId: Number(row.workflow_id),
    moduleCode: row.module_code,
    requestType: row.request_type,
    entityType: row.entity_type,
    entityId: Number(row.entity_id),
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    requesterId: Number(row.requester_id),
    requesterName: row.requester_name ?? null,
    title: row.title,
    summary: row.summary,
    currentStep: Number(row.current_step),
    totalSteps: Number(row.total_steps),
    currentApproverUserId:
      row.current_approver_user_id !== null ? Number(row.current_approver_user_id) : null,
    currentApproverRoleId:
      row.current_approver_role_id !== null ? Number(row.current_approver_role_id) : null,
    currentApproverRoleName: row.approver_role_name ?? null,
    currentApproverRoleNameEn: row.approver_role_name_en ?? null,
    status: row.status,
    submittedAt: new Date(row.submitted_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  }));

  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function getApprovalDetailWithHistory(
  requestId: number,
  auth: AuthContext,
): Promise<{
  request: ApprovalRequestItem;
  histories: ApprovalHistoryView[];
  canApproveOrReject: boolean;
  canCancel: boolean;
}> {
  const db = getDb();

  const row = await db
    .selectFrom('approval_requests as ar')
    .leftJoin('users as req_user', 'req_user.id', 'ar.requester_id')
    .leftJoin('roles as app_role', 'app_role.id', 'ar.current_approver_role_id')
    .select([
      'ar.id',
      'ar.workflow_id',
      'ar.module_code',
      'ar.request_type',
      'ar.entity_type',
      'ar.entity_id',
      'ar.branch_id',
      'ar.requester_id',
      'req_user.full_name as requester_name',
      'ar.title',
      'ar.summary',
      'ar.current_step',
      'ar.total_steps',
      'ar.current_approver_user_id',
      'ar.current_approver_role_id',
      'app_role.name as approver_role_name',
      'app_role.name_en as approver_role_name_en',
      'ar.status',
      'ar.submitted_at',
      'ar.completed_at',
    ])
    .where('ar.id', '=', requestId)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('APPROVAL_NOT_FOUND', 'Không tìm thấy yêu cầu phê duyệt.', 404);
  }

  const requestItem: ApprovalRequestItem = {
    id: Number(row.id),
    workflowId: Number(row.workflow_id),
    moduleCode: row.module_code,
    requestType: row.request_type,
    entityType: row.entity_type,
    entityId: Number(row.entity_id),
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    requesterId: Number(row.requester_id),
    requesterName: row.requester_name ?? null,
    title: row.title,
    summary: row.summary,
    currentStep: Number(row.current_step),
    totalSteps: Number(row.total_steps),
    currentApproverUserId:
      row.current_approver_user_id !== null ? Number(row.current_approver_user_id) : null,
    currentApproverRoleId:
      row.current_approver_role_id !== null ? Number(row.current_approver_role_id) : null,
    currentApproverRoleName: row.approver_role_name ?? null,
    currentApproverRoleNameEn: row.approver_role_name_en ?? null,
    status: row.status,
    submittedAt: new Date(row.submitted_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };

  const canActApprove = await canAuthActOnApproval(requestItem, auth, 'APPROVE');
  const canActCancel = canUserActOnApproval(requestItem, auth, 'CANCEL');

  const historyRows = await db
    .selectFrom('approval_histories as h')
    .leftJoin('users as u', 'u.id', 'h.actor_id')
    .select([
      'h.id',
      'h.step_order',
      'h.actor_id',
      'u.full_name as actor_name',
      'h.action',
      'h.comment',
      'h.acted_at',
    ])
    .where('h.approval_request_id', '=', requestId)
    .orderBy('h.acted_at', 'asc')
    .orderBy('h.id', 'asc')
    .execute();

  const participated = historyRows.some((h) => Number(h.actor_id) === auth.userId);
  if (!canActApprove && !canActCancel && !participated) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xem yêu cầu phê duyệt này.', 403);
  }

  return {
    request: requestItem,
    histories: historyRows.map((h) => ({
      id: Number(h.id),
      stepOrder: Number(h.step_order),
      actorId: Number(h.actor_id),
      actorName: h.actor_name ?? null,
      action: h.action,
      comment: h.comment,
      actedAt: new Date(h.acted_at).toISOString(),
    })),
    canApproveOrReject: requestItem.status === 'PENDING' && canActApprove,
    canCancel: requestItem.status === 'PENDING' && canActCancel,
  };
}

export async function actOnApprovalRequest(
  requestId: number,
  actor: AuthContext,
  action: ApprovalActionType,
  comment: string | null | undefined,
  ipAddress: string | null,
): Promise<{ id: number; status: ApprovalRequestStatus; currentStep: number }> {
  const db = getDb();

  const existing = await db
    .selectFrom('approval_requests')
    .select([
      'id',
      'workflow_id',
      'module_code',
      'entity_type',
      'entity_id',
      'branch_id',
      'requester_id',
      'title',
      'current_step',
      'total_steps',
      'current_approver_user_id',
      'current_approver_role_id',
      'status',
    ])
    .where('id', '=', requestId)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('APPROVAL_NOT_FOUND', 'Không tìm thấy yêu cầu phê duyệt.', 404);
  }

  if (existing.status !== 'PENDING') {
    throw new AppError(
      'REQUEST_ALREADY_CLOSED',
      'Yêu cầu này đã được xử lý xong và không thể thao tác thêm.',
      409,
    );
  }

  const allowed = await canAuthActOnApproval(
    {
      requesterId: Number(existing.requester_id),
      branchId: existing.branch_id !== null ? Number(existing.branch_id) : null,
      currentApproverUserId:
        existing.current_approver_user_id !== null
          ? Number(existing.current_approver_user_id)
          : null,
      currentApproverRoleId:
        existing.current_approver_role_id !== null
          ? Number(existing.current_approver_role_id)
          : null,
    },
    actor,
    action,
  );

  if (!allowed) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này trên đơn.', 403);
  }

  const currentStep = Number(existing.current_step);
  const totalSteps = Number(existing.total_steps);
  const transition = computeApprovalTransition(currentStep, totalSteps, action);

  let nextApproverUserId: number | null = null;
  let nextApproverRoleId: number | null = null;

  if (!transition.isCompleted) {
    const nextStepRow = await db
      .selectFrom('approval_workflow_steps')
      .select(['approver_type', 'approver_role_id', 'approver_user_id'])
      .where('workflow_id', '=', Number(existing.workflow_id))
      .where('step_order', '=', transition.nextStep)
      .executeTakeFirst();

    if (nextStepRow) {
      const resolved = resolveStepAssignee(nextStepRow, null);
      nextApproverUserId = resolved.approverUserId;
      nextApproverRoleId = resolved.approverRoleId;
    }
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('approval_requests')
      .set({
        status: transition.nextStatus,
        current_step: transition.nextStep,
        current_approver_user_id: transition.isCompleted ? null : nextApproverUserId,
        current_approver_role_id: transition.isCompleted ? null : nextApproverRoleId,
        completed_at: transition.isCompleted ? new Date() : null,
      })
      .where('id', '=', requestId)
      .execute();

    await trx
      .insertInto('approval_histories')
      .values({
        approval_request_id: requestId,
        step_order: currentStep,
        actor_id: actor.userId,
        action,
        comment: comment?.trim() || null,
      })
      .execute();

    if (transition.isCompleted && transition.nextStatus !== 'PENDING') {
      await dispatchApprovalCompletionHook(trx, {
        approvalRequestId: requestId,
        moduleCode: existing.module_code,
        entityType: existing.entity_type,
        entityId: Number(existing.entity_id),
        nextStatus: transition.nextStatus,
        actorUserId: actor.userId,
        comment: comment?.trim() || null,
      });
    }
  });

  await recordAuditLog({
    userId: actor.userId,
    moduleCode: existing.module_code,
    action: `APPROVAL_${action}`,
    entityType: 'approval_requests',
    entityId: requestId,
    oldValues: { status: existing.status, currentStep },
    newValues: { status: transition.nextStatus, currentStep: transition.nextStep },
    ipAddress,
  });

  if (!transition.isCompleted) {
    await notifyStepApprovers({
      approverUserId: nextApproverUserId,
      approverRoleId: nextApproverRoleId,
      branchId: existing.branch_id !== null ? Number(existing.branch_id) : null,
      requesterId: Number(existing.requester_id),
      moduleCode: existing.module_code,
      title: existing.title,
      stepOrder: transition.nextStep,
    });
  } else if (action !== 'CANCEL') {
    const statusLabel = transition.nextStatus === 'APPROVED' ? 'đã được phê duyệt' : 'đã bị từ chối';
    await createNotification({
      userId: Number(existing.requester_id),
      moduleCode: existing.module_code,
      type: `APPROVAL_${transition.nextStatus}`,
      title: `Kết quả duyệt: ${existing.title}`,
      message: `Yêu cầu "${existing.title}" của bạn ${statusLabel}.${comment ? ` Ghi chú: ${comment}` : ''}`,
      linkUrl: '/approvals',
    });
  }

  return {
    id: requestId,
    status: transition.nextStatus,
    currentStep: transition.nextStep,
  };
}
