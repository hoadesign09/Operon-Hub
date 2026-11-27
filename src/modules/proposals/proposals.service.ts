import dayjs from 'dayjs';
import type { Transaction } from 'kysely';
import {
  getDb,
  type DatabaseSchema,
  type ProposalPriority,
  type ProposalStatus,
} from '@/config/database';
import { roundCurrency } from '@/lib/portable/currency-utils';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import {
  calculateProposalLineTotals,
  canTransitionProposalStatus,
  formatProposalCode,
} from '@/lib/portable/proposal-calculator';
import {
  canUserActOnApproval,
  createApprovalRequest,
  getApprovalDetailWithHistory,
  notifyApprovalRequestCreated,
  type ApprovalHistoryView,
  type ApprovalRequestItem,
} from '@/modules/approvals/approvals.service';
import '@/modules/approvals/register-module-hooks';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { resolveEmployeeAccessScope } from '@/modules/hrm/employees/employees.scope';
import { createNotification } from '@/modules/notifications/notifications.service';
import {
  notifyBudgetAlertIfNeeded,
  releaseProposalBudgetReserve,
  reserveBudgetForProposal,
  type BudgetAlertInfo,
} from '@/modules/payments/budget-ledger.service';
import {
  PROPOSAL_DEFAULT_REQUEST_TYPE,
  PROPOSAL_ENTITY_TYPE,
  PROPOSAL_MODULE_CODE,
} from '@/modules/proposals/proposals.constants';
import type {
  CreateProposalCategoryInput,
  CreateProposalInput,
  ProposalItemInput,
  ProposalStatusActionInput,
  UpdateProposalCategoryInput,
  UpdateProposalInput,
} from '@/modules/proposals/proposals.schema';
import { AppError } from '@/shared/api-response';

export interface ProposalCategoryView {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  defaultRequestType: string;
  requiresBudget: boolean;
  budgetThresholdHigh: number;
  iconName: string | null;
  colorHex: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProposalItemView {
  id: number;
  lineNo: number;
  itemName: string;
  specification: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  vendorNote: string | null;
}

export interface ProposalActivityView {
  id: number;
  actorUserId: number;
  actorName: string | null;
  actionType: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProposalListItem {
  id: number;
  proposalCode: string;
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  categoryNameEn: string | null;
  categoryColorHex: string;
  branchId: number;
  branchName: string;
  branchNameEn: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  budgetId: number | null;
  budgetCode: string | null;
  budgetName: string | null;
  budgetNameEn: string | null;
  budgetReservedAmount: number;
  isOverBudget: boolean;
  requesterUserId: number;
  requesterName: string;
  title: string;
  summary: string | null;
  priority: ProposalPriority;
  status: ProposalStatus;
  estimatedBudget: number;
  approvedBudget: number | null;
  currency: string;
  neededByDate: string | null;
  vendorName: string | null;
  approvalRequestId: number | null;
  approvalCurrentStep: number | null;
  approvalTotalSteps: number | null;
  approvalRoleName: string | null;
  approvalRoleNameEn: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalDetailView extends ProposalListItem {
  budgetAllocatedAmount: number | null;
  budgetAvailableAmount: number | null;
  budgetEnforcementMode: 'HARD_BLOCK' | 'SOFT_WARN' | null;
  content: string;
  expectedOutcome: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  rejectionReason: string | null;
  executionNotes: string | null;
  items: ProposalItemView[];
  activities: ProposalActivityView[];
  approval: {
    request: ApprovalRequestItem;
    histories: ApprovalHistoryView[];
    canApproveOrReject: boolean;
    canCancel: boolean;
  } | null;
  actions: {
    canEdit: boolean;
    canDelete: boolean;
    canSubmit: boolean;
    canRequestRevision: boolean;
    canCancel: boolean;
    canStartExecution: boolean;
    canComplete: boolean;
    canComment: boolean;
    canUploadAttachment: boolean;
  };
}

export interface ProposalsSummaryView {
  total: number;
  draftCount: number;
  pendingCount: number;
  needsRevisionCount: number;
  approvedCount: number;
  inExecutionCount: number;
  completedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  pendingMyApprovalCount: number;
  totalEstimatedBudget: number;
  totalApprovedBudget: number;
}

function toIsoDate(val: Date | string | null | undefined): string | null {
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
  return new Date(val).toISOString();
}

function safeJsonParse(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function hasManagePermission(auth: AuthContext): boolean {
  return auth.isSuperAdmin || auth.permissions.includes('proposals.manage');
}

async function resolveRequesterEmployeeContext(userId: number): Promise<{
  employeeId: number | null;
  branchId: number | null;
  departmentId: number | null;
  directManagerUserId: number | null;
}> {
  const db = getDb();
  const emp = await db
    .selectFrom('employees as e')
    .leftJoin('employees as mgr', 'mgr.id', 'e.manager_id')
    .select([
      'e.id',
      'e.branch_id',
      'e.department_id',
      'mgr.user_id as manager_user_id',
    ])
    .where('e.user_id', '=', userId)
    .where('e.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    return {
      employeeId: null,
      branchId: null,
      departmentId: null,
      directManagerUserId: null,
    };
  }

  return {
    employeeId: Number(emp.id),
    branchId: Number(emp.branch_id),
    departmentId: Number(emp.department_id),
    directManagerUserId:
      emp.manager_user_id !== null ? Number(emp.manager_user_id) : null,
  };
}

async function generateNextProposalCode(trx: Transaction<DatabaseSchema>): Promise<string> {
  const now = dayjs();
  const year = now.year();
  const month = now.month() + 1;
  const prefix = `PROP-${year}${String(month).padStart(2, '0')}-`;

  const latest = await trx
    .selectFrom('proposals')
    .select(['proposal_code'])
    .where('proposal_code', 'like', `${prefix}%`)
    .orderBy('id', 'desc')
    .limit(1)
    .forUpdate()
    .executeTakeFirst();

  let nextSeq = 1;
  if (latest?.proposal_code) {
    const suffix = latest.proposal_code.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      nextSeq = parsed + 1;
    }
  }
  return formatProposalCode('PROP', year, month, nextSeq);
}

async function replaceProposalItems(
  trx: Transaction<DatabaseSchema>,
  proposalId: number,
  items: readonly ProposalItemInput[],
  actorUserId: number,
): Promise<number> {
  await trx
    .updateTable('proposal_items')
    .set({ deleted_at: new Date(), updated_by: actorUserId })
    .where('proposal_id', '=', proposalId)
    .where('deleted_at', 'is', null)
    .execute();

  if (items.length === 0) {
    return 0;
  }

  const calculated = calculateProposalLineTotals(items);
  for (let i = 0; i < calculated.items.length; i += 1) {
    const row = calculated.items[i];
    await trx
      .insertInto('proposal_items')
      .values({
        proposal_id: proposalId,
        line_no: i + 1,
        item_name: row.item.itemName.trim(),
        specification: row.item.specification?.trim() || null,
        unit: row.item.unit.trim() || 'Cái',
        quantity: row.quantity,
        unit_price: row.unitPrice,
        line_total: row.lineTotal,
        vendor_note: row.item.vendorNote?.trim() || null,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .execute();
  }

  return calculated.grandTotal;
}

export async function listProposalCategories(
  includeInactive: boolean = false,
): Promise<ProposalCategoryView[]> {
  const db = getDb();
  let query = db
    .selectFrom('proposal_categories')
    .select([
      'id',
      'code',
      'name',
      'name_en',
      'description',
      'default_request_type',
      'requires_budget',
      'budget_threshold_high',
      'icon_name',
      'color_hex',
      'sort_order',
      'is_active',
    ])
    .where('deleted_at', 'is', null);

  if (!includeInactive) {
    query = query.where('is_active', '=', 1);
  }

  const rows = await query.orderBy('sort_order', 'asc').orderBy('id', 'asc').execute();

  return rows.map((row) => ({
    id: Number(row.id),
    code: row.code,
    name: row.name,
    nameEn: row.name_en ?? null,
    description: row.description ?? null,
    defaultRequestType: row.default_request_type,
    requiresBudget: Number(row.requires_budget) === 1,
    budgetThresholdHigh: Number(row.budget_threshold_high),
    iconName: row.icon_name ?? null,
    colorHex: row.color_hex,
    sortOrder: Number(row.sort_order),
    isActive: Number(row.is_active) === 1,
  }));
}

export async function createProposalCategory(
  input: CreateProposalCategoryInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<ProposalCategoryView> {
  const db = getDb();
  const duplicate = await db
    .selectFrom('proposal_categories')
    .select(['id'])
    .where('code', '=', input.code)
    .executeTakeFirst();

  if (duplicate) {
    throw new AppError('CATEGORY_CODE_EXISTS', 'Mã danh mục đề xuất đã tồn tại.', 409);
  }

  const inserted = await db
    .insertInto('proposal_categories')
    .values({
      code: input.code,
      name: input.name,
      name_en: input.nameEn?.trim() || null,
      description: input.description?.trim() || null,
      default_request_type: input.defaultRequestType,
      requires_budget: input.requiresBudget ? 1 : 0,
      budget_threshold_high: roundCurrency(input.budgetThresholdHigh),
      icon_name: input.iconName?.trim() || null,
      color_hex: input.colorHex,
      sort_order: input.sortOrder,
      is_active: input.isActive ? 1 : 0,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const createdId = Number(inserted.insertId);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PROPOSAL_MODULE_CODE,
    action: 'PROPOSAL_CATEGORY_CREATE',
    entityType: 'proposal_categories',
    entityId: createdId,
    newValues: { code: input.code, name: input.name, nameEn: input.nameEn ?? null },
    ipAddress,
  });

  const all = await listProposalCategories(true);
  const found = all.find((c) => c.id === createdId);
  if (!found) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không thể đọc lại danh mục vừa tạo.', 500);
  }
  return found;
}

export async function updateProposalCategory(
  categoryId: number,
  input: UpdateProposalCategoryInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<ProposalCategoryView> {
  const db = getDb();
  const existing = await db
    .selectFrom('proposal_categories')
    .select([
      'id',
      'code',
      'name',
      'name_en',
      'description',
      'default_request_type',
      'requires_budget',
      'budget_threshold_high',
      'icon_name',
      'color_hex',
      'sort_order',
      'is_active',
    ])
    .where('id', '=', categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục đề xuất.', 404);
  }

  if (input.code && input.code !== existing.code) {
    const duplicate = await db
      .selectFrom('proposal_categories')
      .select(['id'])
      .where('code', '=', input.code)
      .where('id', '!=', categoryId)
      .executeTakeFirst();
    if (duplicate) {
      throw new AppError('CATEGORY_CODE_EXISTS', 'Mã danh mục đề xuất đã tồn tại.', 409);
    }
  }

  await db
    .updateTable('proposal_categories')
    .set({
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      name_en: input.nameEn !== undefined ? input.nameEn?.trim() || null : existing.name_en,
      description:
        input.description !== undefined ? input.description?.trim() || null : existing.description,
      default_request_type: input.defaultRequestType ?? existing.default_request_type,
      requires_budget:
        input.requiresBudget !== undefined
          ? input.requiresBudget
            ? 1
            : 0
          : existing.requires_budget,
      budget_threshold_high:
        input.budgetThresholdHigh !== undefined
          ? roundCurrency(input.budgetThresholdHigh)
          : existing.budget_threshold_high,
      icon_name:
        input.iconName !== undefined ? input.iconName?.trim() || null : existing.icon_name,
      color_hex: input.colorHex ?? existing.color_hex,
      sort_order: input.sortOrder ?? existing.sort_order,
      is_active:
        input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
      updated_by: auth.userId,
    })
    .where('id', '=', categoryId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PROPOSAL_MODULE_CODE,
    action: 'PROPOSAL_CATEGORY_UPDATE',
    entityType: 'proposal_categories',
    entityId: categoryId,
    oldValues: { name: existing.name, isActive: Number(existing.is_active) === 1 },
    newValues: { name: input.name ?? existing.name, isActive: input.isActive },
    ipAddress,
  });

  const all = await listProposalCategories(true);
  const found = all.find((c) => c.id === categoryId);
  if (!found) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục sau khi cập nhật.', 404);
  }
  return found;
}

export async function softDeleteProposalCategory(
  categoryId: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .selectFrom('proposal_categories')
    .select(['id', 'code', 'name'])
    .where('id', '=', categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục đề xuất.', 404);
  }

  const pendingUsage = await db
    .selectFrom('proposals')
    .select(['id'])
    .where('category_id', '=', categoryId)
    .where('status', '=', 'PENDING_APPROVAL')
    .where('deleted_at', 'is', null)
    .limit(1)
    .executeTakeFirst();

  if (pendingUsage) {
    throw new AppError(
      'CATEGORY_IN_USE',
      'Không thể ẩn danh mục đang có đề xuất ở trạng thái Chờ phê duyệt.',
      409,
    );
  }

  await db
    .updateTable('proposal_categories')
    .set({ deleted_at: new Date(), is_active: 0, updated_by: auth.userId })
    .where('id', '=', categoryId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PROPOSAL_MODULE_CODE,
    action: 'PROPOSAL_CATEGORY_DELETE',
    entityType: 'proposal_categories',
    entityId: categoryId,
    oldValues: { code: existing.code, name: existing.name },
    ipAddress,
  });
}

export async function assertProposalViewAccess(
  auth: AuthContext,
  proposalId: number,
): Promise<{
  id: number;
  proposalCode: string;
  requesterUserId: number;
  branchId: number;
  departmentId: number | null;
  budgetId: number | null;
  budgetReservedAmount: number;
  status: ProposalStatus;
  approvalRequestId: number | null;
  estimatedBudget: number;
  title: string;
  categoryId: number;
}> {
  const db = getDb();
  const row = await db
    .selectFrom('proposals')
    .select([
      'id',
      'proposal_code',
      'requester_user_id',
      'branch_id',
      'department_id',
      'budget_id',
      'budget_reserved_amount',
      'status',
      'approval_request_id',
      'estimated_budget',
      'title',
      'category_id',
    ])
    .where('id', '=', proposalId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('PROPOSAL_NOT_FOUND', 'Không tìm thấy đề xuất nội bộ.', 404);
  }

  const info = {
    id: Number(row.id),
    proposalCode: row.proposal_code,
    requesterUserId: Number(row.requester_user_id),
    branchId: Number(row.branch_id),
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    budgetId: row.budget_id !== null ? Number(row.budget_id) : null,
    budgetReservedAmount: Number(row.budget_reserved_amount ?? 0),
    status: row.status,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    estimatedBudget: Number(row.estimated_budget),
    title: row.title,
    categoryId: Number(row.category_id),
  };

  if (hasManagePermission(auth) || info.requesterUserId === auth.userId) {
    return info;
  }

  const scope = await resolveEmployeeAccessScope(auth);
  if (scope.mode === 'ALL') {
    return info;
  }
  if (scope.mode === 'BRANCH' && scope.branchIds.includes(info.branchId)) {
    return info;
  }
  if (
    scope.mode === 'DEPARTMENT' &&
    info.departmentId !== null &&
    scope.departmentIds.includes(info.departmentId)
  ) {
    return info;
  }

  if (info.approvalRequestId) {
    const ar = await db
      .selectFrom('approval_requests')
      .select(['requester_id', 'current_approver_user_id', 'current_approver_role_id'])
      .where('id', '=', info.approvalRequestId)
      .executeTakeFirst();

    if (
      ar &&
      canUserActOnApproval(
        {
          requesterId: Number(ar.requester_id),
          currentApproverUserId:
            ar.current_approver_user_id !== null ? Number(ar.current_approver_user_id) : null,
          currentApproverRoleId:
            ar.current_approver_role_id !== null ? Number(ar.current_approver_role_id) : null,
        },
        auth,
        'APPROVE',
      )
    ) {
      return info;
    }

    const participated = await db
      .selectFrom('approval_histories')
      .select(['id'])
      .where('approval_request_id', '=', info.approvalRequestId)
      .where('actor_id', '=', auth.userId)
      .limit(1)
      .executeTakeFirst();

    if (participated) {
      return info;
    }
  }

  throw new AppError('FORBIDDEN', 'Bạn không có quyền truy cập đề xuất này.', 403);
}

export interface ListProposalsQuery {
  scope?: string | null;
  status?: string | null;
  categoryId?: string | null;
  priority?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  budgetId?: string | null;
  search?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  page?: string | null;
  limit?: string | null;
}

export async function listProposals(
  auth: AuthContext,
  query: ListProposalsQuery,
): Promise<{ items: ProposalListItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const scopeFilter = query.scope ?? 'all';
  const roleIds = auth.roles.map((r) => r.id);
  const accessScope = await resolveEmployeeAccessScope(auth);

  let baseQuery = db
    .selectFrom('proposals as p')
    .innerJoin('proposal_categories as c', 'c.id', 'p.category_id')
    .innerJoin('branches as b', 'b.id', 'p.branch_id')
    .leftJoin('departments as d', 'd.id', 'p.department_id')
    .leftJoin('payment_budgets as bud', 'bud.id', 'p.budget_id')
    .innerJoin('users as u', 'u.id', 'p.requester_user_id')
    .leftJoin('approval_requests as ar', 'ar.id', 'p.approval_request_id')
    .leftJoin('roles as apr_role', 'apr_role.id', 'ar.current_approver_role_id')
    .where('p.deleted_at', 'is', null);

  if (scopeFilter === 'my') {
    baseQuery = baseQuery.where('p.requester_user_id', '=', auth.userId);
  } else if (scopeFilter === 'pending_my_approval') {
    baseQuery = baseQuery
      .where('p.status', '=', 'PENDING_APPROVAL')
      .where('ar.status', '=', 'PENDING');
    if (!auth.isSuperAdmin) {
      baseQuery = baseQuery.where((eb) => {
        const conds = [eb('ar.current_approver_user_id', '=', auth.userId)];
        if (roleIds.length > 0) {
          conds.push(eb('ar.current_approver_role_id', 'in', roleIds));
        }
        return eb.or(conds);
      });
    }
  } else if (!hasManagePermission(auth) && accessScope.mode !== 'ALL') {
    baseQuery = baseQuery.where((eb) => {
      const conds = [
        eb('p.requester_user_id', '=', auth.userId),
        eb('ar.current_approver_user_id', '=', auth.userId),
      ];
      if (roleIds.length > 0) {
        conds.push(eb('ar.current_approver_role_id', 'in', roleIds));
      }
      if (accessScope.mode === 'BRANCH' && accessScope.branchIds.length > 0) {
        conds.push(eb('p.branch_id', 'in', accessScope.branchIds));
      } else if (accessScope.mode === 'DEPARTMENT' && accessScope.departmentIds.length > 0) {
        conds.push(eb('p.department_id', 'in', accessScope.departmentIds));
      }
      return eb.or(conds);
    });
  }

  if (query.status && query.status.trim().length > 0) {
    baseQuery = baseQuery.where('p.status', '=', query.status.trim() as ProposalStatus);
  }
  if (query.priority && query.priority.trim().length > 0) {
    baseQuery = baseQuery.where('p.priority', '=', query.priority.trim() as ProposalPriority);
  }
  if (query.categoryId && Number(query.categoryId) > 0) {
    baseQuery = baseQuery.where('p.category_id', '=', Number(query.categoryId));
  }
  if (query.branchId && Number(query.branchId) > 0) {
    baseQuery = baseQuery.where('p.branch_id', '=', Number(query.branchId));
  }
  if (query.departmentId && Number(query.departmentId) > 0) {
    baseQuery = baseQuery.where('p.department_id', '=', Number(query.departmentId));
  }
  if (query.budgetId && Number(query.budgetId) > 0) {
    baseQuery = baseQuery.where('p.budget_id', '=', Number(query.budgetId));
  }
  if (query.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(query.fromDate)) {
    baseQuery = baseQuery.where('p.created_at', '>=', new Date(`${query.fromDate}T00:00:00Z`));
  }
  if (query.toDate && /^\d{4}-\d{2}-\d{2}$/.test(query.toDate)) {
    baseQuery = baseQuery.where('p.created_at', '<=', new Date(`${query.toDate}T23:59:59Z`));
  }
  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('p.proposal_code', 'like', keyword),
        eb('p.title', 'like', keyword),
        eb('p.summary', 'like', keyword),
        eb('p.vendor_name', 'like', keyword),
        eb('u.full_name', 'like', keyword),
      ]),
    );
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('p.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select([
      'p.id',
      'p.proposal_code',
      'p.category_id',
      'c.code as category_code',
      'c.name as category_name',
      'c.name_en as category_name_en',
      'c.color_hex as category_color_hex',
      'p.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'p.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'p.budget_id',
      'bud.code as budget_code',
      'bud.name as budget_name',
      'bud.name_en as budget_name_en',
      'p.budget_reserved_amount',
      'p.is_over_budget',
      'p.requester_user_id',
      'u.full_name as requester_name',
      'p.title',
      'p.summary',
      'p.priority',
      'p.status',
      'p.estimated_budget',
      'p.approved_budget',
      'p.currency',
      'p.needed_by_date',
      'p.vendor_name',
      'p.approval_request_id',
      'ar.current_step as approval_current_step',
      'ar.total_steps as approval_total_steps',
      'apr_role.name as approval_role_name',
      'apr_role.name_en as approval_role_name_en',
      'p.submitted_at',
      'p.approved_at',
      'p.completed_at',
      'p.created_at',
      'p.updated_at',
    ])
    .orderBy('p.created_at', 'desc')
    .orderBy('p.id', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: ProposalListItem[] = rows.map((row) => ({
    id: Number(row.id),
    proposalCode: row.proposal_code,
    categoryId: Number(row.category_id),
    categoryCode: row.category_code,
    categoryName: row.category_name,
    categoryNameEn: row.category_name_en ?? null,
    categoryColorHex: row.category_color_hex,
    branchId: Number(row.branch_id),
    branchName: row.branch_name,
    branchNameEn: row.branch_name_en ?? null,
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    departmentName: row.department_name ?? null,
    departmentNameEn: row.department_name_en ?? null,
    budgetId: row.budget_id !== null ? Number(row.budget_id) : null,
    budgetCode: row.budget_code ?? null,
    budgetName: row.budget_name ?? null,
    budgetNameEn: row.budget_name_en ?? null,
    budgetReservedAmount: Number(row.budget_reserved_amount ?? 0),
    isOverBudget: Number(row.is_over_budget ?? 0) === 1,
    requesterUserId: Number(row.requester_user_id),
    requesterName: row.requester_name,
    title: row.title,
    summary: row.summary ?? null,
    priority: row.priority,
    status: row.status,
    estimatedBudget: Number(row.estimated_budget),
    approvedBudget: row.approved_budget !== null ? Number(row.approved_budget) : null,
    currency: row.currency,
    neededByDate: toIsoDate(row.needed_by_date),
    vendorName: row.vendor_name ?? null,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    approvalCurrentStep:
      row.approval_current_step !== null ? Number(row.approval_current_step) : null,
    approvalTotalSteps:
      row.approval_total_steps !== null ? Number(row.approval_total_steps) : null,
    approvalRoleName: row.approval_role_name ?? null,
    approvalRoleNameEn: row.approval_role_name_en ?? null,
    submittedAt: toIsoDateTime(row.submitted_at),
    approvedAt: toIsoDateTime(row.approved_at),
    completedAt: toIsoDateTime(row.completed_at),
    createdAt: toIsoDateTime(row.created_at)!,
    updatedAt: toIsoDateTime(row.updated_at)!,
  }));

  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function getProposalsSummary(auth: AuthContext): Promise<ProposalsSummaryView> {
  const { items } = await listProposals(auth, { scope: 'all', page: '1', limit: '100' });
  const { meta: pendingMyMeta } = await listProposals(auth, {
    scope: 'pending_my_approval',
    page: '1',
    limit: '1',
  });

  const summary: ProposalsSummaryView = {
    total: items.length,
    draftCount: 0,
    pendingCount: 0,
    needsRevisionCount: 0,
    approvedCount: 0,
    inExecutionCount: 0,
    completedCount: 0,
    rejectedCount: 0,
    cancelledCount: 0,
    pendingMyApprovalCount: pendingMyMeta.total,
    totalEstimatedBudget: 0,
    totalApprovedBudget: 0,
  };

  for (const item of items) {
    summary.totalEstimatedBudget = roundCurrency(
      summary.totalEstimatedBudget + item.estimatedBudget,
    );
    if (item.status === 'DRAFT') summary.draftCount += 1;
    else if (item.status === 'PENDING_APPROVAL') summary.pendingCount += 1;
    else if (item.status === 'NEEDS_REVISION') summary.needsRevisionCount += 1;
    else if (item.status === 'APPROVED') {
      summary.approvedCount += 1;
      summary.totalApprovedBudget = roundCurrency(
        summary.totalApprovedBudget + (item.approvedBudget ?? item.estimatedBudget),
      );
    } else if (item.status === 'IN_EXECUTION') {
      summary.inExecutionCount += 1;
      summary.totalApprovedBudget = roundCurrency(
        summary.totalApprovedBudget + (item.approvedBudget ?? item.estimatedBudget),
      );
    } else if (item.status === 'COMPLETED') {
      summary.completedCount += 1;
      summary.totalApprovedBudget = roundCurrency(
        summary.totalApprovedBudget + (item.approvedBudget ?? item.estimatedBudget),
      );
    } else if (item.status === 'REJECTED') summary.rejectedCount += 1;
    else if (item.status === 'CANCELLED') summary.cancelledCount += 1;
  }

  return summary;
}

export async function getProposalDetail(
  auth: AuthContext,
  proposalId: number,
): Promise<ProposalDetailView> {
  await assertProposalViewAccess(auth, proposalId);
  const db = getDb();

  const row = await db
    .selectFrom('proposals as p')
    .innerJoin('proposal_categories as c', 'c.id', 'p.category_id')
    .innerJoin('branches as b', 'b.id', 'p.branch_id')
    .leftJoin('departments as d', 'd.id', 'p.department_id')
    .leftJoin('payment_budgets as bud', 'bud.id', 'p.budget_id')
    .innerJoin('users as u', 'u.id', 'p.requester_user_id')
    .leftJoin('approval_requests as ar', 'ar.id', 'p.approval_request_id')
    .leftJoin('roles as apr_role', 'apr_role.id', 'ar.current_approver_role_id')
    .select([
      'p.id',
      'p.proposal_code',
      'p.category_id',
      'c.code as category_code',
      'c.name as category_name',
      'c.name_en as category_name_en',
      'c.color_hex as category_color_hex',
      'p.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'p.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'p.budget_id',
      'bud.code as budget_code',
      'bud.name as budget_name',
      'bud.name_en as budget_name_en',
      'p.budget_reserved_amount',
      'p.is_over_budget',
      'bud.allocated_amount as budget_allocated_amount',
      'bud.reserved_amount as budget_total_reserved',
      'bud.spent_amount as budget_total_spent',
      'bud.enforcement_mode as budget_enforcement_mode',
      'p.requester_user_id',
      'u.full_name as requester_name',
      'p.title',
      'p.summary',
      'p.content',
      'p.expected_outcome',
      'p.priority',
      'p.status',
      'p.estimated_budget',
      'p.approved_budget',
      'p.currency',
      'p.needed_by_date',
      'p.effective_from',
      'p.effective_to',
      'p.vendor_name',
      'p.approval_request_id',
      'ar.current_step as approval_current_step',
      'ar.total_steps as approval_total_steps',
      'apr_role.name as approval_role_name',
      'apr_role.name_en as approval_role_name_en',
      'p.submitted_at',
      'p.approved_at',
      'p.completed_at',
      'p.rejection_reason',
      'p.execution_notes',
      'p.created_at',
      'p.updated_at',
    ])
    .where('p.id', '=', proposalId)
    .where('p.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('PROPOSAL_NOT_FOUND', 'Không tìm thấy đề xuất nội bộ.', 404);
  }

  const [itemRows, activityRows] = await Promise.all([
    db
      .selectFrom('proposal_items')
      .select([
        'id',
        'line_no',
        'item_name',
        'specification',
        'unit',
        'quantity',
        'unit_price',
        'line_total',
        'vendor_note',
      ])
      .where('proposal_id', '=', proposalId)
      .where('deleted_at', 'is', null)
      .orderBy('line_no', 'asc')
      .orderBy('id', 'asc')
      .execute(),
    db
      .selectFrom('proposal_activities as a')
      .leftJoin('users as u', 'u.id', 'a.actor_user_id')
      .select([
        'a.id',
        'a.actor_user_id',
        'u.full_name as actor_name',
        'a.action_type',
        'a.detail_json',
        'a.created_at',
      ])
      .where('a.proposal_id', '=', proposalId)
      .orderBy('a.created_at', 'desc')
      .orderBy('a.id', 'desc')
      .execute(),
  ]);

  let approvalDetail: ProposalDetailView['approval'] = null;
  if (row.approval_request_id) {
    try {
      approvalDetail = await getApprovalDetailWithHistory(
        Number(row.approval_request_id),
        auth,
      );
    } catch {
      approvalDetail = null;
    }
  }

  const isOwner = Number(row.requester_user_id) === auth.userId;
  const isManager = hasManagePermission(auth);
  const isPendingApproval = row.status === 'PENDING_APPROVAL';
  const canEdit =
    (isOwner || isManager) &&
    (row.status === 'DRAFT' || row.status === 'NEEDS_REVISION');
  const canDelete =
    (isOwner || isManager) &&
    (row.status === 'DRAFT' || row.status === 'CANCELLED');
  const canSubmit =
    (isOwner || isManager) &&
    (row.status === 'DRAFT' || row.status === 'NEEDS_REVISION');
  const canRequestRevision =
    isPendingApproval &&
    (Boolean(approvalDetail?.canApproveOrReject) || isManager);
  const canCancel =
    (isOwner || isManager) &&
    (row.status === 'DRAFT' ||
      isPendingApproval ||
      row.status === 'NEEDS_REVISION');
  const canStartExecution =
    (isManager || isOwner) && row.status === 'APPROVED';
  const canComplete =
    (isManager || isOwner) &&
    (row.status === 'APPROVED' || row.status === 'IN_EXECUTION');
  const canComment = isPendingApproval;
  const canUploadAttachment = isPendingApproval && (isOwner || isManager);

  return {
    id: Number(row.id),
    proposalCode: row.proposal_code,
    categoryId: Number(row.category_id),
    categoryCode: row.category_code,
    categoryName: row.category_name,
    categoryNameEn: row.category_name_en ?? null,
    categoryColorHex: row.category_color_hex,
    branchId: Number(row.branch_id),
    branchName: row.branch_name,
    branchNameEn: row.branch_name_en ?? null,
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    departmentName: row.department_name ?? null,
    departmentNameEn: row.department_name_en ?? null,
    budgetId: row.budget_id !== null ? Number(row.budget_id) : null,
    budgetCode: row.budget_code ?? null,
    budgetName: row.budget_name ?? null,
    budgetNameEn: row.budget_name_en ?? null,
    budgetReservedAmount: Number(row.budget_reserved_amount ?? 0),
    isOverBudget: Number(row.is_over_budget ?? 0) === 1,
    budgetAllocatedAmount:
      row.budget_allocated_amount !== null && row.budget_allocated_amount !== undefined
        ? Number(row.budget_allocated_amount)
        : null,
    budgetAvailableAmount:
      row.budget_allocated_amount !== null && row.budget_allocated_amount !== undefined
        ? roundCurrency(
            Number(row.budget_allocated_amount) -
              Number(row.budget_total_reserved ?? 0) -
              Number(row.budget_total_spent ?? 0),
          )
        : null,
    budgetEnforcementMode: row.budget_enforcement_mode ?? null,
    requesterUserId: Number(row.requester_user_id),
    requesterName: row.requester_name,
    title: row.title,
    summary: row.summary ?? null,
    content: row.content,
    expectedOutcome: row.expected_outcome ?? null,
    priority: row.priority,
    status: row.status,
    estimatedBudget: Number(row.estimated_budget),
    approvedBudget: row.approved_budget !== null ? Number(row.approved_budget) : null,
    currency: row.currency,
    neededByDate: toIsoDate(row.needed_by_date),
    effectiveFrom: toIsoDate(row.effective_from),
    effectiveTo: toIsoDate(row.effective_to),
    vendorName: row.vendor_name ?? null,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    approvalCurrentStep:
      row.approval_current_step !== null ? Number(row.approval_current_step) : null,
    approvalTotalSteps:
      row.approval_total_steps !== null ? Number(row.approval_total_steps) : null,
    approvalRoleName: row.approval_role_name ?? null,
    approvalRoleNameEn: row.approval_role_name_en ?? null,
    submittedAt: toIsoDateTime(row.submitted_at),
    approvedAt: toIsoDateTime(row.approved_at),
    completedAt: toIsoDateTime(row.completed_at),
    rejectionReason: row.rejection_reason ?? null,
    executionNotes: row.execution_notes ?? null,
    createdAt: toIsoDateTime(row.created_at)!,
    updatedAt: toIsoDateTime(row.updated_at)!,
    items: itemRows.map((i) => ({
      id: Number(i.id),
      lineNo: Number(i.line_no),
      itemName: i.item_name,
      specification: i.specification ?? null,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
      vendorNote: i.vendor_note ?? null,
    })),
    activities: activityRows.map((a) => ({
      id: Number(a.id),
      actorUserId: Number(a.actor_user_id),
      actorName: a.actor_name ?? null,
      actionType: a.action_type,
      detail: safeJsonParse(a.detail_json),
      createdAt: toIsoDateTime(a.created_at)!,
    })),
    approval: approvalDetail,
    actions: {
      canEdit,
      canDelete,
      canSubmit,
      canRequestRevision,
      canCancel,
      canStartExecution,
      canComplete,
      canComment,
      canUploadAttachment,
    },
  };
}

export async function createProposal(
  input: CreateProposalInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<ProposalDetailView> {
  const db = getDb();
  const empCtx = await resolveRequesterEmployeeContext(auth.userId);

  const category = await db
    .selectFrom('proposal_categories')
    .select(['id', 'default_request_type', 'is_active'])
    .where('id', '=', input.categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!category || Number(category.is_active) !== 1) {
    throw new AppError('INVALID_CATEGORY', 'Danh mục đề xuất không tồn tại hoặc đang tạm ngưng.', 400);
  }

  let branchId: number | null = input.branchId ?? empCtx.branchId ?? auth.branchIds[0] ?? null;
  if (!branchId) {
    const hq = await db
      .selectFrom('branches')
      .select(['id'])
      .where('deleted_at', 'is', null)
      .orderBy('is_headquarters', 'desc')
      .orderBy('id', 'asc')
      .limit(1)
      .executeTakeFirst();
    branchId = hq ? Number(hq.id) : null;
  }
  if (!branchId) {
    throw new AppError('INVALID_BRANCH', 'Không xác định được chi nhánh áp dụng.', 400);
  }
  const resolvedBranchId = branchId;

  const departmentId = input.departmentId !== undefined ? input.departmentId : empCtx.departmentId;
  let resolvedBudgetId: number | null = input.budgetId ?? null;
  if (resolvedBudgetId) {
    const budget = await db
      .selectFrom('payment_budgets')
      .select(['id', 'status'])
      .where('id', '=', resolvedBudgetId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!budget) {
      throw new AppError('INVALID_BUDGET', 'Quỹ ngân sách được chọn không tồn tại.', 400);
    }
    if (budget.status !== 'ACTIVE') {
      throw new AppError(
        'BUDGET_NOT_ACTIVE',
        'Chỉ có thể chọn quỹ ngân sách đang hiệu lực (ACTIVE).',
        409,
      );
    }
    resolvedBudgetId = Number(budget.id);
  }
  const items = input.items ?? [];
  const calculated = calculateProposalLineTotals(items);
  const estimatedBudget =
    items.length > 0 ? calculated.grandTotal : roundCurrency(input.estimatedBudget ?? 0);

  const created = await db.transaction().execute(async (trx) => {
    const proposalCode = await generateNextProposalCode(trx);

    const inserted = await trx
      .insertInto('proposals')
      .values({
        proposal_code: proposalCode,
        category_id: input.categoryId,
        branch_id: resolvedBranchId,
        department_id: departmentId ?? null,
        budget_id: resolvedBudgetId,
        requester_employee_id: empCtx.employeeId,
        requester_user_id: auth.userId,
        title: input.title,
        summary: input.summary?.trim() || null,
        content: input.content,
        expected_outcome: input.expectedOutcome?.trim() || null,
        priority: input.priority,
        status: 'DRAFT',
        estimated_budget: estimatedBudget,
        approved_budget: null,
        budget_reserved_amount: 0,
        is_over_budget: 0,
        currency: 'VND',
        needed_by_date: input.neededByDate ?? null,
        effective_from: input.effectiveFrom ?? null,
        effective_to: input.effectiveTo ?? null,
        vendor_name: input.vendorName?.trim() || null,
        approval_request_id: null,
        submitted_at: null,
        approved_at: null,
        completed_at: null,
        rejection_reason: null,
        execution_notes: null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    const proposalId = Number(inserted.insertId);
    if (items.length > 0) {
      await replaceProposalItems(trx, proposalId, items, auth.userId);
    }

    await trx
      .insertInto('proposal_activities')
      .values({
        proposal_id: proposalId,
        actor_user_id: auth.userId,
        action_type: 'CREATED',
        detail_json: JSON.stringify({ proposalCode, estimatedBudget }),
      })
      .execute();

    return { proposalId, proposalCode };
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PROPOSAL_MODULE_CODE,
    action: 'PROPOSAL_CREATE',
    entityType: PROPOSAL_ENTITY_TYPE,
    entityId: created.proposalId,
    newValues: {
      proposalCode: created.proposalCode,
      title: input.title,
      estimatedBudget,
    },
    ipAddress,
  });

  if (input.submitImmediately) {
    return submitProposalForApproval(created.proposalId, auth, ipAddress);
  }

  return getProposalDetail(auth, created.proposalId);
}

export async function updateProposal(
  proposalId: number,
  input: UpdateProposalInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<ProposalDetailView> {
  const existing = await assertProposalViewAccess(auth, proposalId);
  const isOwner = existing.requesterUserId === auth.userId;
  if (!isOwner && !hasManagePermission(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền chỉnh sửa đề xuất này.', 403);
  }

  if (existing.status !== 'DRAFT' && existing.status !== 'NEEDS_REVISION') {
    throw new AppError(
      'PROPOSAL_LOCKED',
      'Chỉ có thể chỉnh sửa đề xuất khi đang ở trạng thái Nháp hoặc Cần chỉnh sửa.',
      409,
    );
  }

  const db = getDb();
  if (input.categoryId !== undefined) {
    const cat = await db
      .selectFrom('proposal_categories')
      .select(['id'])
      .where('id', '=', input.categoryId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!cat) {
      throw new AppError('INVALID_CATEGORY', 'Danh mục đề xuất không hợp lệ.', 400);
    }
  }

  if (input.budgetId !== undefined && input.budgetId !== null) {
    const budget = await db
      .selectFrom('payment_budgets')
      .select(['id', 'status'])
      .where('id', '=', input.budgetId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!budget) {
      throw new AppError('INVALID_BUDGET', 'Quỹ ngân sách được chọn không tồn tại.', 400);
    }
    if (budget.status !== 'ACTIVE' && input.budgetId !== existing.budgetId) {
      throw new AppError(
        'BUDGET_NOT_ACTIVE',
        'Chỉ có thể chuyển sang quỹ ngân sách đang hiệu lực (ACTIVE).',
        409,
      );
    }
  }

  await db.transaction().execute(async (trx) => {
    let nextBudget =
      input.estimatedBudget !== undefined
        ? roundCurrency(input.estimatedBudget)
        : existing.estimatedBudget;

    if (input.items !== undefined) {
      const itemsTotal = await replaceProposalItems(trx, proposalId, input.items, auth.userId);
      if (input.items.length > 0) {
        nextBudget = itemsTotal;
      }
    }

    await trx
      .updateTable('proposals')
      .set({
        ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
        ...(input.branchId !== undefined ? { branch_id: input.branchId } : {}),
        ...(input.departmentId !== undefined ? { department_id: input.departmentId } : {}),
        ...(input.budgetId !== undefined ? { budget_id: input.budgetId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary?.trim() || null } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.expectedOutcome !== undefined
          ? { expected_outcome: input.expectedOutcome?.trim() || null }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        estimated_budget: nextBudget,
        ...(input.neededByDate !== undefined ? { needed_by_date: input.neededByDate } : {}),
        ...(input.effectiveFrom !== undefined ? { effective_from: input.effectiveFrom } : {}),
        ...(input.effectiveTo !== undefined ? { effective_to: input.effectiveTo } : {}),
        ...(input.vendorName !== undefined
          ? { vendor_name: input.vendorName?.trim() || null }
          : {}),
        updated_by: auth.userId,
      })
      .where('id', '=', proposalId)
      .execute();

    await trx
      .insertInto('proposal_activities')
      .values({
        proposal_id: proposalId,
        actor_user_id: auth.userId,
        action_type: 'UPDATED',
        detail_json: JSON.stringify({ estimatedBudget: nextBudget }),
      })
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PROPOSAL_MODULE_CODE,
    action: 'PROPOSAL_UPDATE',
    entityType: PROPOSAL_ENTITY_TYPE,
    entityId: proposalId,
    newValues: { title: input.title ?? existing.title },
    ipAddress,
  });

  return getProposalDetail(auth, proposalId);
}

export async function softDeleteProposal(
  proposalId: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<void> {
  const existing = await assertProposalViewAccess(auth, proposalId);
  const isOwner = existing.requesterUserId === auth.userId;
  if (!isOwner && !hasManagePermission(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xóa đề xuất này.', 403);
  }
  if (existing.status !== 'DRAFT' && existing.status !== 'CANCELLED') {
    throw new AppError(
      'PROPOSAL_CANNOT_DELETE',
      'Chỉ có thể lưu trữ/xóa mềm đề xuất ở trạng thái Nháp hoặc Đã hủy.',
      409,
    );
  }

  const db = getDb();
  await db
    .updateTable('proposals')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', proposalId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PROPOSAL_MODULE_CODE,
    action: 'PROPOSAL_DELETE',
    entityType: PROPOSAL_ENTITY_TYPE,
    entityId: proposalId,
    oldValues: { proposalCode: existing.proposalCode, status: existing.status },
    ipAddress,
  });
}

export async function submitProposalForApproval(
  proposalId: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<ProposalDetailView> {
  const existing = await assertProposalViewAccess(auth, proposalId);
  const isOwner = existing.requesterUserId === auth.userId;
  if (!isOwner && !hasManagePermission(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền gửi duyệt đề xuất này.', 403);
  }

  if (!canTransitionProposalStatus(existing.status, 'PENDING_APPROVAL')) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      'Chỉ có thể gửi duyệt đề xuất ở trạng thái Nháp hoặc Cần chỉnh sửa.',
      409,
    );
  }

  const db = getDb();
  const [category, empCtx] = await Promise.all([
    db
      .selectFrom('proposal_categories')
      .select(['default_request_type', 'name'])
      .where('id', '=', existing.categoryId)
      .executeTakeFirst(),
    resolveRequesterEmployeeContext(existing.requesterUserId),
  ]);

  const requestType = category?.default_request_type || PROPOSAL_DEFAULT_REQUEST_TYPE;
  const isResubmit = existing.status === 'NEEDS_REVISION';

  let budgetAlert: BudgetAlertInfo | null = null;

  const approvalResult = await db.transaction().execute(async (trx) => {
    if (existing.budgetId && existing.estimatedBudget > 0) {
      const reserveRes = await reserveBudgetForProposal(trx, {
        budgetId: existing.budgetId,
        proposalId,
        proposalCode: existing.proposalCode,
        amount: existing.estimatedBudget,
        branchId: existing.branchId,
        actorUserId: auth.userId,
      });
      budgetAlert = reserveRes.alert;
    }

    const createdApproval = await createApprovalRequest(
      {
        moduleCode: PROPOSAL_MODULE_CODE,
        requestType,
        entityType: PROPOSAL_ENTITY_TYPE,
        entityId: proposalId,
        branchId: existing.branchId,
        requesterId: existing.requesterUserId,
        directManagerUserId: empCtx.directManagerUserId,
        title: `[${existing.proposalCode}] ${existing.title}`,
        summary: `Danh mục: ${category?.name ?? requestType} • Dự toán: ${existing.estimatedBudget.toLocaleString('vi-VN')} ₫`,
        evalContext: { amount: existing.estimatedBudget },
      },
      trx,
    );

    await trx
      .updateTable('proposals')
      .set({
        status: 'PENDING_APPROVAL',
        approval_request_id: createdApproval.approvalRequestId,
        submitted_at: new Date(),
        rejection_reason: null,
        updated_by: auth.userId,
      })
      .where('id', '=', proposalId)
      .execute();

    await trx
      .insertInto('proposal_activities')
      .values({
        proposal_id: proposalId,
        actor_user_id: auth.userId,
        action_type: isResubmit ? 'RESUBMITTED' : 'SUBMITTED',
        detail_json: JSON.stringify({
          approvalRequestId: createdApproval.approvalRequestId,
          totalSteps: createdApproval.totalSteps,
          estimatedBudget: existing.estimatedBudget,
          budgetId: existing.budgetId,
        }),
      })
      .execute();

    return createdApproval;
  });

  await notifyApprovalRequestCreated(approvalResult.approvalRequestId);
  await notifyBudgetAlertIfNeeded(budgetAlert, auth.userId);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PROPOSAL_MODULE_CODE,
    action: isResubmit ? 'PROPOSAL_RESUBMIT' : 'PROPOSAL_SUBMIT',
    entityType: PROPOSAL_ENTITY_TYPE,
    entityId: proposalId,
    newValues: {
      status: 'PENDING_APPROVAL',
      approvalRequestId: approvalResult.approvalRequestId,
    },
    ipAddress,
  });

  return getProposalDetail(auth, proposalId);
}

export async function transitionProposalStatus(
  proposalId: number,
  input: ProposalStatusActionInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<ProposalDetailView> {
  const existing = await assertProposalViewAccess(auth, proposalId);
  const db = getDb();
  const isOwner = existing.requesterUserId === auth.userId;
  const isManager = hasManagePermission(auth);

  if (input.action === 'REQUEST_REVISION') {
    if (!canTransitionProposalStatus(existing.status, 'NEEDS_REVISION')) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        'Chỉ có thể yêu cầu chỉnh sửa khi đề xuất đang Chờ phê duyệt.',
        409,
      );
    }

    let canApproveNow = isManager;
    if (!canApproveNow && existing.approvalRequestId) {
      const ar = await db
        .selectFrom('approval_requests')
        .select(['requester_id', 'current_approver_user_id', 'current_approver_role_id'])
        .where('id', '=', existing.approvalRequestId)
        .executeTakeFirst();
      if (ar) {
        canApproveNow = canUserActOnApproval(
          {
            requesterId: Number(ar.requester_id),
            currentApproverUserId:
              ar.current_approver_user_id !== null ? Number(ar.current_approver_user_id) : null,
            currentApproverRoleId:
              ar.current_approver_role_id !== null ? Number(ar.current_approver_role_id) : null,
          },
          auth,
          'APPROVE',
        );
      }
    }

    if (!canApproveNow) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền yêu cầu chỉnh sửa đề xuất này.', 403);
    }

    const note = input.comment?.trim() || 'Yêu cầu bổ sung và chỉnh sửa lại nội dung đề xuất.';

    await db.transaction().execute(async (trx) => {
      if (existing.approvalRequestId) {
        await trx
          .updateTable('approval_requests')
          .set({
            status: 'CANCELLED',
            current_approver_user_id: null,
            current_approver_role_id: null,
            completed_at: new Date(),
          })
          .where('id', '=', existing.approvalRequestId)
          .where('status', '=', 'PENDING')
          .execute();

        await trx
          .insertInto('approval_histories')
          .values({
            approval_request_id: existing.approvalRequestId,
            step_order: 1,
            actor_id: auth.userId,
            action: 'CANCEL',
            comment: `[Yêu cầu chỉnh sửa] ${note}`,
          })
          .execute();
      }

      await releaseProposalBudgetReserve(trx, {
        proposalId,
        proposalCode: existing.proposalCode,
        actorUserId: auth.userId,
        reason: `Hoàn trả giữ chỗ do yêu cầu chỉnh sửa Đề xuất ${existing.proposalCode}`,
      });

      await trx
        .updateTable('proposals')
        .set({
          status: 'NEEDS_REVISION',
          rejection_reason: note,
          updated_by: auth.userId,
        })
        .where('id', '=', proposalId)
        .execute();

      await trx
        .insertInto('proposal_comments')
        .values({
          proposal_id: proposalId,
          author_user_id: auth.userId,
          comment_type: 'REVISION_REQUEST',
          content: note,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .execute();

      await trx
        .insertInto('proposal_activities')
        .values({
          proposal_id: proposalId,
          actor_user_id: auth.userId,
          action_type: 'REVISION_REQUESTED',
          detail_json: JSON.stringify({ comment: note }),
        })
        .execute();
    });

    if (existing.requesterUserId !== auth.userId) {
      await createNotification({
        userId: existing.requesterUserId,
        moduleCode: PROPOSAL_MODULE_CODE,
        type: 'PROPOSAL_REVISION_REQUESTED',
        title: `Yêu cầu chỉnh sửa đề xuất [${existing.proposalCode}]`,
        message: `${auth.fullName} đã yêu cầu chỉnh sửa "${existing.title}": ${note}`,
        linkUrl: `/services/proposals/${proposalId}`,
      });
    }
  } else if (input.action === 'CANCEL') {
    if (!isOwner && !isManager) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền hủy đề xuất này.', 403);
    }
    if (!canTransitionProposalStatus(existing.status, 'CANCELLED')) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        'Không thể hủy đề xuất ở trạng thái hiện tại.',
        409,
      );
    }

    await db.transaction().execute(async (trx) => {
      if (existing.approvalRequestId) {
        await trx
          .updateTable('approval_requests')
          .set({
            status: 'CANCELLED',
            current_approver_user_id: null,
            current_approver_role_id: null,
            completed_at: new Date(),
          })
          .where('id', '=', existing.approvalRequestId)
          .where('status', '=', 'PENDING')
          .execute();

        await trx
          .insertInto('approval_histories')
          .values({
            approval_request_id: existing.approvalRequestId,
            step_order: 1,
            actor_id: auth.userId,
            action: 'CANCEL',
            comment: input.comment?.trim() || 'Người tạo hủy đề xuất',
          })
          .execute();
      }

      await releaseProposalBudgetReserve(trx, {
        proposalId,
        proposalCode: existing.proposalCode,
        actorUserId: auth.userId,
        reason: `Hoàn trả giữ chỗ do hủy Đề xuất ${existing.proposalCode}`,
      });

      await trx
        .updateTable('proposals')
        .set({
          status: 'CANCELLED',
          rejection_reason: input.comment?.trim() || null,
          updated_by: auth.userId,
        })
        .where('id', '=', proposalId)
        .execute();

      await trx
        .insertInto('proposal_activities')
        .values({
          proposal_id: proposalId,
          actor_user_id: auth.userId,
          action_type: 'CANCELLED',
          detail_json: JSON.stringify({ comment: input.comment?.trim() || null }),
        })
        .execute();
    });
  } else if (input.action === 'START_EXECUTION') {
    if (!isOwner && !isManager) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền cập nhật triển khai đề xuất này.', 403);
    }
    if (!canTransitionProposalStatus(existing.status, 'IN_EXECUTION')) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        'Chỉ có thể bắt đầu thực thi khi đề xuất đã được phê duyệt.',
        409,
      );
    }

    await db.transaction().execute(async (trx) => {
      if (input.approvedBudget !== undefined && input.approvedBudget !== null) {
        await releaseProposalBudgetReserve(trx, {
          proposalId,
          proposalCode: existing.proposalCode,
          actorUserId: auth.userId,
          reason: `Điều chỉnh giảm giữ chỗ theo ngân sách duyệt mới của Đề xuất ${existing.proposalCode}`,
          targetRemainingReserve: roundCurrency(input.approvedBudget),
        });
      }

      await trx
        .updateTable('proposals')
        .set({
          status: 'IN_EXECUTION',
          ...(input.approvedBudget !== undefined && input.approvedBudget !== null
            ? { approved_budget: roundCurrency(input.approvedBudget) }
            : {}),
          ...(input.executionNotes !== undefined
            ? { execution_notes: input.executionNotes?.trim() || null }
            : {}),
          updated_by: auth.userId,
        })
        .where('id', '=', proposalId)
        .execute();

      await trx
        .insertInto('proposal_activities')
        .values({
          proposal_id: proposalId,
          actor_user_id: auth.userId,
          action_type: 'EXECUTION_STARTED',
          detail_json: JSON.stringify({ notes: input.executionNotes?.trim() || null }),
        })
        .execute();
    });
  } else if (input.action === 'COMPLETE') {
    if (!isOwner && !isManager) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền đánh dấu hoàn tất đề xuất này.', 403);
    }
    if (!canTransitionProposalStatus(existing.status, 'COMPLETED')) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        'Chỉ có thể hoàn tất đề xuất đã phê duyệt hoặc đang thực thi.',
        409,
      );
    }

    await db.transaction().execute(async (trx) => {
      await releaseProposalBudgetReserve(trx, {
        proposalId,
        proposalCode: existing.proposalCode,
        actorUserId: auth.userId,
        reason: `Hoàn trả phần dự toán chưa sử dụng khi hoàn tất Đề xuất ${existing.proposalCode}`,
      });

      await trx
        .updateTable('proposals')
        .set({
          status: 'COMPLETED',
          completed_at: new Date(),
          ...(input.approvedBudget !== undefined && input.approvedBudget !== null
            ? { approved_budget: roundCurrency(input.approvedBudget) }
            : {}),
          ...(input.executionNotes !== undefined
            ? { execution_notes: input.executionNotes?.trim() || null }
            : {}),
          updated_by: auth.userId,
        })
        .where('id', '=', proposalId)
        .execute();

      await trx
        .insertInto('proposal_activities')
        .values({
          proposal_id: proposalId,
          actor_user_id: auth.userId,
          action_type: 'COMPLETED',
          detail_json: JSON.stringify({
            approvedBudget: input.approvedBudget ?? null,
            notes: input.executionNotes?.trim() || null,
          }),
        })
        .execute();
    });
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PROPOSAL_MODULE_CODE,
    action: `PROPOSAL_${input.action}`,
    entityType: PROPOSAL_ENTITY_TYPE,
    entityId: proposalId,
    oldValues: { status: existing.status },
    newValues: { action: input.action },
    ipAddress,
  });

  return getProposalDetail(auth, proposalId);
}
