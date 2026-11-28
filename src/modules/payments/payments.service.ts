import { sql, type Transaction } from 'kysely';
import {
  getDb,
  type DatabaseSchema,
  type PaymentBeneficiaryType,
  type PaymentMethod,
  type PaymentPriority,
  type PaymentStatus,
  type PaymentType,
} from '@/config/database';
import {
  amountToEnglishWords,
  amountToVietnameseWords,
  calculatePaymentLineItems,
  canCollaborateOnPaymentStatus,
  computeAdvanceSettlement,
  evaluateDisbursementProgress,
  formatPaymentCode,
  type SettlementDirection,
} from '@/lib/portable/payment-calculator';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import {
  canAuthActOnApproval,
  createApprovalRequest,
  getApprovalDetailWithHistory,
  listActionablePendingApprovals,
  notifyApprovalRequestCreated,
  type ApprovalHistoryView,
  type ApprovalRequestItem,
} from '@/modules/approvals/approvals.service';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { resolveEmployeeAccessScope } from '@/modules/hrm/employees/employees.scope';
import { createNotification } from '@/modules/notifications/notifications.service';
import { listProjects } from '@/modules/projects/projects.service';
import {
  notifyBudgetAlertIfNeeded,
  releasePaymentBudgetReserve,
  reserveBudgetForPayment,
  type BudgetAlertInfo,
} from '@/modules/payments/budget-ledger.service';
import {
  listActiveBudgetOptions,
  type BudgetOptionView,
} from '@/modules/payments/budgets.service';
import {
  PAYMENT_DEFAULT_REQUEST_TYPE,
  PAYMENT_ENTITY_TYPE,
  PAYMENT_MODULE_CODE,
} from '@/modules/payments/payments.constants';
import type {
  CreatePaymentCategoryInput,
  CreatePaymentInput,
  PaymentLineItemSchemaInput,
  PaymentStatusActionInput,
  UpdatePaymentCategoryInput,
  UpdatePaymentInput,
} from '@/modules/payments/payments.schema';
import { AppError } from '@/shared/api-response';

export interface PaymentCategoryView {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  defaultPaymentType: PaymentType;
  requiresReceipt: boolean;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PaymentListItemView {
  id: number;
  code: string;
  paymentType: PaymentType;
  categoryId: number;
  categoryName: string;
  categoryNameEn: string | null;
  categoryColor: string;
  title: string;
  priority: PaymentPriority;
  status: PaymentStatus;
  requesterUserId: number;
  requesterName: string;
  branchId: number | null;
  branchName: string | null;
  branchNameEn: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  budgetId: number | null;
  budgetCode: string | null;
  budgetName: string | null;
  budgetNameEn: string | null;
  budgetReservedAmount: number;
  budgetSpentAmount: number;
  proposalReserveUsed: number;
  isOverBudget: boolean;
  proposalId: number | null;
  proposalCode: string | null;
  projectId: number | null;
  projectCode: string | null;
  linkedAdvanceId: number | null;
  isSettled: boolean;
  paymentMethod: PaymentMethod;
  beneficiaryType: PaymentBeneficiaryType;
  beneficiaryName: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  advanceAmount: number;
  netSettlementAmount: number;
  payableAmount: number;
  approvedAmount: number | null;
  disbursedAmount: number;
  remainingAmount: number;
  disbursementProgressPercent: number;
  settlementDirection: SettlementDirection | null;
  dueDate: string | null;
  advanceDueDate: string | null;
  isOverdue: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentLineItemView {
  id: number;
  description: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotalAmount: number;
  taxAmount: number;
  lineTotal: number;
  note: string | null;
  sortOrder: number;
}

export interface PaymentDisbursementView {
  id: number;
  direction: 'OUTGOING' | 'INCOMING_REFUND';
  disbursementDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankTransactionRef: string | null;
  sourceAccount: string | null;
  note: string | null;
  disbursedByUserId: number;
  disbursedByName: string;
  createdAt: string;
}

export interface PaymentCommentView {
  id: number;
  authorUserId: number;
  authorName: string;
  commentType: 'GENERAL' | 'REVISION_REQUEST' | 'FINANCE_NOTE' | 'SYSTEM';
  content: string;
  createdAt: string;
}

export interface PaymentAttachmentView {
  id: number;
  attachmentKind: 'INVOICE' | 'RECEIPT' | 'CONTRACT' | 'UNC_RECEIPT' | 'OTHER';
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId: number;
  uploadedByName: string;
  createdAt: string;
  canDelete: boolean;
}

export interface PaymentActivityView {
  id: number;
  actorUserId: number | null;
  actorName: string | null;
  action: string;
  summary: string;
  createdAt: string;
}

export interface PaymentDetailActions {
  canEdit: boolean;
  canDelete: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  canRequestRevision: boolean;
  canDisburse: boolean;
  canConfirmRefund: boolean;
  canCreateSettlement: boolean;
  canComment: boolean;
  canUploadAttachment: boolean;
  canUploadUncReceipt: boolean;
  canExportPdf: boolean;
}

export interface PaymentDetailView extends PaymentListItemView {
  budgetAllocatedAmount: number | null;
  budgetAvailableAmount: number | null;
  budgetEnforcementMode: 'HARD_BLOCK' | 'SOFT_WARN' | null;
  description: string;
  beneficiaryTaxCode: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankBranch: string | null;
  categoryRequiresReceipt: boolean;
  rejectionReason: string | null;
  revisionNote: string | null;
  approvalRequestId: number | null;
  linkedAdvanceCode: string | null;
  linkedAdvanceTitle: string | null;
  proposalTitle: string | null;
  projectName: string | null;
  settledByPaymentId: number | null;
  settledByPaymentCode: string | null;
  amountInWordsVi: string;
  amountInWordsEn: string;
  items: PaymentLineItemView[];
  disbursements: PaymentDisbursementView[];
  comments: PaymentCommentView[];
  attachments: PaymentAttachmentView[];
  activities: PaymentActivityView[];
  approval: {
    request: ApprovalRequestItem;
    histories: ApprovalHistoryView[];
    canApproveOrReject: boolean;
    canCancel: boolean;
  } | null;
  actions: PaymentDetailActions;
}

export interface ListPaymentsQuery {
  scope?: string;
  paymentType?: string;
  status?: string;
  priority?: string;
  categoryId?: number;
  branchId?: number;
  budgetId?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaymentSummaryView {
  totalCount: number;
  totalAmount: number;
  pendingMyApprovalCount: number;
  pendingMyApprovalAmount: number;
  readyToDisburseCount: number;
  readyToDisburseAmount: number;
  paidThisMonthCount: number;
  paidThisMonthAmount: number;
  unsettledAdvancesCount: number;
  unsettledAdvancesAmount: number;
  overdueAdvancesCount: number;
  overdueDueDateCount: number;
  draftCount: number;
  needsRevisionCount: number;
}

export interface PaymentFormOptionsView {
  myBankProfile: {
    fullName: string;
    bankName: string | null;
    bankAccountNo: string | null;
    branchId: number | null;
    departmentId: number | null;
  };
  openAdvances: Array<{
    id: number;
    code: string;
    title: string;
    disbursedAmount: number;
    advanceDueDate: string | null;
    budgetId: number | null;
    budgetCode: string | null;
    budgetName: string | null;
    budgetNameEn: string | null;
  }>;
  approvedProposals: Array<{
    id: number;
    code: string;
    title: string;
    approvedBudget: number;
    budgetId: number | null;
    budgetCode: string | null;
    budgetName: string | null;
    budgetNameEn: string | null;
    budgetReservedAmount: number;
    vendorName: string | null;
  }>;
  activeProjects: Array<{
    id: number;
    code: string;
    name: string;
  }>;
  activeBudgets: BudgetOptionView[];
}

export interface PaymentAccessRow {
  id: number;
  code: string;
  paymentType: PaymentType;
  status: PaymentStatus;
  requesterUserId: number;
  branchId: number | null;
  departmentId: number | null;
  approvalRequestId: number | null;
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function toIsoDateTime(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function isFinanceManager(auth: AuthContext): boolean {
  return (
    auth.isSuperAdmin ||
    auth.permissions.includes('payments.manage') ||
    auth.permissions.includes('payments.disburse')
  );
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeTargetDisbursementAmount(row: {
  paymentType: PaymentType;
  payableAmount: number;
  netSettlementAmount: number;
}): number {
  if (row.paymentType === 'ADVANCE_SETTLEMENT' && row.netSettlementAmount < 0) {
    return Math.abs(row.netSettlementAmount);
  }
  return row.payableAmount;
}

async function resolveRequesterEmployeeContext(userId: number): Promise<{
  employeeId: number | null;
  branchId: number | null;
  departmentId: number | null;
  directManagerUserId: number | null;
  fullName: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
}> {
  const db = getDb();
  const emp = await db
    .selectFrom('employees as e')
    .leftJoin('employees as mgr', 'mgr.id', 'e.manager_id')
    .select([
      'e.id',
      'e.branch_id',
      'e.department_id',
      'e.full_name',
      'e.bank_name',
      'e.bank_account_no',
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
      fullName: null,
      bankName: null,
      bankAccountNo: null,
    };
  }

  return {
    employeeId: Number(emp.id),
    branchId: Number(emp.branch_id),
    departmentId: Number(emp.department_id),
    directManagerUserId: emp.manager_user_id ? Number(emp.manager_user_id) : null,
    fullName: emp.full_name,
    bankName: emp.bank_name,
    bankAccountNo: emp.bank_account_no,
  };
}

async function generateNextPaymentCode(trx: Transaction<DatabaseSchema>): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = `PAY-${String(year).padStart(4, '0')}${String(month).padStart(2, '0')}-`;

  const lastRow = await trx
    .selectFrom('payment_requests')
    .select(['code'])
    .where('code', 'like', `${prefix}%`)
    .orderBy('code', 'desc')
    .limit(1)
    .executeTakeFirst();

  let nextSeq = 1;
  if (lastRow?.code) {
    const suffix = Number(lastRow.code.slice(prefix.length));
    if (Number.isFinite(suffix) && suffix >= 1) {
      nextSeq = suffix + 1;
    }
  }
  return formatPaymentCode(year, month, nextSeq);
}

/**
 * Checks for duplicate VAT invoice numbers across active (non-rejected, non-cancelled) payment requests.
 */
export async function assertNoDuplicateInvoiceNumbers(
  trx: Transaction<DatabaseSchema>,
  items: readonly PaymentLineItemSchemaInput[],
  beneficiaryTaxCode: string | null | undefined,
  excludePaymentId?: number,
): Promise<void> {
  const normalizedInvoices = Array.from(
    new Set(
      items
        .map((it) => it.invoiceNo?.trim().toUpperCase() ?? '')
        .filter((inv) => inv.length >= 3),
    ),
  );

  if (normalizedInvoices.length === 0) {
    return;
  }

  let query = trx
    .selectFrom('payment_request_items as pi')
    .innerJoin('payment_requests as pr', 'pr.id', 'pi.payment_request_id')
    .select(['pr.id', 'pr.code', 'pr.beneficiary_tax_code', 'pi.invoice_no'])
    .where('pr.deleted_at', 'is', null)
    .where('pr.status', 'not in', ['REJECTED', 'CANCELLED'])
    .where(sql<boolean>`UPPER(TRIM(pi.invoice_no)) IN (${sql.join(normalizedInvoices)})`);

  if (excludePaymentId) {
    query = query.where('pr.id', '!=', excludePaymentId);
  }

  const existing = await query.execute();
  if (existing.length === 0) {
    return;
  }

  const cleanTax = beneficiaryTaxCode?.trim().toUpperCase() || null;
  for (const hit of existing) {
    const hitTax = hit.beneficiary_tax_code?.trim().toUpperCase() || null;
    if (!cleanTax || !hitTax || cleanTax === hitTax) {
      throw new AppError(
        'DUPLICATE_INVOICE_NUMBER',
        `Số hóa đơn "${hit.invoice_no}" đã tồn tại trên phiếu thanh toán ${hit.code}. Vui lòng kiểm tra để tránh thanh toán trùng chứng từ.`,
        409,
      );
    }
  }
}

export async function assertPaymentViewAccess(
  auth: AuthContext,
  paymentId: number,
): Promise<PaymentAccessRow> {
  const db = getDb();
  const row = await db
    .selectFrom('payment_requests')
    .select([
      'id',
      'code',
      'payment_type',
      'status',
      'requester_user_id',
      'branch_id',
      'department_id',
      'approval_request_id',
    ])
    .where('id', '=', paymentId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('PAYMENT_NOT_FOUND', 'Không tìm thấy đề nghị thanh toán.', 404);
  }

  const accessRow: PaymentAccessRow = {
    id: Number(row.id),
    code: row.code,
    paymentType: row.payment_type,
    status: row.status,
    requesterUserId: Number(row.requester_user_id),
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    approvalRequestId: row.approval_request_id !== null ? Number(row.approval_request_id) : null,
  };

  if (
    isFinanceManager(auth) ||
    auth.dataScope === 'ALL' ||
    accessRow.requesterUserId === auth.userId
  ) {
    return accessRow;
  }

  if (accessRow.approvalRequestId) {
    const ar = await db
      .selectFrom('approval_requests')
      .select(['id', 'requester_id', 'branch_id', 'current_approver_user_id', 'current_approver_role_id'])
      .where('id', '=', accessRow.approvalRequestId)
      .executeTakeFirst();
    if (
      ar &&
      (await canAuthActOnApproval(
        {
          requesterId: Number(ar.requester_id),
          branchId: ar.branch_id !== null ? Number(ar.branch_id) : accessRow.branchId,
          requesterDepartmentId: accessRow.departmentId,
          currentApproverUserId:
            ar.current_approver_user_id !== null ? Number(ar.current_approver_user_id) : null,
          currentApproverRoleId:
            ar.current_approver_role_id !== null ? Number(ar.current_approver_role_id) : null,
        },
        auth,
        'APPROVE',
      ))
    ) {
      return accessRow;
    }

    const participated = await db
      .selectFrom('approval_histories')
      .select(['id'])
      .where('approval_request_id', '=', accessRow.approvalRequestId)
      .where('actor_id', '=', auth.userId)
      .limit(1)
      .executeTakeFirst();
    if (participated) {
      return accessRow;
    }
  }

  if (auth.dataScope === 'BRANCH' && accessRow.branchId !== null) {
    if (auth.hasAllBranches || auth.branchIds.includes(accessRow.branchId)) {
      return accessRow;
    }
  }

  if (auth.dataScope === 'DEPARTMENT' && accessRow.departmentId !== null) {
    const empCtx = await resolveRequesterEmployeeContext(auth.userId);
    if (empCtx.departmentId === accessRow.departmentId) {
      return accessRow;
    }
  }

  throw new AppError('FORBIDDEN', 'Bạn không có quyền xem phiếu thanh toán này.', 403);
}

export async function listPaymentCategories(includeInactive = false): Promise<PaymentCategoryView[]> {
  const db = getDb();
  let query = db
    .selectFrom('payment_categories')
    .select([
      'id',
      'code',
      'name',
      'name_en',
      'description',
      'default_payment_type',
      'requires_receipt',
      'color',
      'sort_order',
      'is_active',
    ])
    .where('deleted_at', 'is', null);

  if (!includeInactive) {
    query = query.where('is_active', '=', 1);
  }

  const rows = await query.orderBy('sort_order', 'asc').orderBy('id', 'asc').execute();
  return rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    name: r.name,
    nameEn: r.name_en ?? null,
    description: r.description,
    defaultPaymentType: r.default_payment_type,
    requiresReceipt: Number(r.requires_receipt) === 1,
    color: r.color,
    sortOrder: Number(r.sort_order),
    isActive: Number(r.is_active) === 1,
  }));
}

export async function createPaymentCategory(
  auth: AuthContext,
  input: CreatePaymentCategoryInput,
  ipAddress?: string | null,
): Promise<PaymentCategoryView> {
  const db = getDb();
  const dup = await db
    .selectFrom('payment_categories')
    .select(['id'])
    .where('code', '=', input.code)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  if (dup) {
    throw new AppError('CATEGORY_CODE_EXISTS', `Mã danh mục "${input.code}" đã tồn tại.`, 409);
  }

  const inserted = await db
    .insertInto('payment_categories')
    .values({
      code: input.code,
      name: input.name,
      name_en: input.nameEn?.trim() || null,
      description: input.description?.trim() || null,
      default_payment_type: input.defaultPaymentType,
      requires_receipt: input.requiresReceipt ? 1 : 0,
      color: input.color,
      sort_order: input.sortOrder,
      is_active: input.isActive ? 1 : 0,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const createdId = Number(inserted.insertId);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'CATEGORY_CREATED',
    entityType: 'payment_categories',
    entityId: createdId,
    newValues: { code: input.code, name: input.name },
    ipAddress,
  });

  const categories = await listPaymentCategories(true);
  const found = categories.find((c) => c.id === createdId);
  if (!found) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không thể đọc danh mục vừa tạo.', 500);
  }
  return found;
}

export async function updatePaymentCategory(
  auth: AuthContext,
  categoryId: number,
  input: UpdatePaymentCategoryInput,
  ipAddress?: string | null,
): Promise<PaymentCategoryView> {
  const db = getDb();
  const existing = await db
    .selectFrom('payment_categories')
    .select(['id', 'code', 'name'])
    .where('id', '=', categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  if (!existing) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục khoản chi.', 404);
  }

  if (input.code && input.code !== existing.code) {
    const dup = await db
      .selectFrom('payment_categories')
      .select(['id'])
      .where('code', '=', input.code)
      .where('id', '!=', categoryId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (dup) {
      throw new AppError('CATEGORY_CODE_EXISTS', `Mã danh mục "${input.code}" đã tồn tại.`, 409);
    }
  }

  await db
    .updateTable('payment_categories')
    .set({
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nameEn !== undefined ? { name_en: input.nameEn?.trim() || null } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.defaultPaymentType !== undefined
        ? { default_payment_type: input.defaultPaymentType }
        : {}),
      ...(input.requiresReceipt !== undefined
        ? { requires_receipt: input.requiresReceipt ? 1 : 0 }
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
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'CATEGORY_UPDATED',
    entityType: 'payment_categories',
    entityId: categoryId,
    newValues: input as Record<string, unknown>,
    ipAddress,
  });

  const categories = await listPaymentCategories(true);
  const found = categories.find((c) => c.id === categoryId);
  if (!found) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục sau cập nhật.', 404);
  }
  return found;
}

export async function deletePaymentCategory(
  auth: AuthContext,
  categoryId: number,
  ipAddress?: string | null,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .selectFrom('payment_categories')
    .select(['id', 'code'])
    .where('id', '=', categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  if (!existing) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục khoản chi.', 404);
  }

  const activeUsage = await db
    .selectFrom('payment_requests')
    .select((eb) => eb.fn.countAll<number>().as('total'))
    .where('category_id', '=', categoryId)
    .where('deleted_at', 'is', null)
    .where('status', 'in', ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID'])
    .executeTakeFirst();

  if (Number(activeUsage?.total ?? 0) > 0) {
    throw new AppError(
      'CATEGORY_IN_USE',
      'Không thể xóa danh mục đang có đề nghị thanh toán chờ duyệt hoặc chờ giải ngân.',
      409,
    );
  }

  await db
    .updateTable('payment_categories')
    .set({ deleted_at: new Date(), is_active: 0, updated_by: auth.userId })
    .where('id', '=', categoryId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'CATEGORY_DELETED',
    entityType: 'payment_categories',
    entityId: categoryId,
    oldValues: { code: existing.code },
    ipAddress,
  });
}

function buildScopedPaymentsBaseQuery(
  auth: AuthContext,
  empDepartmentId: number | null,
  actionableApprovalIds: number[],
) {
  const db = getDb();

  let query = db
    .selectFrom('payment_requests as p')
    .innerJoin('payment_categories as c', 'c.id', 'p.category_id')
    .innerJoin('users as req', 'req.id', 'p.requester_user_id')
    .leftJoin('branches as b', 'b.id', 'p.branch_id')
    .leftJoin('departments as d', 'd.id', 'p.department_id')
    .leftJoin('payment_budgets as bud', 'bud.id', 'p.budget_id')
    .leftJoin('proposals as prop', 'prop.id', 'p.proposal_id')
    .leftJoin('projects as proj', 'proj.id', 'p.project_id')
    .leftJoin('approval_requests as ar', 'ar.id', 'p.approval_request_id')
    .where('p.deleted_at', 'is', null);

  if (!isFinanceManager(auth) && auth.dataScope !== 'ALL') {
    query = query.where((eb) => {
      const clauses = [eb('p.requester_user_id', '=', auth.userId)];
      if (actionableApprovalIds.length > 0) {
        clauses.push(eb('ar.id', 'in', actionableApprovalIds));
      }

      if (auth.dataScope === 'BRANCH') {
        if (auth.hasAllBranches) {
          clauses.push(eb('p.id', '>', 0));
        } else if (auth.branchIds.length > 0) {
          clauses.push(eb('p.branch_id', 'in', auth.branchIds));
        }
      } else if (auth.dataScope === 'DEPARTMENT' && empDepartmentId !== null) {
        clauses.push(eb('p.department_id', '=', empDepartmentId));
      }

      return eb.or(clauses);
    });
  }

  return query;
}

export async function listPayments(
  auth: AuthContext,
  rawQuery: ListPaymentsQuery,
): Promise<{ items: PaymentListItemView[]; meta: PaginationMeta }> {
  const pagination = parsePaginationParams(
    {
      page: rawQuery.page,
      limit: rawQuery.limit,
    },
    {
      defaultLimit: 20,
      maxLimit: 5000,
    },
  );
  const empCtx =
    auth.dataScope === 'DEPARTMENT' && !isFinanceManager(auth)
      ? await resolveRequesterEmployeeContext(auth.userId)
      : null;

  const actionableApprovalIds = !auth.isSuperAdmin
    ? (await listActionablePendingApprovals(auth, PAYMENT_MODULE_CODE, PAYMENT_ENTITY_TYPE)).map(
        (x) => x.id,
      )
    : [];
  const today = getTodayDateString();
  let query = buildScopedPaymentsBaseQuery(auth, empCtx?.departmentId ?? null, actionableApprovalIds);

  if (rawQuery.scope === 'mine') {
    query = query.where('p.requester_user_id', '=', auth.userId);
  } else if (rawQuery.scope === 'pending_my_approval') {
    query = query.where('p.status', '=', 'PENDING_APPROVAL').where('ar.status', '=', 'PENDING');
    if (!auth.isSuperAdmin) {
      if (actionableApprovalIds.length === 0) {
        return {
          items: [],
          meta: buildPaginationMeta(0, pagination.page, pagination.limit),
        };
      }
      query = query.where('ar.id', 'in', actionableApprovalIds);
    }
  } else if (rawQuery.scope === 'ready_to_disburse') {
    query = query.where('p.status', 'in', ['APPROVED', 'PARTIALLY_PAID']);
  } else if (rawQuery.scope === 'unsettled_advances') {
    query = query
      .where('p.payment_type', '=', 'CASH_ADVANCE')
      .where('p.status', '=', 'PAID')
      .where('p.is_settled', '=', 0);
  } else if (rawQuery.scope === 'overdue') {
    query = query
      .where('p.status', 'in', ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID'])
      .where('p.due_date', 'is not', null)
      .where('p.due_date', '<', today);
  }

  if (rawQuery.paymentType) {
    query = query.where('p.payment_type', '=', rawQuery.paymentType as PaymentType);
  }
  if (rawQuery.status) {
    query = query.where('p.status', '=', rawQuery.status as PaymentStatus);
  }
  if (rawQuery.priority) {
    query = query.where('p.priority', '=', rawQuery.priority as PaymentPriority);
  }
  if (rawQuery.categoryId) {
    query = query.where('p.category_id', '=', rawQuery.categoryId);
  }
  if (rawQuery.branchId) {
    query = query.where('p.branch_id', '=', rawQuery.branchId);
  }
  if (rawQuery.budgetId) {
    query = query.where('p.budget_id', '=', rawQuery.budgetId);
  }
  if (rawQuery.fromDate) {
    query = query.where('p.created_at', '>=', new Date(`${rawQuery.fromDate}T00:00:00.000Z`));
  }
  if (rawQuery.toDate) {
    query = query.where('p.created_at', '<=', new Date(`${rawQuery.toDate}T23:59:59.999Z`));
  }

  const keyword = rawQuery.search?.trim();
  if (keyword) {
    const like = `%${keyword}%`;
    query = query.where((eb) =>
      eb.or([
        eb('p.code', 'like', like),
        eb('p.title', 'like', like),
        eb('p.beneficiary_name', 'like', like),
        eb('req.full_name', 'like', like),
        eb.exists(
          eb
            .selectFrom('payment_request_items as pi')
            .select(['pi.id'])
            .whereRef('pi.payment_request_id', '=', 'p.id')
            .where('pi.invoice_no', 'like', like),
        ),
      ]),
    );
  }

  const countRow = await query
    .select((eb) => eb.fn.count<number>('p.id').distinct().as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await query
    .select([
      'p.id',
      'p.code',
      'p.payment_type',
      'p.category_id',
      'c.name as category_name',
      'c.name_en as category_name_en',
      'c.color as category_color',
      'p.title',
      'p.priority',
      'p.status',
      'p.requester_user_id',
      'req.full_name as requester_name',
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
      'p.budget_spent_amount',
      'p.proposal_reserve_used',
      'p.is_over_budget',
      'p.proposal_id',
      'prop.proposal_code as proposal_code',
      'p.project_id',
      'proj.code as project_code',
      'p.linked_advance_id',
      'p.is_settled',
      'p.payment_method',
      'p.beneficiary_type',
      'p.beneficiary_name',
      'p.currency',
      'p.subtotal_amount',
      'p.tax_amount',
      'p.total_amount',
      'p.advance_amount',
      'p.net_settlement_amount',
      'p.payable_amount',
      'p.approved_amount',
      'p.disbursed_amount',
      'p.due_date',
      'p.advance_due_date',
      'p.submitted_at',
      'p.approved_at',
      'p.paid_at',
      'p.created_at',
    ])
    .orderBy('p.created_at', 'desc')
    .orderBy('p.id', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: PaymentListItemView[] = rows.map((r) => {
    const totalAmount = Number(r.total_amount ?? 0);
    const advanceAmount = Number(r.advance_amount ?? 0);
    const netSettlementAmount = Number(r.net_settlement_amount ?? 0);
    const payableAmount = Number(r.payable_amount ?? 0);
    const disbursedAmount = Number(r.disbursed_amount ?? 0);
    const targetAmount = computeTargetDisbursementAmount({
      paymentType: r.payment_type,
      payableAmount,
      netSettlementAmount,
    });
    const progress = evaluateDisbursementProgress(targetAmount, disbursedAmount);
    const dueDate = toIsoDate(r.due_date);
    const isOverdue =
      Boolean(dueDate) &&
      dueDate! < today &&
      ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID'].includes(r.status);

    let settlementDirection: SettlementDirection | null = null;
    if (r.payment_type === 'ADVANCE_SETTLEMENT') {
      settlementDirection = computeAdvanceSettlement(totalAmount, advanceAmount).settlementDirection;
    }

    return {
      id: Number(r.id),
      code: r.code,
      paymentType: r.payment_type,
      categoryId: Number(r.category_id),
      categoryName: r.category_name,
      categoryNameEn: r.category_name_en ?? null,
      categoryColor: r.category_color,
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
      budgetId: r.budget_id !== null ? Number(r.budget_id) : null,
      budgetCode: r.budget_code ?? null,
      budgetName: r.budget_name ?? null,
      budgetNameEn: r.budget_name_en ?? null,
      budgetReservedAmount: Number(r.budget_reserved_amount ?? 0),
      budgetSpentAmount: Number(r.budget_spent_amount ?? 0),
      proposalReserveUsed: Number(r.proposal_reserve_used ?? 0),
      isOverBudget: Number(r.is_over_budget ?? 0) === 1,
      proposalId: r.proposal_id !== null ? Number(r.proposal_id) : null,
      proposalCode: r.proposal_code ?? null,
      projectId: r.project_id !== null ? Number(r.project_id) : null,
      projectCode: r.project_code ?? null,
      linkedAdvanceId: r.linked_advance_id !== null ? Number(r.linked_advance_id) : null,
      isSettled: Number(r.is_settled) === 1,
      paymentMethod: r.payment_method,
      beneficiaryType: r.beneficiary_type,
      beneficiaryName: r.beneficiary_name,
      currency: r.currency,
      subtotalAmount: Number(r.subtotal_amount ?? 0),
      taxAmount: Number(r.tax_amount ?? 0),
      totalAmount,
      advanceAmount,
      netSettlementAmount,
      payableAmount,
      approvedAmount: r.approved_amount !== null ? Number(r.approved_amount) : null,
      disbursedAmount,
      remainingAmount: progress.remainingAmount,
      disbursementProgressPercent: progress.progressPercent,
      settlementDirection,
      dueDate,
      advanceDueDate: toIsoDate(r.advance_due_date),
      isOverdue,
      submittedAt: toIsoDateTime(r.submitted_at),
      approvedAt: toIsoDateTime(r.approved_at),
      paidAt: toIsoDateTime(r.paid_at),
      createdAt: toIsoDateTime(r.created_at) ?? new Date().toISOString(),
    };
  });

  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function getPaymentsSummary(
  auth: AuthContext,
  branchId?: number,
): Promise<PaymentSummaryView> {
  const empCtx =
    auth.dataScope === 'DEPARTMENT' && !isFinanceManager(auth)
      ? await resolveRequesterEmployeeContext(auth.userId)
      : null;

  const actionableApprovalIds = !auth.isSuperAdmin
    ? (await listActionablePendingApprovals(auth, PAYMENT_MODULE_CODE, PAYMENT_ENTITY_TYPE)).map(
        (x) => x.id,
      )
    : [];
  const actionableIdSet = new Set(actionableApprovalIds);

  let query = buildScopedPaymentsBaseQuery(auth, empCtx?.departmentId ?? null, actionableApprovalIds);
  if (branchId) {
    query = query.where('p.branch_id', '=', branchId);
  }

  const rows = await query
    .select([
      'p.id',
      'p.payment_type',
      'p.status',
      'p.is_settled',
      'p.total_amount',
      'p.payable_amount',
      'p.net_settlement_amount',
      'p.disbursed_amount',
      'p.due_date',
      'p.advance_due_date',
      'p.paid_at',
      'ar.id as ar_id',
      'ar.status as ar_status',
      'ar.current_approver_user_id',
      'ar.current_approver_role_id',
    ])
    .execute();

  const today = getTodayDateString();
  const currentMonthPrefix = today.slice(0, 7);

  const summary: PaymentSummaryView = {
    totalCount: 0,
    totalAmount: 0,
    pendingMyApprovalCount: 0,
    pendingMyApprovalAmount: 0,
    readyToDisburseCount: 0,
    readyToDisburseAmount: 0,
    paidThisMonthCount: 0,
    paidThisMonthAmount: 0,
    unsettledAdvancesCount: 0,
    unsettledAdvancesAmount: 0,
    overdueAdvancesCount: 0,
    overdueDueDateCount: 0,
    draftCount: 0,
    needsRevisionCount: 0,
  };

  for (const r of rows) {
    const totalAmount = Number(r.total_amount ?? 0);
    const payableAmount = Number(r.payable_amount ?? 0);
    const netSettlement = Number(r.net_settlement_amount ?? 0);
    const disbursedAmount = Number(r.disbursed_amount ?? 0);
    const targetAmount = computeTargetDisbursementAmount({
      paymentType: r.payment_type,
      payableAmount,
      netSettlementAmount: netSettlement,
    });
    const remaining = Math.max(0, targetAmount - disbursedAmount);

    summary.totalCount += 1;
    summary.totalAmount += totalAmount;

    if (r.status === 'DRAFT') {
      summary.draftCount += 1;
    } else if (r.status === 'NEEDS_REVISION') {
      summary.needsRevisionCount += 1;
    }

    if (r.status === 'PENDING_APPROVAL' && r.ar_status === 'PENDING') {
      const canAct =
        auth.isSuperAdmin || (r.ar_id !== null && actionableIdSet.has(Number(r.ar_id)));
      if (canAct) {
        summary.pendingMyApprovalCount += 1;
        summary.pendingMyApprovalAmount += totalAmount;
      }
    }

    if (r.status === 'APPROVED' || r.status === 'PARTIALLY_PAID') {
      summary.readyToDisburseCount += 1;
      summary.readyToDisburseAmount += remaining;
    }

    const paidDate = toIsoDate(r.paid_at);
    if (r.status === 'PAID' && paidDate?.startsWith(currentMonthPrefix)) {
      summary.paidThisMonthCount += 1;
      summary.paidThisMonthAmount += disbursedAmount > 0 ? disbursedAmount : totalAmount;
    }

    if (r.payment_type === 'CASH_ADVANCE' && r.status === 'PAID' && Number(r.is_settled) === 0) {
      summary.unsettledAdvancesCount += 1;
      summary.unsettledAdvancesAmount += disbursedAmount;
      const advDue = toIsoDate(r.advance_due_date);
      if (advDue && advDue < today) {
        summary.overdueAdvancesCount += 1;
      }
    }

    const due = toIsoDate(r.due_date);
    if (
      due &&
      due < today &&
      ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID'].includes(r.status)
    ) {
      summary.overdueDueDateCount += 1;
    }
  }

  return summary;
}

export async function getPaymentFormOptions(auth: AuthContext): Promise<PaymentFormOptionsView> {
  const db = getDb();
  const canViewAllProposals =
    isFinanceManager(auth) ||
    auth.isSuperAdmin ||
    auth.dataScope === 'ALL' ||
    auth.permissions.includes('proposals.manage');
  const empScope = canViewAllProposals ? null : await resolveEmployeeAccessScope(auth);

  let proposalsQuery = db
    .selectFrom('proposals as prop')
    .leftJoin('payment_budgets as pb', 'pb.id', 'prop.budget_id')
    .select([
      'prop.id',
      'prop.proposal_code',
      'prop.title',
      'prop.approved_budget',
      'prop.estimated_budget',
      'prop.budget_id',
      'pb.code as budget_code',
      'pb.name as budget_name',
      'pb.name_en as budget_name_en',
      'prop.budget_reserved_amount',
      'prop.vendor_name',
    ])
    .where('prop.deleted_at', 'is', null)
    .where('prop.status', 'in', ['APPROVED', 'IN_EXECUTION']);

  if (!canViewAllProposals && empScope) {
    proposalsQuery = proposalsQuery.where((eb) => {
      const conds = [eb('prop.requester_user_id', '=', auth.userId)];
      if (empScope.mode === 'BRANCH' && empScope.branchIds.length > 0) {
        conds.push(eb('prop.branch_id', 'in', empScope.branchIds));
      } else if (empScope.mode === 'DEPARTMENT' && empScope.departmentIds.length > 0) {
        conds.push(eb('prop.department_id', 'in', empScope.departmentIds));
      }
      return eb.or(conds);
    });
  }

  const canReadProjects =
    auth.isSuperAdmin ||
    auth.permissions.includes('pm.projects.read') ||
    auth.permissions.includes('pm.projects.manage');

  const [empCtx, openAdvancesRows, proposalRows, scopedProjectsRes, activeBudgets] =
    await Promise.all([
      resolveRequesterEmployeeContext(auth.userId),
      db
        .selectFrom('payment_requests as pr')
        .leftJoin('payment_budgets as pb', 'pb.id', 'pr.budget_id')
        .select([
          'pr.id',
          'pr.code',
          'pr.title',
          'pr.disbursed_amount',
          'pr.advance_due_date',
          'pr.budget_id',
          'pb.code as budget_code',
          'pb.name as budget_name',
          'pb.name_en as budget_name_en',
        ])
        .where('pr.deleted_at', 'is', null)
        .where('pr.payment_type', '=', 'CASH_ADVANCE')
        .where('pr.status', '=', 'PAID')
        .where('pr.is_settled', '=', 0)
        .$if(!isFinanceManager(auth), (qb) => qb.where('pr.requester_user_id', '=', auth.userId))
        .orderBy('pr.paid_at', 'desc')
        .limit(50)
        .execute(),
      proposalsQuery.orderBy('prop.id', 'desc').limit(50).execute(),
      canReadProjects ? listProjects(auth, { limit: '50' }) : Promise.resolve({ items: [] }),
      listActiveBudgetOptions(auth),
    ]);

  const projectRows = scopedProjectsRes.items.filter(
    (pr) => pr.status === 'PLANNING' || pr.status === 'ACTIVE',
  );

  return {
    myBankProfile: {
      fullName: empCtx.fullName ?? auth.fullName,
      bankName: empCtx.bankName,
      bankAccountNo: empCtx.bankAccountNo,
      branchId: empCtx.branchId ?? auth.branchIds[0] ?? null,
      departmentId: empCtx.departmentId,
    },
    openAdvances: openAdvancesRows.map((a) => ({
      id: Number(a.id),
      code: a.code,
      title: a.title,
      disbursedAmount: Number(a.disbursed_amount ?? 0),
      advanceDueDate: toIsoDate(a.advance_due_date),
      budgetId: a.budget_id !== null ? Number(a.budget_id) : null,
      budgetCode: a.budget_code ?? null,
      budgetName: a.budget_name ?? null,
      budgetNameEn: a.budget_name_en ?? null,
    })),
    approvedProposals: proposalRows.map((p) => ({
      id: Number(p.id),
      code: p.proposal_code,
      title: p.title,
      approvedBudget: Number(p.approved_budget ?? p.estimated_budget ?? 0),
      budgetId: p.budget_id !== null ? Number(p.budget_id) : null,
      budgetCode: p.budget_code ?? null,
      budgetName: p.budget_name ?? null,
      budgetNameEn: p.budget_name_en ?? null,
      budgetReservedAmount: Number(p.budget_reserved_amount ?? 0),
      vendorName: p.vendor_name ?? null,
    })),
    activeProjects: projectRows.map((pr) => ({
      id: pr.id,
      code: pr.code,
      name: pr.name,
    })),
    activeBudgets,
  };
}

async function resolvePaymentBudgetId(
  trx: Transaction<DatabaseSchema>,
  params: {
    paymentType: PaymentType;
    requestedBudgetId: number | null | undefined;
    proposalId: number | null | undefined;
    linkedAdvanceId: number | null | undefined;
    existingBudgetId?: number | null;
  },
): Promise<number | null> {
  if (params.paymentType === 'ADVANCE_SETTLEMENT' && params.linkedAdvanceId) {
    const adv = await trx
      .selectFrom('payment_requests')
      .select(['budget_id', 'code'])
      .where('id', '=', params.linkedAdvanceId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    const advBudgetId = adv?.budget_id !== null && adv?.budget_id !== undefined ? Number(adv.budget_id) : null;
    if (advBudgetId) {
      if (params.requestedBudgetId && params.requestedBudgetId !== advBudgetId) {
        throw new AppError(
          'BUDGET_MISMATCH_WITH_ADVANCE',
          `Phiếu Quyết toán phải dùng chung quỹ ngân sách của phiếu Tạm ứng gốc ${adv?.code ?? ''}.`,
          409,
        );
      }
      return advBudgetId;
    }
  }

  if (params.proposalId) {
    const prop = await trx
      .selectFrom('proposals')
      .select(['budget_id', 'proposal_code'])
      .where('id', '=', params.proposalId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    const propBudgetId =
      prop?.budget_id !== null && prop?.budget_id !== undefined ? Number(prop.budget_id) : null;
    if (propBudgetId) {
      if (params.requestedBudgetId && params.requestedBudgetId !== propBudgetId) {
        throw new AppError(
          'BUDGET_MISMATCH_WITH_PROPOSAL',
          `Phiếu thanh toán liên kết Đề xuất ${prop?.proposal_code ?? ''} phải dùng chung quỹ ngân sách của Đề xuất đó để không bị trừ trùng.`,
          409,
        );
      }
      return propBudgetId;
    }
  }

  const candidateId =
    params.requestedBudgetId !== undefined ? params.requestedBudgetId : (params.existingBudgetId ?? null);
  if (!candidateId) {
    return null;
  }

  const budget = await trx
    .selectFrom('payment_budgets')
    .select(['id', 'status'])
    .where('id', '=', candidateId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!budget) {
    throw new AppError('INVALID_BUDGET', 'Quỹ ngân sách được chọn không tồn tại.', 400);
  }
  if (budget.status !== 'ACTIVE' && candidateId !== params.existingBudgetId) {
    throw new AppError(
      'BUDGET_NOT_ACTIVE',
      'Chỉ có thể chọn quỹ ngân sách đang hiệu lực (ACTIVE).',
      409,
    );
  }
  return Number(budget.id);
}

async function resolveLinkedAdvanceAmount(
  trx: Transaction<DatabaseSchema>,
  auth: AuthContext,
  paymentType: PaymentType,
  linkedAdvanceId: number | null | undefined,
): Promise<number> {
  if (paymentType !== 'ADVANCE_SETTLEMENT') {
    return 0;
  }
  if (!linkedAdvanceId) {
    throw new AppError(
      'LINKED_ADVANCE_REQUIRED',
      'Quyết toán tạm ứng bắt buộc chọn phiếu Tạm ứng gốc.',
      400,
    );
  }
  const advance = await trx
    .selectFrom('payment_requests')
    .select(['id', 'code', 'payment_type', 'status', 'is_settled', 'requester_user_id', 'disbursed_amount'])
    .where('id', '=', linkedAdvanceId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!advance || advance.payment_type !== 'CASH_ADVANCE') {
    throw new AppError('INVALID_LINKED_ADVANCE', 'Phiếu tạm ứng liên kết không hợp lệ.', 400);
  }
  if (advance.status !== 'PAID') {
    throw new AppError(
      'ADVANCE_NOT_DISBURSED',
      `Phiếu tạm ứng ${advance.code} chưa được giải ngân nên chưa thể quyết toán.`,
      409,
    );
  }
  if (Number(advance.is_settled) === 1) {
    throw new AppError(
      'ADVANCE_ALREADY_SETTLED',
      `Phiếu tạm ứng ${advance.code} đã được quyết toán trước đó.`,
      409,
    );
  }
  if (!isFinanceManager(auth) && Number(advance.requester_user_id) !== auth.userId) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn chỉ có thể quyết toán phiếu tạm ứng của chính mình.',
      403,
    );
  }

  return Number(advance.disbursed_amount ?? 0);
}

export async function createPaymentRequest(
  auth: AuthContext,
  input: CreatePaymentInput,
  ipAddress?: string | null,
): Promise<PaymentDetailView> {
  const db = getDb();
  const empCtx = await resolveRequesterEmployeeContext(auth.userId);
  const category = await db
    .selectFrom('payment_categories')
    .select(['id', 'name', 'requires_receipt', 'is_active'])
    .where('id', '=', input.categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!category || Number(category.is_active) !== 1) {
    throw new AppError('INVALID_CATEGORY', 'Danh mục khoản chi không tồn tại hoặc đã ngừng hoạt động.', 400);
  }

  const branchId = input.branchId ?? empCtx.branchId ?? auth.branchIds[0] ?? null;
  const departmentId = input.departmentId ?? empCtx.departmentId ?? null;
  const calc = calculatePaymentLineItems(input.items);

  if (calc.totalAmount <= 0) {
    throw new AppError('INVALID_TOTAL_AMOUNT', 'Tổng số tiền thanh toán phải lớn hơn 0.', 400);
  }

  const createdPaymentId = await db.transaction().execute(async (trx) => {
    await assertNoDuplicateInvoiceNumbers(trx, input.items, input.beneficiaryTaxCode);

    const advanceAmount = await resolveLinkedAdvanceAmount(
      trx,
      auth,
      input.paymentType,
      input.linkedAdvanceId,
    );

    const resolvedBudgetId = await resolvePaymentBudgetId(trx, {
      paymentType: input.paymentType,
      requestedBudgetId: input.budgetId,
      proposalId: input.proposalId,
      linkedAdvanceId: input.linkedAdvanceId,
    });

    const settlement =
      input.paymentType === 'ADVANCE_SETTLEMENT'
        ? computeAdvanceSettlement(calc.totalAmount, advanceAmount)
        : null;

    const payableAmount = settlement ? settlement.payableAmount : calc.totalAmount;
    const netSettlementAmount = settlement ? settlement.netSettlementAmount : 0;
    const code = await generateNextPaymentCode(trx);

    const inserted = await trx
      .insertInto('payment_requests')
      .values({
        code,
        payment_type: input.paymentType,
        category_id: input.categoryId,
        title: input.title,
        description: input.description,
        priority: input.priority ?? 'MEDIUM',
        status: 'DRAFT',
        requester_user_id: auth.userId,
        requester_employee_id: empCtx.employeeId,
        branch_id: branchId,
        department_id: departmentId,
        budget_id: resolvedBudgetId,
        proposal_id: input.proposalId ?? null,
        project_id: input.projectId ?? null,
        linked_advance_id: input.paymentType === 'ADVANCE_SETTLEMENT' ? input.linkedAdvanceId ?? null : null,
        is_settled: 0,
        settled_by_payment_id: null,
        payment_method: input.paymentMethod,
        beneficiary_type: input.beneficiaryType,
        beneficiary_name: input.beneficiaryName,
        beneficiary_tax_code: input.beneficiaryTaxCode?.trim() || null,
        bank_name: input.bankName?.trim() || null,
        bank_account_no: input.bankAccountNo?.trim() || null,
        bank_branch: input.bankBranch?.trim() || null,
        currency: 'VND',
        subtotal_amount: calc.subtotalAmount,
        tax_amount: calc.taxAmount,
        total_amount: calc.totalAmount,
        advance_amount: advanceAmount,
        net_settlement_amount: netSettlementAmount,
        payable_amount: payableAmount,
        approved_amount: null,
        disbursed_amount: 0,
        budget_reserved_amount: 0,
        budget_spent_amount: 0,
        proposal_reserve_used: 0,
        is_over_budget: 0,
        due_date: input.dueDate ?? null,
        advance_due_date: input.paymentType === 'CASH_ADVANCE' ? input.advanceDueDate ?? null : null,
        approval_request_id: null,
        submitted_at: null,
        approved_at: null,
        paid_at: null,
        rejection_reason: null,
        revision_note: null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    const paymentId = Number(inserted.insertId);
    for (let i = 0; i < input.items.length; i += 1) {
      const raw = input.items[i];
      const computed = calc.items[i];
      await trx
        .insertInto('payment_request_items')
        .values({
          payment_request_id: paymentId,
          description: raw.description,
          invoice_no: raw.invoiceNo?.trim() || null,
          invoice_date: raw.invoiceDate ?? null,
          quantity: computed.quantity,
          unit_price: computed.unitPrice,
          tax_rate: computed.taxRate,
          subtotal_amount: computed.subtotalAmount,
          tax_amount: computed.taxAmount,
          line_total: computed.lineTotal,
          note: raw.note?.trim() || null,
          sort_order: i + 1,
        })
        .execute();
    }

    await trx
      .insertInto('payment_activities')
      .values({
        payment_request_id: paymentId,
        actor_user_id: auth.userId,
        action: 'CREATED',
        summary: `Tạo đề nghị thanh toán [${code}] — ${calc.totalAmount.toLocaleString('vi-VN')} ₫`,
        metadata_json: JSON.stringify({
          code,
          paymentType: input.paymentType,
          totalAmount: calc.totalAmount,
        }),
      })
      .execute();

    return paymentId;
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'PAYMENT_CREATED',
    entityType: 'payment_requests',
    entityId: createdPaymentId,
    newValues: { paymentType: input.paymentType, totalAmount: calc.totalAmount },
    ipAddress,
  });

  if (input.submitImmediately) {
    return submitPaymentRequest(auth, createdPaymentId, ipAddress);
  }

  return getPaymentDetail(auth, createdPaymentId);
}

export async function updatePaymentRequest(
  auth: AuthContext,
  paymentId: number,
  input: UpdatePaymentInput,
  ipAddress?: string | null,
): Promise<PaymentDetailView> {
  const access = await assertPaymentViewAccess(auth, paymentId);
  if (!isFinanceManager(auth) && access.requesterUserId !== auth.userId) {
    throw new AppError('FORBIDDEN', 'Chỉ người tạo phiếu hoặc Kế toán quản trị mới được chỉnh sửa.', 403);
  }
  if (!['DRAFT', 'NEEDS_REVISION'].includes(access.status)) {
    throw new AppError(
      'PAYMENT_NOT_EDITABLE',
      'Chỉ cho phép chỉnh sửa phiếu khi đang ở trạng thái Nháp hoặc Cần bổ sung chứng từ.',
      409,
    );
  }

  const db = getDb();
  await db.transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('payment_requests')
      .selectAll()
      .where('id', '=', paymentId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirstOrThrow();

    const nextPaymentType = input.paymentType ?? current.payment_type;
    const nextLinkedAdvanceId =
      input.linkedAdvanceId !== undefined
        ? input.linkedAdvanceId
        : current.linked_advance_id !== null
          ? Number(current.linked_advance_id)
          : null;
    const nextBeneficiaryTaxCode =
      input.beneficiaryTaxCode !== undefined
        ? input.beneficiaryTaxCode?.trim() || null
        : current.beneficiary_tax_code;

    let subtotalAmount = Number(current.subtotal_amount);
    let taxAmount = Number(current.tax_amount);
    let totalAmount = Number(current.total_amount);

    if (input.items && input.items.length > 0) {
      await assertNoDuplicateInvoiceNumbers(trx, input.items, nextBeneficiaryTaxCode, paymentId);
      const calc = calculatePaymentLineItems(input.items);
      if (calc.totalAmount <= 0) {
        throw new AppError('INVALID_TOTAL_AMOUNT', 'Tổng số tiền thanh toán phải lớn hơn 0.', 400);
      }
      subtotalAmount = calc.subtotalAmount;
      taxAmount = calc.taxAmount;
      totalAmount = calc.totalAmount;

      await trx
        .deleteFrom('payment_request_items')
        .where('payment_request_id', '=', paymentId)
        .execute();

      for (let i = 0; i < input.items.length; i += 1) {
        const raw = input.items[i];
        const computed = calc.items[i];
        await trx
          .insertInto('payment_request_items')
          .values({
            payment_request_id: paymentId,
            description: raw.description,
            invoice_no: raw.invoiceNo?.trim() || null,
            invoice_date: raw.invoiceDate ?? null,
            quantity: computed.quantity,
            unit_price: computed.unitPrice,
            tax_rate: computed.taxRate,
            subtotal_amount: computed.subtotalAmount,
            tax_amount: computed.taxAmount,
            line_total: computed.lineTotal,
            note: raw.note?.trim() || null,
            sort_order: i + 1,
          })
          .execute();
      }
    }

    const advanceAmount = await resolveLinkedAdvanceAmount(
      trx,
      auth,
      nextPaymentType,
      nextLinkedAdvanceId,
    );
    const nextProposalId =
      input.proposalId !== undefined
        ? input.proposalId
        : current.proposal_id !== null
          ? Number(current.proposal_id)
          : null;
    const resolvedBudgetId = await resolvePaymentBudgetId(trx, {
      paymentType: nextPaymentType,
      requestedBudgetId: input.budgetId,
      proposalId: nextProposalId,
      linkedAdvanceId: nextLinkedAdvanceId,
      existingBudgetId: current.budget_id !== null ? Number(current.budget_id) : null,
    });
    const settlement =
      nextPaymentType === 'ADVANCE_SETTLEMENT'
        ? computeAdvanceSettlement(totalAmount, advanceAmount)
        : null;

    await trx
      .updateTable('payment_requests')
      .set({
        payment_type: nextPaymentType,
        ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.branchId !== undefined ? { branch_id: input.branchId } : {}),
        ...(input.departmentId !== undefined ? { department_id: input.departmentId } : {}),
        budget_id: resolvedBudgetId,
        ...(input.proposalId !== undefined ? { proposal_id: input.proposalId } : {}),
        ...(input.projectId !== undefined ? { project_id: input.projectId } : {}),
        linked_advance_id: nextPaymentType === 'ADVANCE_SETTLEMENT' ? nextLinkedAdvanceId : null,
        ...(input.paymentMethod !== undefined ? { payment_method: input.paymentMethod } : {}),
        ...(input.beneficiaryType !== undefined ? { beneficiary_type: input.beneficiaryType } : {}),
        ...(input.beneficiaryName !== undefined ? { beneficiary_name: input.beneficiaryName } : {}),
        beneficiary_tax_code: nextBeneficiaryTaxCode,
        ...(input.bankName !== undefined ? { bank_name: input.bankName?.trim() || null } : {}),
        ...(input.bankAccountNo !== undefined
          ? { bank_account_no: input.bankAccountNo?.trim() || null }
          : {}),
        ...(input.bankBranch !== undefined ? { bank_branch: input.bankBranch?.trim() || null } : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        advance_due_date:
          nextPaymentType === 'CASH_ADVANCE'
            ? input.advanceDueDate !== undefined
              ? input.advanceDueDate
              : current.advance_due_date
            : null,
        subtotal_amount: subtotalAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        advance_amount: advanceAmount,
        net_settlement_amount: settlement ? settlement.netSettlementAmount : 0,
        payable_amount: settlement ? settlement.payableAmount : totalAmount,
        updated_by: auth.userId,
      })
      .where('id', '=', paymentId)
      .execute();

    await trx
      .insertInto('payment_activities')
      .values({
        payment_request_id: paymentId,
        actor_user_id: auth.userId,
        action: 'UPDATED',
        summary: `Cập nhật thông tin đề nghị thanh toán (Tổng: ${totalAmount.toLocaleString('vi-VN')} ₫)`,
        metadata_json: JSON.stringify({ totalAmount }),
      })
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'PAYMENT_UPDATED',
    entityType: 'payment_requests',
    entityId: paymentId,
    newValues: { title: input.title, paymentType: input.paymentType },
    ipAddress,
  });

  return getPaymentDetail(auth, paymentId);
}

export async function deletePaymentRequest(
  auth: AuthContext,
  paymentId: number,
  ipAddress?: string | null,
): Promise<void> {
  const access = await assertPaymentViewAccess(auth, paymentId);
  if (!isFinanceManager(auth) && access.requesterUserId !== auth.userId) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xóa phiếu thanh toán này.', 403);
  }
  if (!['DRAFT', 'CANCELLED'].includes(access.status)) {
    throw new AppError(
      'PAYMENT_DELETE_FORBIDDEN',
      'Chỉ có thể xóa mềm phiếu ở trạng thái Nháp hoặc Đã hủy.',
      409,
    );
  }

  const db = getDb();
  await db
    .updateTable('payment_requests')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', paymentId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'PAYMENT_DELETED',
    entityType: 'payment_requests',
    entityId: paymentId,
    oldValues: { code: access.code, status: access.status },
    ipAddress,
  });
}

export async function submitPaymentRequest(
  auth: AuthContext,
  paymentId: number,
  ipAddress?: string | null,
): Promise<PaymentDetailView> {
  const access = await assertPaymentViewAccess(auth, paymentId);
  if (!isFinanceManager(auth) && access.requesterUserId !== auth.userId) {
    throw new AppError('FORBIDDEN', 'Chỉ người lập phiếu hoặc Kế toán quản trị mới được gửi duyệt.', 403);
  }
  if (!['DRAFT', 'NEEDS_REVISION'].includes(access.status)) {
    throw new AppError(
      'INVALID_SUBMIT_STATUS',
      'Chỉ cho phép gửi phê duyệt từ trạng thái Nháp hoặc Cần bổ sung chứng từ.',
      409,
    );
  }

  const db = getDb();
  const empCtx = await resolveRequesterEmployeeContext(access.requesterUserId);

  let budgetAlert: BudgetAlertInfo | null = null;

  const approvalRequestId = await db.transaction().execute(async (trx) => {
    const payment = await trx
      .selectFrom('payment_requests as p')
      .innerJoin('payment_categories as c', 'c.id', 'p.category_id')
      .select([
        'p.id',
        'p.code',
        'p.payment_type',
        'p.title',
        'p.status',
        'p.branch_id',
        'p.budget_id',
        'p.proposal_id',
        'p.requester_user_id',
        'p.payment_method',
        'p.beneficiary_name',
        'p.beneficiary_tax_code',
        'p.bank_name',
        'p.bank_account_no',
        'p.total_amount',
        'p.net_settlement_amount',
        'p.payable_amount',
        'c.requires_receipt',
      ])
      .where('p.id', '=', paymentId)
      .where('p.deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirstOrThrow();

    const totalAmount = Number(payment.total_amount ?? 0);
    const payableAmount = Number(payment.payable_amount ?? 0);
    if (totalAmount <= 0) {
      throw new AppError('INVALID_TOTAL_AMOUNT', 'Tổng số tiền thanh toán phải lớn hơn 0.', 400);
    }

    const needsBankDetails =
      payment.payment_method === 'BANK_TRANSFER' &&
      (payment.payment_type !== 'ADVANCE_SETTLEMENT' || payableAmount > 0);
    if (
      needsBankDetails &&
      (!payment.beneficiary_name?.trim() ||
        !payment.bank_name?.trim() ||
        !payment.bank_account_no?.trim())
    ) {
      throw new AppError(
        'BANK_INFO_REQUIRED',
        'Chuyển khoản ngân hàng bắt buộc có đầy đủ Tên thụ hưởng, Ngân hàng và Số tài khoản.',
        400,
      );
    }

    const items = await trx
      .selectFrom('payment_request_items')
      .select(['description', 'invoice_no', 'invoice_date', 'quantity', 'unit_price', 'tax_rate', 'note'])
      .where('payment_request_id', '=', paymentId)
      .execute();

    if (items.length === 0) {
      throw new AppError('ITEMS_REQUIRED', 'Phiếu thanh toán phải có ít nhất 1 hạng mục chi tiết.', 400);
    }

    await assertNoDuplicateInvoiceNumbers(
      trx,
      items.map((it) => ({
        description: it.description,
        invoiceNo: it.invoice_no,
        invoiceDate: toIsoDate(it.invoice_date),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        taxRate: Number(it.tax_rate),
        note: it.note,
      })),
      payment.beneficiary_tax_code,
      paymentId,
    );

    if (payment.budget_id) {
      const reserveRes = await reserveBudgetForPayment(trx, {
        budgetId: Number(payment.budget_id),
        paymentId,
        paymentCode: payment.code,
        paymentType: payment.payment_type,
        totalAmount,
        netSettlementAmount: Number(payment.net_settlement_amount ?? 0),
        proposalId: payment.proposal_id !== null ? Number(payment.proposal_id) : null,
        branchId: payment.branch_id !== null ? Number(payment.branch_id) : null,
        actorUserId: auth.userId,
      });
      budgetAlert = reserveRes.alert;
    }

    const createdApproval = await createApprovalRequest(
      {
        moduleCode: PAYMENT_MODULE_CODE,
        requestType: PAYMENT_DEFAULT_REQUEST_TYPE,
        entityType: PAYMENT_ENTITY_TYPE,
        entityId: paymentId,
        branchId: payment.branch_id !== null ? Number(payment.branch_id) : null,
        requesterId: Number(payment.requester_user_id),
        directManagerUserId: empCtx.directManagerUserId,
        title: `[${payment.code}] ${payment.title}`,
        summary: `Tổng đề nghị: ${totalAmount.toLocaleString('vi-VN')} ₫ • Thụ hưởng: ${payment.beneficiary_name}`,
        evalContext: { amount: totalAmount },
      },
      trx,
    );

    await trx
      .updateTable('payment_requests')
      .set({
        status: 'PENDING_APPROVAL',
        approval_request_id: createdApproval.approvalRequestId,
        submitted_at: new Date(),
        rejection_reason: null,
        revision_note: null,
        updated_by: auth.userId,
      })
      .where('id', '=', paymentId)
      .execute();

    await trx
      .insertInto('payment_activities')
      .values({
        payment_request_id: paymentId,
        actor_user_id: auth.userId,
        action: 'SUBMITTED',
        summary: `Gửi phê duyệt đa cấp (${createdApproval.totalSteps} cấp duyệt — ${totalAmount.toLocaleString('vi-VN')} ₫)`,
        metadata_json: JSON.stringify({
          approvalRequestId: createdApproval.approvalRequestId,
          totalSteps: createdApproval.totalSteps,
        }),
      })
      .execute();

    return createdApproval.approvalRequestId;
  });

  await notifyApprovalRequestCreated(approvalRequestId);
  await notifyBudgetAlertIfNeeded(budgetAlert, auth.userId);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'PAYMENT_SUBMITTED',
    entityType: 'payment_requests',
    entityId: paymentId,
    newValues: { approvalRequestId },
    ipAddress,
  });

  return getPaymentDetail(auth, paymentId);
}

export async function transitionPaymentStatus(
  auth: AuthContext,
  paymentId: number,
  input: PaymentStatusActionInput,
  ipAddress?: string | null,
): Promise<PaymentDetailView> {
  const access = await assertPaymentViewAccess(auth, paymentId);
  const db = getDb();
  if (input.action === 'REQUEST_REVISION') {
    if (access.status !== 'PENDING_APPROVAL') {
      throw new AppError(
        'INVALID_REVISION_STATUS',
        'Chỉ có thể yêu cầu bổ sung chứng từ khi phiếu đang Chờ phê duyệt.',
        409,
      );
    }

    let canRevise = isFinanceManager(auth);
    if (!canRevise && access.approvalRequestId) {
      const ar = await db
        .selectFrom('approval_requests')
        .select(['requester_id', 'branch_id', 'current_approver_user_id', 'current_approver_role_id', 'status'])
        .where('id', '=', access.approvalRequestId)
        .executeTakeFirst();
      if (
        ar &&
        ar.status === 'PENDING' &&
        (await canAuthActOnApproval(
          {
            requesterId: Number(ar.requester_id),
            branchId: ar.branch_id !== null ? Number(ar.branch_id) : access.branchId,
            requesterDepartmentId: access.departmentId,
            currentApproverUserId:
              ar.current_approver_user_id !== null ? Number(ar.current_approver_user_id) : null,
            currentApproverRoleId:
              ar.current_approver_role_id !== null ? Number(ar.current_approver_role_id) : null,
          },
          auth,
          'APPROVE',
        ))
      ) {
        canRevise = true;
      }
    }
    if (!canRevise) {
      throw new AppError(
        'FORBIDDEN',
        'Chỉ người đang ở lượt duyệt hoặc Kế toán quản trị mới được yêu cầu bổ sung chứng từ.',
        403,
      );
    }

    const note = input.note!.trim();
    await db.transaction().execute(async (trx) => {
      if (access.approvalRequestId) {
        const ar = await trx
          .selectFrom('approval_requests')
          .select(['id', 'current_step', 'status'])
          .where('id', '=', access.approvalRequestId)
          .forUpdate()
          .executeTakeFirst();
        if (ar && ar.status === 'PENDING') {
          await trx
            .updateTable('approval_requests')
            .set({
              status: 'CANCELLED',
              current_approver_user_id: null,
              current_approver_role_id: null,
              completed_at: new Date(),
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
              comment: `Yêu cầu bổ sung chứng từ: ${note}`,
            })
            .execute();
        }
      }

      await releasePaymentBudgetReserve(trx, {
        paymentId,
        paymentCode: access.code,
        actorUserId: auth.userId,
        reason: `Hoàn trả giữ chỗ do yêu cầu bổ sung chứng từ Phiếu ${access.code}`,
      });

      await trx
        .updateTable('payment_requests')
        .set({
          status: 'NEEDS_REVISION',
          revision_note: note,
          updated_by: auth.userId,
        })
        .where('id', '=', paymentId)
        .execute();

      await trx
        .insertInto('payment_comments')
        .values({
          payment_request_id: paymentId,
          author_user_id: auth.userId,
          comment_type: 'REVISION_REQUEST',
          content: note,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .execute();

      await trx
        .insertInto('payment_activities')
        .values({
          payment_request_id: paymentId,
          actor_user_id: auth.userId,
          action: 'REVISION_REQUESTED',
          summary: `Yêu cầu bổ sung chứng từ: ${note}`,
          metadata_json: JSON.stringify({ note }),
        })
        .execute();
    });

    if (access.requesterUserId !== auth.userId) {
      await createNotification({
        userId: access.requesterUserId,
        moduleCode: PAYMENT_MODULE_CODE,
        type: 'PAYMENT_REVISION',
        title: `Yêu cầu bổ sung chứng từ [${access.code}]`,
        message: `${auth.fullName}: ${note}`,
        linkUrl: `/services/payments/${paymentId}`,
      });
    }
  } else {
    // CANCEL
    if (!isFinanceManager(auth) && access.requesterUserId !== auth.userId) {
      throw new AppError('FORBIDDEN', 'Chỉ người lập phiếu hoặc Kế toán quản trị mới được hủy phiếu.', 403);
    }
    if (!['DRAFT', 'NEEDS_REVISION', 'PENDING_APPROVAL'].includes(access.status)) {
      throw new AppError(
        'INVALID_CANCEL_STATUS',
        'Không thể hủy phiếu thanh toán đã được phê duyệt hoặc đã giải ngân.',
        409,
      );
    }

    const reason = input.note?.trim() || 'Người dùng thu hồi / hủy đề nghị thanh toán';
    await db.transaction().execute(async (trx) => {
      if (access.approvalRequestId) {
        const ar = await trx
          .selectFrom('approval_requests')
          .select(['id', 'current_step', 'status'])
          .where('id', '=', access.approvalRequestId)
          .forUpdate()
          .executeTakeFirst();
        if (ar && ar.status === 'PENDING') {
          await trx
            .updateTable('approval_requests')
            .set({
              status: 'CANCELLED',
              current_approver_user_id: null,
              current_approver_role_id: null,
              completed_at: new Date(),
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
              comment: reason,
            })
            .execute();
        }
      }

      await releasePaymentBudgetReserve(trx, {
        paymentId,
        paymentCode: access.code,
        actorUserId: auth.userId,
        reason: `Hoàn trả giữ chỗ do hủy Phiếu thanh toán ${access.code}`,
      });

      await trx
        .updateTable('payment_requests')
        .set({
          status: 'CANCELLED',
          rejection_reason: reason,
          updated_by: auth.userId,
        })
        .where('id', '=', paymentId)
        .execute();

      await trx
        .insertInto('payment_activities')
        .values({
          payment_request_id: paymentId,
          actor_user_id: auth.userId,
          action: 'CANCELLED',
          summary: `Hủy đề nghị thanh toán: ${reason}`,
          metadata_json: JSON.stringify({ reason }),
        })
        .execute();
    });
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: `PAYMENT_${input.action}`,
    entityType: 'payment_requests',
    entityId: paymentId,
    newValues: { action: input.action, note: input.note ?? null },
    ipAddress,
  });

  return getPaymentDetail(auth, paymentId);
}

export async function getPaymentDetail(
  auth: AuthContext,
  paymentId: number,
): Promise<PaymentDetailView> {
  await assertPaymentViewAccess(auth, paymentId);
  const db = getDb();

  const row = await db
    .selectFrom('payment_requests as p')
    .innerJoin('payment_categories as c', 'c.id', 'p.category_id')
    .innerJoin('users as req', 'req.id', 'p.requester_user_id')
    .leftJoin('branches as b', 'b.id', 'p.branch_id')
    .leftJoin('departments as d', 'd.id', 'p.department_id')
    .leftJoin('payment_budgets as bud', 'bud.id', 'p.budget_id')
    .leftJoin('proposals as prop', 'prop.id', 'p.proposal_id')
    .leftJoin('projects as proj', 'proj.id', 'p.project_id')
    .leftJoin('payment_requests as adv', 'adv.id', 'p.linked_advance_id')
    .leftJoin('payment_requests as settled_by', 'settled_by.id', 'p.settled_by_payment_id')
    .select([
      'p.id',
      'p.code',
      'p.payment_type',
      'p.category_id',
      'c.name as category_name',
      'c.name_en as category_name_en',
      'c.color as category_color',
      'c.requires_receipt as category_requires_receipt',
      'p.title',
      'p.description',
      'p.priority',
      'p.status',
      'p.requester_user_id',
      'req.full_name as requester_name',
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
      'p.budget_spent_amount',
      'p.proposal_reserve_used',
      'p.is_over_budget',
      'bud.allocated_amount as budget_allocated_amount',
      'bud.reserved_amount as budget_total_reserved',
      'bud.spent_amount as budget_total_spent',
      'bud.enforcement_mode as budget_enforcement_mode',
      'p.proposal_id',
      'prop.proposal_code as proposal_code',
      'prop.title as proposal_title',
      'p.project_id',
      'proj.code as project_code',
      'proj.name as project_name',
      'p.linked_advance_id',
      'adv.code as linked_advance_code',
      'adv.title as linked_advance_title',
      'p.is_settled',
      'p.settled_by_payment_id',
      'settled_by.code as settled_by_payment_code',
      'p.payment_method',
      'p.beneficiary_type',
      'p.beneficiary_name',
      'p.beneficiary_tax_code',
      'p.bank_name',
      'p.bank_account_no',
      'p.bank_branch',
      'p.currency',
      'p.subtotal_amount',
      'p.tax_amount',
      'p.total_amount',
      'p.advance_amount',
      'p.net_settlement_amount',
      'p.payable_amount',
      'p.approved_amount',
      'p.disbursed_amount',
      'p.due_date',
      'p.advance_due_date',
      'p.approval_request_id',
      'p.submitted_at',
      'p.approved_at',
      'p.paid_at',
      'p.rejection_reason',
      'p.revision_note',
      'p.created_at',
    ])
    .where('p.id', '=', paymentId)
    .where('p.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('PAYMENT_NOT_FOUND', 'Không tìm thấy đề nghị thanh toán.', 404);
  }

  const [itemRows, disbursementRows, commentRows, attachmentRows, activityRows, approvalDetail] =
    await Promise.all([
      db
        .selectFrom('payment_request_items')
        .select([
          'id',
          'description',
          'invoice_no',
          'invoice_date',
          'quantity',
          'unit_price',
          'tax_rate',
          'subtotal_amount',
          'tax_amount',
          'line_total',
          'note',
          'sort_order',
        ])
        .where('payment_request_id', '=', paymentId)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
        .execute(),
      db
        .selectFrom('payment_disbursements as pd')
        .innerJoin('users as u', 'u.id', 'pd.disbursed_by_user_id')
        .select([
          'pd.id',
          'pd.direction',
          'pd.disbursement_date',
          'pd.amount',
          'pd.payment_method',
          'pd.bank_transaction_ref',
          'pd.source_account',
          'pd.note',
          'pd.disbursed_by_user_id',
          'u.full_name as disbursed_by_name',
          'pd.created_at',
        ])
        .where('pd.payment_request_id', '=', paymentId)
        .orderBy('pd.disbursement_date', 'desc')
        .orderBy('pd.id', 'desc')
        .execute(),
      db
        .selectFrom('payment_comments as pc')
        .innerJoin('users as u', 'u.id', 'pc.author_user_id')
        .select([
          'pc.id',
          'pc.author_user_id',
          'u.full_name as author_name',
          'pc.comment_type',
          'pc.content',
          'pc.created_at',
        ])
        .where('pc.payment_request_id', '=', paymentId)
        .where('pc.deleted_at', 'is', null)
        .orderBy('pc.created_at', 'asc')
        .orderBy('pc.id', 'asc')
        .execute(),
      db
        .selectFrom('payment_attachments as pa')
        .innerJoin('users as u', 'u.id', 'pa.uploaded_by_user_id')
        .select([
          'pa.id',
          'pa.attachment_kind',
          'pa.file_name',
          'pa.mime_type',
          'pa.file_size',
          'pa.uploaded_by_user_id',
          'u.full_name as uploaded_by_name',
          'pa.created_at',
        ])
        .where('pa.payment_request_id', '=', paymentId)
        .where('pa.deleted_at', 'is', null)
        .orderBy('pa.created_at', 'desc')
        .execute(),
      db
        .selectFrom('payment_activities as act')
        .leftJoin('users as u', 'u.id', 'act.actor_user_id')
        .select([
          'act.id',
          'act.actor_user_id',
          'u.full_name as actor_name',
          'act.action',
          'act.summary',
          'act.created_at',
        ])
        .where('act.payment_request_id', '=', paymentId)
        .orderBy('act.created_at', 'desc')
        .orderBy('act.id', 'desc')
        .execute(),
      row.approval_request_id
        ? getApprovalDetailWithHistory(Number(row.approval_request_id), auth).catch(() => null)
        : Promise.resolve(null),
    ]);

  const totalAmount = Number(row.total_amount ?? 0);
  const advanceAmount = Number(row.advance_amount ?? 0);
  const netSettlementAmount = Number(row.net_settlement_amount ?? 0);
  const payableAmount = Number(row.payable_amount ?? 0);
  const disbursedAmount = Number(row.disbursed_amount ?? 0);
  const targetAmount = computeTargetDisbursementAmount({
    paymentType: row.payment_type,
    payableAmount,
    netSettlementAmount,
  });
  const progress = evaluateDisbursementProgress(targetAmount, disbursedAmount);
  const today = getTodayDateString();
  const dueDate = toIsoDate(row.due_date);
  const isOverdue =
    Boolean(dueDate) &&
    dueDate! < today &&
    ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID'].includes(row.status);

  const settlementDirection =
    row.payment_type === 'ADVANCE_SETTLEMENT'
      ? computeAdvanceSettlement(totalAmount, advanceAmount).settlementDirection
      : null;

  const isOwner = Number(row.requester_user_id) === auth.userId;
  const isMgr = isFinanceManager(auth);
  const hasDisbursePerm = auth.isSuperAdmin || auth.permissions.includes('payments.disburse');
  const canCollab = canCollaborateOnPaymentStatus(row.status);
  const canUploadUnc = false;

  const isRefundSettlement =
    row.payment_type === 'ADVANCE_SETTLEMENT' && netSettlementAmount < 0;

  const actions: PaymentDetailActions = {
    canEdit: (isOwner || isMgr) && ['DRAFT', 'NEEDS_REVISION'].includes(row.status),
    canDelete: (isOwner || isMgr) && ['DRAFT', 'CANCELLED'].includes(row.status),
    canSubmit: (isOwner || isMgr) && ['DRAFT', 'NEEDS_REVISION'].includes(row.status),
    canCancel:
      (isOwner || isMgr) && ['DRAFT', 'NEEDS_REVISION', 'PENDING_APPROVAL'].includes(row.status),
    canRequestRevision:
      row.status === 'PENDING_APPROVAL' &&
      (isMgr || Boolean(approvalDetail?.canApproveOrReject)),
    canDisburse:
      hasDisbursePerm &&
      !isRefundSettlement &&
      ['APPROVED', 'PARTIALLY_PAID'].includes(row.status) &&
      progress.remainingAmount > 0,
    canConfirmRefund:
      hasDisbursePerm &&
      isRefundSettlement &&
      ['APPROVED', 'PARTIALLY_PAID'].includes(row.status) &&
      progress.remainingAmount > 0,
    canCreateSettlement:
      (isOwner || isMgr) &&
      row.payment_type === 'CASH_ADVANCE' &&
      row.status === 'PAID' &&
      Number(row.is_settled) === 0,
    canComment: canCollab,
    canUploadAttachment: canCollab,
    canUploadUncReceipt: canUploadUnc,
    canExportPdf:
      auth.isSuperAdmin ||
      auth.permissions.includes('payments.export') ||
      isOwner ||
      Boolean(approvalDetail?.canApproveOrReject),
  };

  const wordsTarget =
    row.payment_type === 'ADVANCE_SETTLEMENT'
      ? Math.abs(netSettlementAmount) > 0
        ? Math.abs(netSettlementAmount)
        : totalAmount
      : totalAmount;

  return {
    id: Number(row.id),
    code: row.code,
    paymentType: row.payment_type,
    categoryId: Number(row.category_id),
    categoryName: row.category_name,
    categoryNameEn: row.category_name_en ?? null,
    categoryColor: row.category_color,
    categoryRequiresReceipt: Number(row.category_requires_receipt) === 1,
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
    budgetId: row.budget_id !== null ? Number(row.budget_id) : null,
    budgetCode: row.budget_code ?? null,
    budgetName: row.budget_name ?? null,
    budgetNameEn: row.budget_name_en ?? null,
    budgetReservedAmount: Number(row.budget_reserved_amount ?? 0),
    budgetSpentAmount: Number(row.budget_spent_amount ?? 0),
    proposalReserveUsed: Number(row.proposal_reserve_used ?? 0),
    isOverBudget: Number(row.is_over_budget ?? 0) === 1,
    budgetAllocatedAmount:
      row.budget_allocated_amount !== null && row.budget_allocated_amount !== undefined
        ? Number(row.budget_allocated_amount)
        : null,
    budgetAvailableAmount:
      row.budget_allocated_amount !== null && row.budget_allocated_amount !== undefined
        ? Math.round(
            (Number(row.budget_allocated_amount) -
              Number(row.budget_total_reserved ?? 0) -
              Number(row.budget_total_spent ?? 0) +
              Number.EPSILON) *
              100,
          ) / 100
        : null,
    budgetEnforcementMode: row.budget_enforcement_mode ?? null,
    proposalId: row.proposal_id !== null ? Number(row.proposal_id) : null,
    proposalCode: row.proposal_code ?? null,
    proposalTitle: row.proposal_title ?? null,
    projectId: row.project_id !== null ? Number(row.project_id) : null,
    projectCode: row.project_code ?? null,
    projectName: row.project_name ?? null,
    linkedAdvanceId: row.linked_advance_id !== null ? Number(row.linked_advance_id) : null,
    linkedAdvanceCode: row.linked_advance_code ?? null,
    linkedAdvanceTitle: row.linked_advance_title ?? null,
    isSettled: Number(row.is_settled) === 1,
    settledByPaymentId:
      row.settled_by_payment_id !== null ? Number(row.settled_by_payment_id) : null,
    settledByPaymentCode: row.settled_by_payment_code ?? null,
    paymentMethod: row.payment_method,
    beneficiaryType: row.beneficiary_type,
    beneficiaryName: row.beneficiary_name,
    beneficiaryTaxCode: row.beneficiary_tax_code,
    bankName: row.bank_name,
    bankAccountNo: row.bank_account_no,
    bankBranch: row.bank_branch,
    currency: row.currency,
    subtotalAmount: Number(row.subtotal_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    totalAmount,
    advanceAmount,
    netSettlementAmount,
    payableAmount,
    approvedAmount: row.approved_amount !== null ? Number(row.approved_amount) : null,
    disbursedAmount,
    remainingAmount: progress.remainingAmount,
    disbursementProgressPercent: progress.progressPercent,
    settlementDirection,
    dueDate,
    advanceDueDate: toIsoDate(row.advance_due_date),
    isOverdue,
    approvalRequestId: row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    submittedAt: toIsoDateTime(row.submitted_at),
    approvedAt: toIsoDateTime(row.approved_at),
    paidAt: toIsoDateTime(row.paid_at),
    rejectionReason: row.rejection_reason,
    revisionNote: row.revision_note,
    createdAt: toIsoDateTime(row.created_at) ?? new Date().toISOString(),
    amountInWordsVi: amountToVietnameseWords(wordsTarget),
    amountInWordsEn: amountToEnglishWords(wordsTarget),
    items: itemRows.map((it) => ({
      id: Number(it.id),
      description: it.description,
      invoiceNo: it.invoice_no,
      invoiceDate: toIsoDate(it.invoice_date),
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      taxRate: Number(it.tax_rate),
      subtotalAmount: Number(it.subtotal_amount),
      taxAmount: Number(it.tax_amount),
      lineTotal: Number(it.line_total),
      note: it.note,
      sortOrder: Number(it.sort_order),
    })),
    disbursements: disbursementRows.map((d) => ({
      id: Number(d.id),
      direction: d.direction,
      disbursementDate: toIsoDate(d.disbursement_date) ?? today,
      amount: Number(d.amount),
      paymentMethod: d.payment_method,
      bankTransactionRef: d.bank_transaction_ref,
      sourceAccount: d.source_account,
      note: d.note,
      disbursedByUserId: Number(d.disbursed_by_user_id),
      disbursedByName: d.disbursed_by_name,
      createdAt: toIsoDateTime(d.created_at) ?? new Date().toISOString(),
    })),
    comments: commentRows.map((cm) => ({
      id: Number(cm.id),
      authorUserId: Number(cm.author_user_id),
      authorName: cm.author_name,
      commentType: cm.comment_type,
      content: cm.content,
      createdAt: toIsoDateTime(cm.created_at) ?? new Date().toISOString(),
    })),
    attachments: attachmentRows.map((at) => ({
      id: Number(at.id),
      attachmentKind: at.attachment_kind,
      fileName: at.file_name,
      mimeType: at.mime_type,
      fileSize: Number(at.file_size),
      uploadedByUserId: Number(at.uploaded_by_user_id),
      uploadedByName: at.uploaded_by_name,
      createdAt: toIsoDateTime(at.created_at) ?? new Date().toISOString(),
      canDelete: canCollab && (isMgr || Number(at.uploaded_by_user_id) === auth.userId),
    })),
    activities: activityRows.map((ac) => ({
      id: Number(ac.id),
      actorUserId: ac.actor_user_id !== null ? Number(ac.actor_user_id) : null,
      actorName: ac.actor_name ?? null,
      action: ac.action,
      summary: ac.summary,
      createdAt: toIsoDateTime(ac.created_at) ?? new Date().toISOString(),
    })),
    approval: approvalDetail,
    actions,
  };
}
