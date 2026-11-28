import { sql } from 'kysely';
import {
  getDb,
  type ItRequestKind,
  type ItRequestPriority,
  type ItRequestStatus,
} from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import {
  calculateSlaDeadlines,
  canTransitionItTicketStatus,
  evaluateSlaStatus,
  formatTicketCode,
  shiftSlaDeadlineByMinutes,
  type SlaHealthStatus,
} from '@/lib/portable/sla-calculator';
import {
  createApprovalRequest,
  getApprovalDetailWithHistory,
  listActionablePendingApprovals,
  type ApprovalHistoryView,
  type ApprovalRequestItem,
} from '@/modules/approvals/approvals.service';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  IT_REQUEST_ACCESS_SOFTWARE_TYPE,
  IT_REQUEST_CODE_PREFIX,
  IT_REQUEST_ENTITY_TYPE,
  IT_REQUEST_HARDWARE_TYPE,
  IT_REQUEST_MODULE_CODE,
  IT_REQUEST_PERMISSIONS,
  IT_REQUEST_TERMINAL_STATUSES,
} from '@/modules/it-requests/it-requests.constants';
import type {
  AssignItRequestInput,
  CreateItCategoryInput,
  CreateItRequestInput,
  TransitionItRequestStatusInput,
  UpdateItCategoryInput,
  UpdateItRequestInput,
} from '@/modules/it-requests/it-requests.schema';
import {
  createNotification,
  createNotificationsForRole,
} from '@/modules/notifications/notifications.service';
import { AppError } from '@/shared/api-response';

export interface ItCategoryView {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  requestKind: ItRequestKind;
  requiresApproval: boolean;
  defaultPriority: ItRequestPriority;
  slaResponseHours: number;
  slaResolutionHours: number;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AssignableItStaffView {
  id: number;
  fullName: string;
  email: string;
  departmentName: string | null;
  openTicketCount: number;
}

export interface ItRequestSlaView {
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  pausedAt: string | null;
  pausedMinutes: number;
  responseStatus: SlaHealthStatus;
  resolutionStatus: SlaHealthStatus;
  remainingMinutes: number | null;
  overdueMinutes: number;
}

export interface ItRequestListItem {
  id: number;
  code: string;
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  categoryNameEn: string | null;
  categoryColor: string;
  requiresApproval: boolean;
  requestKind: ItRequestKind;
  title: string;
  priority: ItRequestPriority;
  status: ItRequestStatus;
  requesterUserId: number;
  requesterName: string;
  branchId: number | null;
  branchName: string | null;
  branchNameEn: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  assetId: number | null;
  assetCode: string | null;
  assetName: string | null;
  assignedToUserId: number | null;
  assignedToName: string | null;
  estimatedCost: number;
  approvalRequestId: number | null;
  sla: ItRequestSlaView;
  satisfactionRating: number | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItChecklistItemView {
  id: number;
  itRequestId: number;
  title: string;
  note: string | null;
  isDone: boolean;
  doneByUserId: number | null;
  doneByName: string | null;
  doneAt: string | null;
  sortOrder: number;
}

export interface ItActivityView {
  id: number;
  actorUserId: number | null;
  actorName: string | null;
  action: string;
  summary: string;
  createdAt: string;
}

export interface ItRequestActionsView {
  canEdit: boolean;
  canDelete: boolean;
  canSubmit: boolean;
  canAssign: boolean;
  canStartWork: boolean;
  canWaitUser: boolean;
  canResumeWork: boolean;
  canResolve: boolean;
  canReopen: boolean;
  canClose: boolean;
  canCancel: boolean;
  canComment: boolean;
  canPostInternalNote: boolean;
  canUploadAttachment: boolean;
  canManageChecklist: boolean;
  canExportPdf: boolean;
}

export interface ItApprovalDetailView {
  request: ApprovalRequestItem;
  histories: ApprovalHistoryView[];
  canApproveOrReject: boolean;
  canCancel: boolean;
}

export interface ItRequestDetailView extends ItRequestListItem {
  description: string;
  locationDetail: string | null;
  contactPhone: string | null;
  assetSerialNumber: string | null;
  assetCategory: string | null;
  resolutionSummary: string | null;
  rejectionReason: string | null;
  satisfactionFeedback: string | null;
  checklist: ItChecklistItemView[];
  activities: ItActivityView[];
  approval: ItApprovalDetailView | null;
  actions: ItRequestActionsView;
}

export interface ListItRequestsQuery {
  scope?: string;
  status?: string;
  priority?: string;
  requestKind?: string;
  categoryId?: number;
  branchId?: number;
  assignedToUserId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ItRequestsSummaryView {
  total: number;
  draftCount: number;
  pendingApprovalCount: number;
  openCount: number;
  inProgressCount: number;
  waitingUserCount: number;
  resolvedCount: number;
  closedCount: number;
  unassignedCount: number;
  assignedToMeCount: number;
  pendingMyApprovalCount: number;
  slaBreachedCount: number;
  slaAtRiskCount: number;
  avgSatisfactionRating: number | null;
}

function isItManager(auth: AuthContext): boolean {
  return auth.isSuperAdmin || auth.permissions.includes(IT_REQUEST_PERMISSIONS.MANAGE);
}

function isTerminalStatus(status: ItRequestStatus): boolean {
  return (IT_REQUEST_TERMINAL_STATUSES as readonly string[]).includes(status);
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function resolveItWorkflowRequestType(kind: ItRequestKind): string {
  return kind === 'HARDWARE_PROVISION' ? IT_REQUEST_HARDWARE_TYPE : IT_REQUEST_ACCESS_SOFTWARE_TYPE;
}

export function computeTicketSlaView(row: {
  status: ItRequestStatus;
  submitted_at: Date | null;
  created_at: Date;
  sla_response_due_at: Date | null;
  sla_resolution_due_at: Date | null;
  first_responded_at: Date | null;
  sla_paused_at: Date | null;
  sla_paused_minutes: number;
  resolved_at: Date | null;
}): ItRequestSlaView {
  const isPaused =
    row.status === 'WAITING_USER' ||
    row.status === 'PENDING_APPROVAL' ||
    row.status === 'DRAFT' ||
    row.sla_paused_at !== null;
  const startedAt = row.submitted_at ?? row.created_at;

  const responseEval = evaluateSlaStatus({
    dueAt: row.sla_response_due_at,
    completedAt: row.first_responded_at ?? row.resolved_at,
    startedAt,
    isPaused: isPaused && !row.first_responded_at,
  });

  const resolutionEval = evaluateSlaStatus({
    dueAt: row.sla_resolution_due_at,
    completedAt: row.resolved_at,
    startedAt,
    isPaused: isPaused && !row.resolved_at,
  });

  return {
    responseDueAt: toIsoOrNull(row.sla_response_due_at),
    resolutionDueAt: toIsoOrNull(row.sla_resolution_due_at),
    firstRespondedAt: toIsoOrNull(row.first_responded_at),
    pausedAt: toIsoOrNull(row.sla_paused_at),
    pausedMinutes: Number(row.sla_paused_minutes ?? 0),
    responseStatus: responseEval.status,
    resolutionStatus: resolutionEval.status,
    remainingMinutes: resolutionEval.remainingMinutes,
    overdueMinutes: resolutionEval.overdueMinutes,
  };
}

async function getUserEmployeeContext(userId: number): Promise<{
  employeeId: number | null;
  branchId: number | null;
  departmentId: number | null;
  directManagerUserId: number | null;
}> {
  const db = getDb();
  const row = await db
    .selectFrom('employees as e')
    .leftJoin('employees as mgr', (join) =>
      join.onRef('mgr.id', '=', 'e.manager_id').on('mgr.deleted_at', 'is', null),
    )
    .select([
      'e.id as employee_id',
      'e.branch_id',
      'e.department_id',
      'mgr.user_id as manager_user_id',
    ])
    .where('e.user_id', '=', userId)
    .where('e.deleted_at', 'is', null)
    .executeTakeFirst();

  return {
    employeeId: row ? Number(row.employee_id) : null,
    branchId: row?.branch_id ? Number(row.branch_id) : null,
    departmentId: row?.department_id ? Number(row.department_id) : null,
    directManagerUserId: row?.manager_user_id ? Number(row.manager_user_id) : null,
  };
}

async function notifyItSupportTeam(params: {
  branchId?: number | null;
  excludeUserId?: number;
  title: string;
  message: string;
  linkUrl: string;
}): Promise<void> {
  const db = getDb();
  const roles = await db
    .selectFrom('roles')
    .select(['id'])
    .where('code', 'in', ['IT_SUPPORT', 'ADMIN_OPS'])
    .where('deleted_at', 'is', null)
    .execute();

  for (const role of roles) {
    await createNotificationsForRole({
      roleId: Number(role.id),
      branchId: params.branchId ?? null,
      excludeUserId: params.excludeUserId,
      moduleCode: IT_REQUEST_MODULE_CODE,
      type: 'IT_REQUEST_QUEUE',
      title: params.title,
      message: params.message,
      linkUrl: params.linkUrl,
    });
  }
}

async function generateNextItRequestCode(): Promise<string> {
  const db = getDb();
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `${IT_REQUEST_CODE_PREFIX}-${yearMonth}-`;

  const latest = await db
    .selectFrom('it_requests')
    .select(['code'])
    .where('code', 'like', `${prefix}%`)
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirst();

  let seq = 1;
  if (latest?.code) {
    const rawSeq = Number(latest.code.slice(prefix.length));
    if (Number.isFinite(rawSeq) && rawSeq > 0) {
      seq = rawSeq + 1;
    }
  }
  return formatTicketCode(IT_REQUEST_CODE_PREFIX, yearMonth, seq);
}

// ============================================================
// 1. CATEGORIES MANAGEMENT
// ============================================================

export async function listItCategories(includeInactive = false): Promise<ItCategoryView[]> {
  const db = getDb();
  let query = db
    .selectFrom('it_request_categories')
    .select([
      'id',
      'code',
      'name',
      'name_en',
      'description',
      'request_kind',
      'requires_approval',
      'default_priority',
      'sla_response_hours',
      'sla_resolution_hours',
      'color',
      'sort_order',
      'is_active',
    ])
    .where('deleted_at', 'is', null)
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc');

  if (!includeInactive) {
    query = query.where('is_active', '=', 1);
  }

  const rows = await query.execute();
  return rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    name: r.name,
    nameEn: r.name_en ?? null,
    description: r.description ?? null,
    requestKind: r.request_kind,
    requiresApproval: Number(r.requires_approval) === 1,
    defaultPriority: r.default_priority,
    slaResponseHours: Number(r.sla_response_hours),
    slaResolutionHours: Number(r.sla_resolution_hours),
    color: r.color,
    sortOrder: Number(r.sort_order),
    isActive: Number(r.is_active) === 1,
  }));
}

export async function createItCategory(
  auth: AuthContext,
  input: CreateItCategoryInput,
): Promise<ItCategoryView> {
  const db = getDb();
  const existing = await db
    .selectFrom('it_request_categories')
    .select(['id'])
    .where('code', '=', input.code)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (existing) {
    throw new AppError('DUPLICATE_CATEGORY_CODE', `Mã danh mục "${input.code}" đã tồn tại.`, 409);
  }

  const inserted = await db
    .insertInto('it_request_categories')
    .values({
      code: input.code,
      name: input.name,
      name_en: input.nameEn ?? null,
      description: input.description ?? null,
      request_kind: input.requestKind,
      requires_approval: input.requiresApproval ? 1 : 0,
      default_priority: input.defaultPriority,
      sla_response_hours: input.slaResponseHours,
      sla_resolution_hours: input.slaResolutionHours,
      color: input.color,
      sort_order: input.sortOrder,
      is_active: input.isActive ? 1 : 0,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: IT_REQUEST_MODULE_CODE,
    action: 'CREATE_CATEGORY',
    entityType: 'it_request_categories',
    entityId: Number(inserted.insertId),
    newValues: input,
  });

  const all = await listItCategories(true);
  const created = all.find((c) => c.id === Number(inserted.insertId));
  if (!created) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không thể đọc danh mục vừa tạo.', 500);
  }
  return created;
}

export async function updateItCategory(
  auth: AuthContext,
  categoryId: number,
  input: UpdateItCategoryInput,
): Promise<ItCategoryView> {
  const db = getDb();
  const existing = await db
    .selectFrom('it_request_categories')
    .select(['id', 'sla_response_hours', 'sla_resolution_hours'])
    .where('id', '=', categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục hỗ trợ IT.', 404);
  }

  const nextResponse = input.slaResponseHours ?? Number(existing.sla_response_hours);
  const nextResolution = input.slaResolutionHours ?? Number(existing.sla_resolution_hours);
  if (nextResolution < nextResponse) {
    throw new AppError(
      'INVALID_SLA_RANGE',
      'Thời gian SLA xử lý phải lớn hơn hoặc bằng SLA phản hồi.',
      400,
    );
  }

  await db
    .updateTable('it_request_categories')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nameEn !== undefined ? { name_en: input.nameEn } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.requestKind !== undefined ? { request_kind: input.requestKind } : {}),
      ...(input.requiresApproval !== undefined
        ? { requires_approval: input.requiresApproval ? 1 : 0 }
        : {}),
      ...(input.defaultPriority !== undefined ? { default_priority: input.defaultPriority } : {}),
      ...(input.slaResponseHours !== undefined ? { sla_response_hours: input.slaResponseHours } : {}),
      ...(input.slaResolutionHours !== undefined
        ? { sla_resolution_hours: input.slaResolutionHours }
        : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive ? 1 : 0 } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', categoryId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: IT_REQUEST_MODULE_CODE,
    action: 'UPDATE_CATEGORY',
    entityType: 'it_request_categories',
    entityId: categoryId,
    newValues: input,
  });

  const all = await listItCategories(true);
  const updated = all.find((c) => c.id === categoryId);
  if (!updated) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục sau cập nhật.', 404);
  }
  return updated;
}

export async function deleteItCategory(auth: AuthContext, categoryId: number): Promise<void> {
  const db = getDb();
  const existing = await db
    .selectFrom('it_request_categories')
    .select(['id', 'code'])
    .where('id', '=', categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục hỗ trợ IT.', 404);
  }

  const activeUsage = await db
    .selectFrom('it_requests')
    .select((eb) => eb.fn.countAll<number>().as('cnt'))
    .where('category_id', '=', categoryId)
    .where('status', 'in', ['PENDING_APPROVAL', 'OPEN', 'IN_PROGRESS', 'WAITING_USER'])
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (Number(activeUsage?.cnt ?? 0) > 0) {
    throw new AppError(
      'CATEGORY_IN_USE',
      'Không thể xóa danh mục đang có yêu cầu IT chờ duyệt hoặc đang xử lý.',
      409,
    );
  }

  await db
    .updateTable('it_request_categories')
    .set({
      is_active: 0,
      deleted_at: new Date(),
      updated_by: auth.userId,
    })
    .where('id', '=', categoryId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: IT_REQUEST_MODULE_CODE,
    action: 'DELETE_CATEGORY',
    entityType: 'it_request_categories',
    entityId: categoryId,
  });
}

// ============================================================
// 2. ASSIGNABLE IT STAFF
// ============================================================

export async function listAssignableItStaff(): Promise<AssignableItStaffView[]> {
  const db = getDb();
  const staffRows = await db
    .selectFrom('users as u')
    .innerJoin('user_roles as ur', 'ur.user_id', 'u.id')
    .innerJoin('roles as r', 'r.id', 'ur.role_id')
    .leftJoin('role_permissions as rp', 'rp.role_id', 'r.id')
    .leftJoin('permissions as p', 'p.id', 'rp.permission_id')
    .leftJoin('employees as e', (join) =>
      join.onRef('e.user_id', '=', 'u.id').on('e.deleted_at', 'is', null),
    )
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .select(['u.id', 'u.full_name', 'u.email', 'd.name as department_name'])
    .where('u.status', '=', 'ACTIVE')
    .where('u.deleted_at', 'is', null)
    .where('r.deleted_at', 'is', null)
    .where((eb) =>
      eb.or([
        eb('r.code', '=', 'SUPER_ADMIN'),
        eb('r.code', '=', 'IT_SUPPORT'),
        eb('p.code', '=', IT_REQUEST_PERMISSIONS.MANAGE),
      ]),
    )
    .distinct()
    .orderBy('u.full_name', 'asc')
    .execute();

  const staffIds = staffRows.map((s) => Number(s.id));
  const openCountMap = new Map<number, number>();
  if (staffIds.length > 0) {
    const counts = await db
      .selectFrom('it_requests')
      .select(['assigned_to_user_id', (eb) => eb.fn.countAll<number>().as('cnt')])
      .where('assigned_to_user_id', 'in', staffIds)
      .where('status', 'in', ['OPEN', 'IN_PROGRESS', 'WAITING_USER'])
      .where('deleted_at', 'is', null)
      .groupBy('assigned_to_user_id')
      .execute();
    for (const c of counts) {
      if (c.assigned_to_user_id !== null) {
        openCountMap.set(Number(c.assigned_to_user_id), Number(c.cnt));
      }
    }
  }

  const dedup = new Map<number, AssignableItStaffView>();
  for (const row of staffRows) {
    const id = Number(row.id);
    if (!dedup.has(id)) {
      dedup.set(id, {
        id,
        fullName: row.full_name,
        email: row.email,
        departmentName: row.department_name ?? null,
        openTicketCount: openCountMap.get(id) ?? 0,
      });
    }
  }
  return Array.from(dedup.values());
}

// ============================================================
// 3. VIEW ACCESS & SCOPED LISTING
// ============================================================

async function getPendingApprovalEntityIdsForUser(auth: AuthContext): Promise<number[]> {
  const actionable = await listActionablePendingApprovals(
    auth,
    IT_REQUEST_MODULE_CODE,
    IT_REQUEST_ENTITY_TYPE,
  );
  return actionable.map((r) => r.entityId);
}

export async function assertItRequestViewAccess(
  auth: AuthContext,
  ticketId: number,
): Promise<{
  id: number;
  code: string;
  status: ItRequestStatus;
  requesterUserId: number;
  assignedToUserId: number | null;
  branchId: number | null;
  departmentId: number | null;
  approvalRequestId: number | null;
}> {
  const db = getDb();
  const row = await db
    .selectFrom('it_requests')
    .select([
      'id',
      'code',
      'status',
      'requester_user_id',
      'assigned_to_user_id',
      'branch_id',
      'department_id',
      'approval_request_id',
    ])
    .where('id', '=', ticketId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('IT_REQUEST_NOT_FOUND', 'Không tìm thấy yêu cầu hỗ trợ IT.', 404);
  }

  const info = {
    id: Number(row.id),
    code: row.code,
    status: row.status,
    requesterUserId: Number(row.requester_user_id),
    assignedToUserId: row.assigned_to_user_id !== null ? Number(row.assigned_to_user_id) : null,
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    approvalRequestId: row.approval_request_id !== null ? Number(row.approval_request_id) : null,
  };

  if (
    isItManager(auth) ||
    auth.dataScope === 'ALL' ||
    info.requesterUserId === auth.userId ||
    info.assignedToUserId === auth.userId
  ) {
    return info;
  }

  const pendingIds = await getPendingApprovalEntityIdsForUser(auth);
  if (pendingIds.includes(info.id)) {
    return info;
  }

  if (auth.dataScope === 'BRANCH' && info.branchId && auth.branchIds.includes(info.branchId)) {
    return info;
  }

  if (auth.dataScope === 'DEPARTMENT' && info.departmentId) {
    const empCtx = await getUserEmployeeContext(auth.userId);
    if (empCtx.departmentId && empCtx.departmentId === info.departmentId) {
      return info;
    }
  }

  throw new AppError('FORBIDDEN', 'Bạn không có quyền truy cập yêu cầu IT này.', 403);
}

export async function listItRequests(
  auth: AuthContext,
  query: ListItRequestsQuery,
): Promise<{ items: ItRequestListItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const { page, limit, offset } = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 5000 },
  );

  const manager = isItManager(auth);
  const pendingApprovalIds = await getPendingApprovalEntityIdsForUser(auth);
  const empCtx = auth.dataScope === 'DEPARTMENT' ? await getUserEmployeeContext(auth.userId) : null;

  let base = db
    .selectFrom('it_requests as r')
    .innerJoin('it_request_categories as c', 'c.id', 'r.category_id')
    .innerJoin('users as req', 'req.id', 'r.requester_user_id')
    .leftJoin('users as assignee', 'assignee.id', 'r.assigned_to_user_id')
    .leftJoin('branches as b', 'b.id', 'r.branch_id')
    .leftJoin('departments as d', 'd.id', 'r.department_id')
    .leftJoin('assets as a', 'a.id', 'r.asset_id')
    .where('r.deleted_at', 'is', null);

  if (!manager && auth.dataScope !== 'ALL') {
    base = base.where((eb) => {
      const conds = [
        eb('r.requester_user_id', '=', auth.userId),
        eb('r.assigned_to_user_id', '=', auth.userId),
      ];
      if (pendingApprovalIds.length > 0) {
        conds.push(eb('r.id', 'in', pendingApprovalIds));
      }
      if (auth.dataScope === 'BRANCH' && auth.branchIds.length > 0) {
        conds.push(eb('r.branch_id', 'in', auth.branchIds));
      }
      if (auth.dataScope === 'DEPARTMENT' && empCtx?.departmentId) {
        conds.push(eb('r.department_id', '=', empCtx.departmentId));
      }
      return eb.or(conds);
    });
  }

  if (query.scope === 'mine') {
    base = base.where('r.requester_user_id', '=', auth.userId);
  } else if (query.scope === 'assigned_to_me') {
    base = base.where('r.assigned_to_user_id', '=', auth.userId);
  } else if (query.scope === 'unassigned') {
    base = base
      .where('r.assigned_to_user_id', 'is', null)
      .where('r.status', 'in', ['OPEN', 'IN_PROGRESS']);
  } else if (query.scope === 'pending_my_approval') {
    if (pendingApprovalIds.length === 0) {
      return {
        items: [],
        meta: buildPaginationMeta(0, page, limit),
      };
    }
    base = base.where('r.id', 'in', pendingApprovalIds);
  } else if (query.scope === 'sla_breached') {
    base = base
      .where('r.sla_resolution_due_at', 'is not', null)
      .where('r.status', 'in', ['OPEN', 'IN_PROGRESS'])
      .where('r.sla_resolution_due_at', '<', new Date());
  }

  if (query.status) {
    base = base.where('r.status', '=', query.status as ItRequestStatus);
  }
  if (query.priority) {
    base = base.where('r.priority', '=', query.priority as ItRequestPriority);
  }
  if (query.requestKind) {
    base = base.where('r.request_kind', '=', query.requestKind as ItRequestKind);
  }
  if (query.categoryId) {
    base = base.where('r.category_id', '=', query.categoryId);
  }
  if (query.branchId) {
    base = base.where('r.branch_id', '=', query.branchId);
  }
  if (query.assignedToUserId) {
    base = base.where('r.assigned_to_user_id', '=', query.assignedToUserId);
  }
  if (query.search && query.search.trim().length > 0) {
    const like = `%${query.search.trim()}%`;
    base = base.where((eb) =>
      eb.or([
        eb('r.code', 'like', like),
        eb('r.title', 'like', like),
        eb('req.full_name', 'like', like),
        eb('a.asset_code', 'like', like),
      ]),
    );
  }

  const [countRow, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirst(),
    base
      .select([
        'r.id',
        'r.code',
        'r.category_id',
        'c.code as category_code',
        'c.name as category_name',
        'c.name_en as category_name_en',
        'c.color as category_color',
        'c.requires_approval',
        'r.request_kind',
        'r.title',
        'r.priority',
        'r.status',
        'r.requester_user_id',
        'req.full_name as requester_name',
        'r.branch_id',
        'b.name as branch_name',
        'b.name_en as branch_name_en',
        'r.department_id',
        'd.name as department_name',
        'd.name_en as department_name_en',
        'r.asset_id',
        'a.asset_code',
        'a.name as asset_name',
        'r.assigned_to_user_id',
        'assignee.full_name as assigned_to_name',
        'r.estimated_cost',
        'r.approval_request_id',
        'r.sla_response_due_at',
        'r.sla_resolution_due_at',
        'r.first_responded_at',
        'r.sla_paused_at',
        'r.sla_paused_minutes',
        'r.satisfaction_rating',
        'r.submitted_at',
        'r.resolved_at',
        'r.closed_at',
        'r.created_at',
        'r.updated_at',
      ])
      .orderBy('r.created_at', 'desc')
      .orderBy('r.id', 'desc')
      .limit(limit)
      .offset(offset)
      .execute(),
  ]);

  const total = Number(countRow?.total ?? 0);
  const items: ItRequestListItem[] = rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    categoryId: Number(r.category_id),
    categoryCode: r.category_code,
    categoryName: r.category_name,
    categoryNameEn: r.category_name_en ?? null,
    categoryColor: r.category_color,
    requiresApproval: Number(r.requires_approval) === 1,
    requestKind: r.request_kind,
    title: r.title,
    priority: r.priority,
    status: r.status,
    requesterUserId: Number(r.requester_user_id),
    requesterName: r.requester_name,
    branchId: r.branch_id !== null ? Number(r.branch_id) : null,
    branchName: r.branch_name ?? null,
    branchNameEn: r.branch_name_en ?? null,
    departmentId: r.department_id !== null ? Number(r.department_id) : null,
    departmentName: r.department_name ?? null,
    departmentNameEn: r.department_name_en ?? null,
    assetId: r.asset_id !== null ? Number(r.asset_id) : null,
    assetCode: r.asset_code ?? null,
    assetName: r.asset_name ?? null,
    assignedToUserId: r.assigned_to_user_id !== null ? Number(r.assigned_to_user_id) : null,
    assignedToName: r.assigned_to_name ?? null,
    estimatedCost: Number(r.estimated_cost ?? 0),
    approvalRequestId: r.approval_request_id !== null ? Number(r.approval_request_id) : null,
    sla: computeTicketSlaView(r),
    satisfactionRating: r.satisfaction_rating !== null ? Number(r.satisfaction_rating) : null,
    submittedAt: toIsoOrNull(r.submitted_at),
    resolvedAt: toIsoOrNull(r.resolved_at),
    closedAt: toIsoOrNull(r.closed_at),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));

  return {
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getItRequestsSummary(auth: AuthContext): Promise<ItRequestsSummaryView> {
  const { items } = await listItRequests(auth, { page: 1, limit: 5000 });
  const pendingApprovalIds = await getPendingApprovalEntityIdsForUser(auth);
  const pendingSet = new Set(pendingApprovalIds);

  const summary: ItRequestsSummaryView = {
    total: items.length,
    draftCount: 0,
    pendingApprovalCount: 0,
    openCount: 0,
    inProgressCount: 0,
    waitingUserCount: 0,
    resolvedCount: 0,
    closedCount: 0,
    unassignedCount: 0,
    assignedToMeCount: 0,
    pendingMyApprovalCount: 0,
    slaBreachedCount: 0,
    slaAtRiskCount: 0,
    avgSatisfactionRating: null,
  };

  let ratingSum = 0;
  let ratingCount = 0;

  for (const item of items) {
    if (item.status === 'DRAFT') summary.draftCount += 1;
    else if (item.status === 'PENDING_APPROVAL') summary.pendingApprovalCount += 1;
    else if (item.status === 'OPEN') summary.openCount += 1;
    else if (item.status === 'IN_PROGRESS') summary.inProgressCount += 1;
    else if (item.status === 'WAITING_USER') summary.waitingUserCount += 1;
    else if (item.status === 'RESOLVED') summary.resolvedCount += 1;
    else if (item.status === 'CLOSED') summary.closedCount += 1;

    if (!item.assignedToUserId && (item.status === 'OPEN' || item.status === 'IN_PROGRESS')) {
      summary.unassignedCount += 1;
    }
    if (
      item.assignedToUserId === auth.userId &&
      ['OPEN', 'IN_PROGRESS', 'WAITING_USER'].includes(item.status)
    ) {
      summary.assignedToMeCount += 1;
    }
    if (pendingSet.has(item.id)) {
      summary.pendingMyApprovalCount += 1;
    }
    if (['OPEN', 'IN_PROGRESS'].includes(item.status)) {
      if (item.sla.resolutionStatus === 'BREACHED') summary.slaBreachedCount += 1;
      else if (item.sla.resolutionStatus === 'AT_RISK') summary.slaAtRiskCount += 1;
    }
    if (item.satisfactionRating !== null) {
      ratingSum += item.satisfactionRating;
      ratingCount += 1;
    }
  }

  if (ratingCount > 0) {
    summary.avgSatisfactionRating = Number((ratingSum / ratingCount).toFixed(2));
  }

  return summary;
}

// ============================================================
// 4. DETAIL VIEW
// ============================================================

export async function getItRequestDetail(
  auth: AuthContext,
  ticketId: number,
): Promise<ItRequestDetailView> {
  await assertItRequestViewAccess(auth, ticketId);
  const db = getDb();

  const row = await db
    .selectFrom('it_requests as r')
    .innerJoin('it_request_categories as c', 'c.id', 'r.category_id')
    .innerJoin('users as req', 'req.id', 'r.requester_user_id')
    .leftJoin('users as assignee', 'assignee.id', 'r.assigned_to_user_id')
    .leftJoin('branches as b', 'b.id', 'r.branch_id')
    .leftJoin('departments as d', 'd.id', 'r.department_id')
    .leftJoin('assets as a', 'a.id', 'r.asset_id')
    .select([
      'r.id',
      'r.code',
      'r.category_id',
      'c.code as category_code',
      'c.name as category_name',
      'c.name_en as category_name_en',
      'c.color as category_color',
      'c.requires_approval',
      'r.request_kind',
      'r.title',
      'r.description',
      'r.priority',
      'r.status',
      'r.requester_user_id',
      'req.full_name as requester_name',
      'r.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'r.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'r.asset_id',
      'a.asset_code',
      'a.name as asset_name',
      'a.serial_number as asset_serial_number',
      'a.category as asset_category',
      'r.assigned_to_user_id',
      'assignee.full_name as assigned_to_name',
      'r.estimated_cost',
      'r.location_detail',
      'r.contact_phone',
      'r.approval_request_id',
      'r.sla_response_due_at',
      'r.sla_resolution_due_at',
      'r.first_responded_at',
      'r.sla_paused_at',
      'r.sla_paused_minutes',
      'r.submitted_at',
      'r.resolved_at',
      'r.closed_at',
      'r.resolution_summary',
      'r.rejection_reason',
      'r.satisfaction_rating',
      'r.satisfaction_feedback',
      'r.created_at',
      'r.updated_at',
    ])
    .where('r.id', '=', ticketId)
    .where('r.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('IT_REQUEST_NOT_FOUND', 'Không tìm thấy yêu cầu hỗ trợ IT.', 404);
  }

  const [checklistRows, activityRows, approval] = await Promise.all([
    db
      .selectFrom('it_request_checklist_items as ck')
      .leftJoin('users as du', 'du.id', 'ck.done_by_user_id')
      .select([
        'ck.id',
        'ck.it_request_id',
        'ck.title',
        'ck.note',
        'ck.is_done',
        'ck.done_by_user_id',
        'du.full_name as done_by_name',
        'ck.done_at',
        'ck.sort_order',
      ])
      .where('ck.it_request_id', '=', ticketId)
      .orderBy('ck.sort_order', 'asc')
      .orderBy('ck.id', 'asc')
      .execute(),
    db
      .selectFrom('it_request_activities as act')
      .leftJoin('users as au', 'au.id', 'act.actor_user_id')
      .select([
        'act.id',
        'act.actor_user_id',
        'au.full_name as actor_name',
        'act.action',
        'act.summary',
        'act.created_at',
      ])
      .where('act.it_request_id', '=', ticketId)
      .orderBy('act.created_at', 'desc')
      .orderBy('act.id', 'desc')
      .limit(50)
      .execute(),
    row.approval_request_id
      ? getApprovalDetailWithHistory(Number(row.approval_request_id), auth).catch(() => null)
      : Promise.resolve(null),
  ]);

  const manager = isItManager(auth);
  const isOwner = Number(row.requester_user_id) === auth.userId;
  const isAssignee = row.assigned_to_user_id !== null && Number(row.assigned_to_user_id) === auth.userId;
  const isTech = manager || isAssignee;
  const terminal = isTerminalStatus(row.status);

  const actions: ItRequestActionsView = {
    canEdit: (isOwner || manager) && row.status === 'DRAFT',
    canDelete: (isOwner || manager) && (row.status === 'DRAFT' || row.status === 'CANCELLED'),
    canSubmit: (isOwner || manager) && row.status === 'DRAFT',
    canAssign: manager && !terminal && row.status !== 'DRAFT',
    canStartWork: isTech && row.status === 'OPEN',
    canWaitUser: isTech && row.status === 'IN_PROGRESS',
    canResumeWork: (isTech || isOwner) && row.status === 'WAITING_USER',
    canResolve: isTech && (row.status === 'IN_PROGRESS' || row.status === 'WAITING_USER' || row.status === 'OPEN'),
    canReopen: (isOwner || manager) && row.status === 'RESOLVED',
    canClose: (isOwner || manager) && row.status === 'RESOLVED',
    canCancel:
      (isOwner || manager) &&
      (row.status === 'DRAFT' || row.status === 'PENDING_APPROVAL' || row.status === 'OPEN'),
    canComment: !terminal,
    canPostInternalNote: !terminal && isTech,
    canUploadAttachment: !terminal && (isOwner || isTech),
    canManageChecklist: !terminal && isTech,
    canExportPdf: auth.isSuperAdmin || auth.permissions.includes(IT_REQUEST_PERMISSIONS.EXPORT),
  };

  return {
    id: Number(row.id),
    code: row.code,
    categoryId: Number(row.category_id),
    categoryCode: row.category_code,
    categoryName: row.category_name,
    categoryNameEn: row.category_name_en ?? null,
    categoryColor: row.category_color,
    requiresApproval: Number(row.requires_approval) === 1,
    requestKind: row.request_kind,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    requesterUserId: Number(row.requester_user_id),
    requesterName: row.requester_name,
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    branchName: row.branch_name ?? null,
    branchNameEn: row.branch_name_en ?? null,
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    departmentName: row.department_name ?? null,
    departmentNameEn: row.department_name_en ?? null,
    assetId: row.asset_id !== null ? Number(row.asset_id) : null,
    assetCode: row.asset_code ?? null,
    assetName: row.asset_name ?? null,
    assetSerialNumber: row.asset_serial_number ?? null,
    assetCategory: row.asset_category ?? null,
    assignedToUserId: row.assigned_to_user_id !== null ? Number(row.assigned_to_user_id) : null,
    assignedToName: row.assigned_to_name ?? null,
    estimatedCost: Number(row.estimated_cost ?? 0),
    locationDetail: row.location_detail ?? null,
    contactPhone: row.contact_phone ?? null,
    approvalRequestId: row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    sla: computeTicketSlaView(row),
    resolutionSummary: row.resolution_summary ?? null,
    rejectionReason: row.rejection_reason ?? null,
    satisfactionRating: row.satisfaction_rating !== null ? Number(row.satisfaction_rating) : null,
    satisfactionFeedback: row.satisfaction_feedback ?? null,
    submittedAt: toIsoOrNull(row.submitted_at),
    resolvedAt: toIsoOrNull(row.resolved_at),
    closedAt: toIsoOrNull(row.closed_at),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    checklist: checklistRows.map((c) => ({
      id: Number(c.id),
      itRequestId: Number(c.it_request_id),
      title: c.title,
      note: c.note ?? null,
      isDone: Number(c.is_done) === 1,
      doneByUserId: c.done_by_user_id !== null ? Number(c.done_by_user_id) : null,
      doneByName: c.done_by_name ?? null,
      doneAt: toIsoOrNull(c.done_at),
      sortOrder: Number(c.sort_order),
    })),
    activities: activityRows.map((a) => ({
      id: Number(a.id),
      actorUserId: a.actor_user_id !== null ? Number(a.actor_user_id) : null,
      actorName: a.actor_name ?? null,
      action: a.action,
      summary: a.summary,
      createdAt: new Date(a.created_at).toISOString(),
    })),
    approval,
    actions,
  };
}

// ============================================================
// 5. CREATE, UPDATE, DELETE & SUBMIT
// ============================================================

export async function createItRequest(
  auth: AuthContext,
  input: CreateItRequestInput,
): Promise<ItRequestDetailView> {
  const db = getDb();

  const category = await db
    .selectFrom('it_request_categories')
    .select([
      'id',
      'name',
      'request_kind',
      'requires_approval',
      'default_priority',
      'sla_response_hours',
      'sla_resolution_hours',
      'is_active',
    ])
    .where('id', '=', input.categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!category || Number(category.is_active) !== 1) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Danh mục hỗ trợ IT không tồn tại hoặc đã ngừng sử dụng.', 404);
  }

  if (input.assetId) {
    const asset = await db
      .selectFrom('assets')
      .select(['id'])
      .where('id', '=', input.assetId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!asset) {
      throw new AppError('ASSET_NOT_FOUND', 'Tài sản liên kết không tồn tại.', 404);
    }
  }

  const empCtx = await getUserEmployeeContext(auth.userId);
  const resolvedBranchId = input.branchId ?? empCtx.branchId ?? auth.branchIds[0] ?? null;
  const resolvedDepartmentId = input.departmentId ?? empCtx.departmentId ?? null;
  const resolvedPriority = input.priority ?? category.default_priority;
  const code = await generateNextItRequestCode();

  let createdId = 0;

  await db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('it_requests')
      .values({
        code,
        category_id: Number(category.id),
        request_kind: category.request_kind,
        title: input.title,
        description: input.description,
        priority: resolvedPriority,
        status: 'DRAFT',
        requester_user_id: auth.userId,
        requester_employee_id: empCtx.employeeId,
        branch_id: resolvedBranchId,
        department_id: resolvedDepartmentId,
        asset_id: input.assetId ?? null,
        assigned_to_user_id: null,
        estimated_cost: input.estimatedCost ?? 0,
        location_detail: input.locationDetail ?? null,
        contact_phone: input.contactPhone ?? null,
        approval_request_id: null,
        sla_response_due_at: null,
        sla_resolution_due_at: null,
        first_responded_at: null,
        sla_paused_at: null,
        sla_paused_minutes: 0,
        submitted_at: null,
        resolved_at: null,
        closed_at: null,
        resolution_summary: null,
        rejection_reason: null,
        satisfaction_rating: null,
        satisfaction_feedback: null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    createdId = Number(inserted.insertId);

    if (input.checklistTitles && input.checklistTitles.length > 0) {
      await trx
        .insertInto('it_request_checklist_items')
        .values(
          input.checklistTitles.map((title, idx) => ({
            it_request_id: createdId,
            title,
            note: null,
            is_done: 0,
            done_by_user_id: null,
            done_at: null,
            sort_order: idx + 1,
            created_by: auth.userId,
            updated_by: auth.userId,
          })),
        )
        .execute();
    }

    await trx
      .insertInto('it_request_activities')
      .values({
        it_request_id: createdId,
        actor_user_id: auth.userId,
        action: 'CREATED',
        summary: `Tạo yêu cầu hỗ trợ IT [${code}]`,
        metadata_json: JSON.stringify({ code, categoryId: category.id, priority: resolvedPriority }),
      })
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: IT_REQUEST_MODULE_CODE,
    action: 'CREATE_IT_REQUEST',
    entityType: IT_REQUEST_ENTITY_TYPE,
    entityId: createdId,
    newValues: { code, title: input.title, submitImmediately: input.submitImmediately },
  });

  if (input.submitImmediately) {
    return submitItRequest(auth, createdId);
  }

  return getItRequestDetail(auth, createdId);
}

export async function updateItRequest(
  auth: AuthContext,
  ticketId: number,
  input: UpdateItRequestInput,
): Promise<ItRequestDetailView> {
  const existing = await assertItRequestViewAccess(auth, ticketId);
  const manager = isItManager(auth);
  const isOwner = existing.requesterUserId === auth.userId;

  if (!isOwner && !manager) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền chỉnh sửa yêu cầu IT này.', 403);
  }
  if (existing.status !== 'DRAFT' && !manager) {
    throw new AppError(
      'IT_REQUEST_EDIT_LOCKED',
      'Chỉ có thể chỉnh sửa nội dung yêu cầu IT khi ở trạng thái Nháp.',
      409,
    );
  }
  if (isTerminalStatus(existing.status)) {
    throw new AppError('IT_REQUEST_TERMINAL', 'Yêu cầu IT đã kết thúc, không thể chỉnh sửa.', 409);
  }

  const db = getDb();
  let nextKind: ItRequestKind | undefined;
  if (input.categoryId !== undefined) {
    const cat = await db
      .selectFrom('it_request_categories')
      .select(['id', 'request_kind', 'is_active'])
      .where('id', '=', input.categoryId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!cat || Number(cat.is_active) !== 1) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Danh mục hỗ trợ IT không hợp lệ.', 404);
    }
    nextKind = cat.request_kind;
  }

  await db
    .updateTable('it_requests')
    .set({
      ...(input.categoryId !== undefined ? { category_id: input.categoryId, request_kind: nextKind } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.branchId !== undefined ? { branch_id: input.branchId } : {}),
      ...(input.departmentId !== undefined ? { department_id: input.departmentId } : {}),
      ...(input.assetId !== undefined ? { asset_id: input.assetId } : {}),
      ...(input.estimatedCost !== undefined ? { estimated_cost: input.estimatedCost } : {}),
      ...(input.locationDetail !== undefined ? { location_detail: input.locationDetail } : {}),
      ...(input.contactPhone !== undefined ? { contact_phone: input.contactPhone } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', ticketId)
    .execute();

  await db
    .insertInto('it_request_activities')
    .values({
      it_request_id: ticketId,
      actor_user_id: auth.userId,
      action: 'UPDATED',
      summary: 'Cập nhật thông tin yêu cầu IT',
      metadata_json: JSON.stringify(input),
    })
    .execute();

  return getItRequestDetail(auth, ticketId);
}

export async function deleteItRequest(auth: AuthContext, ticketId: number): Promise<void> {
  const existing = await assertItRequestViewAccess(auth, ticketId);
  const manager = isItManager(auth);
  if (existing.requesterUserId !== auth.userId && !manager) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xóa yêu cầu IT này.', 403);
  }
  if (existing.status !== 'DRAFT' && existing.status !== 'CANCELLED') {
    throw new AppError(
      'IT_REQUEST_DELETE_BLOCKED',
      'Chỉ có thể xóa mềm yêu cầu IT ở trạng thái Nháp hoặc Đã hủy.',
      409,
    );
  }

  const db = getDb();
  await db
    .updateTable('it_requests')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', ticketId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: IT_REQUEST_MODULE_CODE,
    action: 'DELETE_IT_REQUEST',
    entityType: IT_REQUEST_ENTITY_TYPE,
    entityId: ticketId,
  });
}

export async function submitItRequest(
  auth: AuthContext,
  ticketId: number,
): Promise<ItRequestDetailView> {
  const existing = await assertItRequestViewAccess(auth, ticketId);
  const manager = isItManager(auth);
  if (existing.requesterUserId !== auth.userId && !manager) {
    throw new AppError('FORBIDDEN', 'Chỉ người tạo hoặc quản trị IT mới được gửi yêu cầu này.', 403);
  }
  if (existing.status !== 'DRAFT') {
    throw new AppError('INVALID_STATUS', 'Chỉ yêu cầu ở trạng thái Nháp mới có thể gửi.', 409);
  }

  const db = getDb();
  const ticket = await db
    .selectFrom('it_requests as r')
    .innerJoin('it_request_categories as c', 'c.id', 'r.category_id')
    .select([
      'r.id',
      'r.code',
      'r.title',
      'r.request_kind',
      'r.priority',
      'r.branch_id',
      'r.requester_user_id',
      'r.estimated_cost',
      'c.requires_approval',
      'c.sla_response_hours',
      'c.sla_resolution_hours',
    ])
    .where('r.id', '=', ticketId)
    .where('r.deleted_at', 'is', null)
    .executeTakeFirstOrThrow();

  const now = new Date();
  const requiresApproval = Number(ticket.requires_approval) === 1;

  if (requiresApproval) {
    const empCtx = await getUserEmployeeContext(Number(ticket.requester_user_id));
    const requestType = resolveItWorkflowRequestType(ticket.request_kind);

    await db.transaction().execute(async (trx) => {
      const approval = await createApprovalRequest(
        {
          moduleCode: IT_REQUEST_MODULE_CODE,
          requestType,
          entityType: IT_REQUEST_ENTITY_TYPE,
          entityId: ticketId,
          branchId: ticket.branch_id !== null ? Number(ticket.branch_id) : null,
          requesterId: Number(ticket.requester_user_id),
          directManagerUserId: empCtx.directManagerUserId,
          title: `[${ticket.code}] ${ticket.title}`,
          summary:
            Number(ticket.estimated_cost ?? 0) > 0
              ? `Chi phí dự kiến: ${Number(ticket.estimated_cost).toLocaleString('vi-VN')} ₫`
              : `Yêu cầu hỗ trợ IT (${ticket.request_kind})`,
          evalContext: { amount: Number(ticket.estimated_cost ?? 0) },
        },
        trx,
      );

      await trx
        .updateTable('it_requests')
        .set({
          status: 'PENDING_APPROVAL',
          approval_request_id: approval.approvalRequestId,
          submitted_at: now,
          updated_by: auth.userId,
        })
        .where('id', '=', ticketId)
        .execute();

      await trx
        .insertInto('it_request_activities')
        .values({
          it_request_id: ticketId,
          actor_user_id: auth.userId,
          action: 'SUBMITTED_FOR_APPROVAL',
          summary: `Đã gửi phê duyệt qua Core Approval Engine (#${approval.approvalRequestId})`,
          metadata_json: JSON.stringify({
            approvalRequestId: approval.approvalRequestId,
            requestType,
          }),
        })
        .execute();
    });
  } else {
    const deadlines = calculateSlaDeadlines(
      now,
      Number(ticket.sla_response_hours),
      Number(ticket.sla_resolution_hours),
      { priority: ticket.priority },
    );

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('it_requests')
        .set({
          status: 'OPEN',
          submitted_at: now,
          sla_response_due_at: deadlines.responseDueAt,
          sla_resolution_due_at: deadlines.resolutionDueAt,
          updated_by: auth.userId,
        })
        .where('id', '=', ticketId)
        .execute();

      await trx
        .insertInto('it_request_activities')
        .values({
          it_request_id: ticketId,
          actor_user_id: auth.userId,
          action: 'SUBMITTED_TO_IT',
          summary: `Đã gửi trực tiếp vào hàng đợi IT (SLA: phản hồi ${deadlines.effectiveResponseHours}h / xử lý ${deadlines.effectiveResolutionHours}h)`,
          metadata_json: JSON.stringify({
            effectiveResponseHours: deadlines.effectiveResponseHours,
            effectiveResolutionHours: deadlines.effectiveResolutionHours,
          }),
        })
        .execute();
    });

    await notifyItSupportTeam({
      branchId: ticket.branch_id !== null ? Number(ticket.branch_id) : null,
      excludeUserId: auth.userId,
      title: `Ticket IT mới [${ticket.code}]`,
      message: `${auth.fullName}: ${ticket.title}`,
      linkUrl: `/services/it-requests/${ticketId}`,
    });
  }

  return getItRequestDetail(auth, ticketId);
}

// ============================================================
// 6. ASSIGN & STATUS TRANSITIONS (WITH SLA PAUSE / RESUME)
// ============================================================

export async function assignItRequest(
  auth: AuthContext,
  ticketId: number,
  input: AssignItRequestInput,
): Promise<ItRequestDetailView> {
  const existing = await assertItRequestViewAccess(auth, ticketId);
  if (!isItManager(auth)) {
    throw new AppError('FORBIDDEN', 'Chỉ bộ phận IT mới có quyền phân công xử lý ticket.', 403);
  }
  if (existing.status === 'DRAFT' || isTerminalStatus(existing.status)) {
    throw new AppError(
      'INVALID_STATUS',
      'Không thể phân công ticket ở trạng thái Nháp hoặc đã kết thúc.',
      409,
    );
  }

  const db = getDb();
  let assigneeName: string | null = null;
  if (input.assignedToUserId !== null) {
    const user = await db
      .selectFrom('users')
      .select(['id', 'full_name', 'status'])
      .where('id', '=', input.assignedToUserId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('USER_NOT_FOUND', 'Kỹ thuật viên được chọn không tồn tại hoặc đã bị khóa.', 404);
    }
    assigneeName = user.full_name;
  }

  const currentRow = await db
    .selectFrom('it_requests')
    .select(['first_responded_at', 'status', 'title'])
    .where('id', '=', ticketId)
    .executeTakeFirstOrThrow();

  const now = new Date();
  const shouldStart =
    input.startImmediately &&
    input.assignedToUserId !== null &&
    currentRow.status === 'OPEN';

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('it_requests')
      .set({
        assigned_to_user_id: input.assignedToUserId,
        ...(shouldStart ? { status: 'IN_PROGRESS' as ItRequestStatus } : {}),
        ...(input.assignedToUserId !== null && !currentRow.first_responded_at
          ? { first_responded_at: now }
          : {}),
        updated_by: auth.userId,
      })
      .where('id', '=', ticketId)
      .execute();

    await trx
      .insertInto('it_request_activities')
      .values({
        it_request_id: ticketId,
        actor_user_id: auth.userId,
        action: 'ASSIGNED',
        summary: assigneeName
          ? `Phân công cho kỹ thuật viên ${assigneeName}${shouldStart ? ' và bắt đầu xử lý' : ''}`
          : 'Gỡ phân công kỹ thuật viên',
        metadata_json: JSON.stringify({
          assignedToUserId: input.assignedToUserId,
          startImmediately: shouldStart,
          note: input.note ?? null,
        }),
      })
      .execute();
  });

  if (input.assignedToUserId && input.assignedToUserId !== auth.userId) {
    await createNotification({
      userId: input.assignedToUserId,
      moduleCode: IT_REQUEST_MODULE_CODE,
      type: 'IT_REQUEST_ASSIGNED',
      title: `Bạn được phân công ticket [${existing.code}]`,
      message: currentRow.title,
      linkUrl: `/services/it-requests/${ticketId}`,
    });
  }

  if (existing.requesterUserId !== auth.userId && assigneeName) {
    await createNotification({
      userId: existing.requesterUserId,
      moduleCode: IT_REQUEST_MODULE_CODE,
      type: 'IT_REQUEST_ASSIGNED',
      title: `Ticket [${existing.code}] đã có kỹ thuật viên tiếp nhận`,
      message: `Kỹ thuật viên phụ trách: ${assigneeName}`,
      linkUrl: `/services/it-requests/${ticketId}`,
    });
  }

  return getItRequestDetail(auth, ticketId);
}

export async function transitionItRequestStatus(
  auth: AuthContext,
  ticketId: number,
  input: TransitionItRequestStatusInput,
): Promise<ItRequestDetailView> {
  const existing = await assertItRequestViewAccess(auth, ticketId);
  const manager = isItManager(auth);
  const isOwner = existing.requesterUserId === auth.userId;
  const isAssignee = existing.assignedToUserId === auth.userId;
  const isTech = manager || isAssignee;

  const targetMap: Record<TransitionItRequestStatusInput['action'], ItRequestStatus> = {
    START_WORK: 'IN_PROGRESS',
    WAIT_USER: 'WAITING_USER',
    RESUME_WORK: 'IN_PROGRESS',
    RESOLVE: 'RESOLVED',
    REOPEN: 'IN_PROGRESS',
    CLOSE: 'CLOSED',
    CANCEL: 'CANCELLED',
  };
  const nextStatus = targetMap[input.action];

  if (
    ['START_WORK', 'WAIT_USER', 'RESOLVE'].includes(input.action) &&
    !isTech
  ) {
    throw new AppError('FORBIDDEN', 'Chỉ kỹ thuật viên IT phụ trách mới được thực hiện thao tác này.', 403);
  }
  if (input.action === 'RESUME_WORK' && !isTech && !isOwner) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền tiếp tục xử lý ticket này.', 403);
  }
  if (['REOPEN', 'CLOSE', 'CANCEL'].includes(input.action) && !isOwner && !manager) {
    throw new AppError('FORBIDDEN', 'Chỉ người tạo yêu cầu hoặc quản trị IT mới được thực hiện thao tác này.', 403);
  }

  if (!canTransitionItTicketStatus(existing.status, nextStatus)) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Không thể chuyển trạng thái ticket từ ${existing.status} sang ${nextStatus}.`,
      409,
    );
  }

  const db = getDb();
  const row = await db
    .selectFrom('it_requests')
    .select([
      'id',
      'code',
      'title',
      'status',
      'assigned_to_user_id',
      'approval_request_id',
      'first_responded_at',
      'sla_paused_at',
      'sla_paused_minutes',
      'sla_resolution_due_at',
    ])
    .where('id', '=', ticketId)
    .executeTakeFirstOrThrow();

  const now = new Date();
  let extraPausedMinutes = 0;
  let nextSlaPausedAt: Date | null = row.sla_paused_at;
  let nextSlaResolutionDueAt: Date | null = row.sla_resolution_due_at;
  let nextSlaPausedMinutes = Number(row.sla_paused_minutes ?? 0);

  if (input.action === 'WAIT_USER') {
    nextSlaPausedAt = now;
  } else if (
    (input.action === 'RESUME_WORK' || input.action === 'RESOLVE') &&
    row.sla_paused_at
  ) {
    extraPausedMinutes = Math.max(
      0,
      Math.round((now.getTime() - new Date(row.sla_paused_at).getTime()) / 60_000),
    );
    nextSlaPausedMinutes += extraPausedMinutes;
    nextSlaResolutionDueAt = shiftSlaDeadlineByMinutes(
      row.sla_resolution_due_at,
      extraPausedMinutes,
    );
    nextSlaPausedAt = null;
  }

  const summaryLabels: Record<TransitionItRequestStatusInput['action'], string> = {
    START_WORK: 'Bắt đầu xử lý kỹ thuật',
    WAIT_USER: `Chuyển trạng thái Chờ người gửi phản hồi (tạm dừng SLA): ${input.note ?? ''}`,
    RESUME_WORK:
      extraPausedMinutes > 0
        ? `Tiếp tục xử lý (đã cộng bù ${extraPausedMinutes} phút tạm dừng SLA)`
        : 'Tiếp tục xử lý kỹ thuật',
    RESOLVE: `Đánh dấu Đã xử lý: ${input.resolutionSummary ?? ''}`,
    REOPEN: `Mở lại yêu cầu: ${input.note ?? ''}`,
    CLOSE: input.satisfactionRating
      ? `Nghiệm thu & Đóng yêu cầu (Đánh giá ${input.satisfactionRating}/5 sao)`
      : 'Xác nhận nghiệm thu & Đóng yêu cầu',
    CANCEL: input.note ? `Hủy yêu cầu IT: ${input.note}` : 'Hủy yêu cầu IT',
  };

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('it_requests')
      .set({
        status: nextStatus,
        ...(input.action === 'START_WORK' && !row.assigned_to_user_id
          ? { assigned_to_user_id: auth.userId }
          : {}),
        ...(isTech && !row.first_responded_at && ['START_WORK', 'WAIT_USER', 'RESOLVE'].includes(input.action)
          ? { first_responded_at: now }
          : {}),
        sla_paused_at: nextSlaPausedAt,
        sla_paused_minutes: nextSlaPausedMinutes,
        sla_resolution_due_at: nextSlaResolutionDueAt,
        ...(input.action === 'RESOLVE'
          ? { resolved_at: now, resolution_summary: input.resolutionSummary ?? null }
          : {}),
        ...(input.action === 'REOPEN' ? { resolved_at: null } : {}),
        ...(input.action === 'CLOSE'
          ? {
              closed_at: now,
              ...(input.satisfactionRating !== undefined
                ? { satisfaction_rating: input.satisfactionRating }
                : {}),
              ...(input.satisfactionFeedback !== undefined
                ? { satisfaction_feedback: input.satisfactionFeedback }
                : {}),
            }
          : {}),
        updated_by: auth.userId,
      })
      .where('id', '=', ticketId)
      .execute();

    // Sync cancel linked Core Approval Request if cancelling from PENDING_APPROVAL
    if (input.action === 'CANCEL' && row.approval_request_id) {
      const ar = await trx
        .selectFrom('approval_requests')
        .select(['id', 'status', 'current_step'])
        .where('id', '=', Number(row.approval_request_id))
        .executeTakeFirst();
      if (ar && ar.status === 'PENDING') {
        await trx
          .updateTable('approval_requests')
          .set({
            status: 'CANCELLED',
            completed_at: now,
            current_approver_user_id: null,
            current_approver_role_id: null,
          })
          .where('id', '=', Number(ar.id))
          .execute();
        await trx
          .insertInto('approval_histories')
          .values({
            approval_request_id: Number(ar.id),
            step_order: Number(ar.current_step),
            actor_id: auth.userId,
            action: 'CANCEL',
            comment: input.note ?? 'Người tạo hủy yêu cầu IT',
          })
          .execute();
      }
    }

    if (input.action === 'WAIT_USER' && input.note) {
      await trx
        .insertInto('it_request_comments')
        .values({
          it_request_id: ticketId,
          author_user_id: auth.userId,
          visibility: 'PUBLIC',
          comment_type: 'STATUS_NOTE',
          content: input.note,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .execute();
    } else if (input.action === 'RESOLVE' && input.resolutionSummary) {
      await trx
        .insertInto('it_request_comments')
        .values({
          it_request_id: ticketId,
          author_user_id: auth.userId,
          visibility: 'PUBLIC',
          comment_type: 'RESOLUTION',
          content: input.resolutionSummary,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .execute();
    } else if (input.action === 'REOPEN' && input.note) {
      await trx
        .insertInto('it_request_comments')
        .values({
          it_request_id: ticketId,
          author_user_id: auth.userId,
          visibility: 'PUBLIC',
          comment_type: 'STATUS_NOTE',
          content: `[Mở lại yêu cầu] ${input.note}`,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .execute();
    }

    await trx
      .insertInto('it_request_activities')
      .values({
        it_request_id: ticketId,
        actor_user_id: auth.userId,
        action: input.action,
        summary: summaryLabels[input.action].slice(0, 490),
        metadata_json: JSON.stringify({
          fromStatus: existing.status,
          toStatus: nextStatus,
          extraPausedMinutes,
        }),
      })
      .execute();
  });

  // Notifications
  if (
    ['WAIT_USER', 'RESOLVE', 'START_WORK'].includes(input.action) &&
    existing.requesterUserId !== auth.userId
  ) {
    await createNotification({
      userId: existing.requesterUserId,
      moduleCode: IT_REQUEST_MODULE_CODE,
      type: `IT_REQUEST_${input.action}`,
      title: `Cập nhật ticket IT [${existing.code}]`,
      message: summaryLabels[input.action].slice(0, 240),
      linkUrl: `/services/it-requests/${ticketId}`,
    });
  } else if (
    ['RESUME_WORK', 'REOPEN', 'CLOSE'].includes(input.action) &&
    existing.assignedToUserId &&
    existing.assignedToUserId !== auth.userId
  ) {
    await createNotification({
      userId: existing.assignedToUserId,
      moduleCode: IT_REQUEST_MODULE_CODE,
      type: `IT_REQUEST_${input.action}`,
      title: `Phản hồi từ người gửi tại [${existing.code}]`,
      message: summaryLabels[input.action].slice(0, 240),
      linkUrl: `/services/it-requests/${ticketId}`,
    });
  }

  return getItRequestDetail(auth, ticketId);
}

export { sql };
