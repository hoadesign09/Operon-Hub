import type { Transaction } from 'kysely';
import {
  getDb,
  type BudgetEnforcementMode,
  type BudgetPeriodType,
  type BudgetStatus,
  type BudgetTxType,
  type DatabaseSchema,
} from '@/config/database';
import {
  canTransitionBudgetStatus,
  computeBudgetSnapshot,
  formatBudgetCode,
  type BudgetHealthStatus,
} from '@/lib/portable/budget-calculator';
import { formatVND, roundCurrency } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { resolveEmployeeAccessScope } from '@/modules/hrm/employees/employees.scope';
import { BUDGET_ENTITY_TYPE } from '@/modules/payments/budgets.constants';
import type {
  AdjustBudgetInput,
  ChangeBudgetStatusInput,
  CreateBudgetInput,
  TransferBudgetInput,
  UpdateBudgetInput,
} from '@/modules/payments/budgets.schema';
import { PAYMENT_MODULE_CODE } from '@/modules/payments/payments.constants';
import { AppError } from '@/shared/api-response';

export interface BudgetListItemView {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  fiscalYear: number;
  periodType: BudgetPeriodType;
  periodLabel: string;
  startDate: string;
  endDate: string;
  branchId: number | null;
  branchName: string | null;
  branchNameEn: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryNameEn: string | null;
  categoryColor: string | null;
  projectId: number | null;
  projectCode: string | null;
  projectName: string | null;
  ownerUserId: number | null;
  ownerName: string | null;
  currency: string;
  allocatedAmount: number;
  reservedAmount: number;
  spentAmount: number;
  committedTotal: number;
  availableAmount: number;
  utilizationPercent: number;
  spentPercent: number;
  reservedPercent: number;
  warningThresholdPercent: number;
  enforcementMode: BudgetEnforcementMode;
  status: BudgetStatus;
  health: BudgetHealthStatus;
  linkedProposalCount: number;
  linkedPaymentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTransactionView {
  id: number;
  budgetId: number;
  txType: BudgetTxType;
  sourceType: 'MANUAL' | 'TRANSFER' | 'PROPOSAL' | 'PAYMENT' | 'DISBURSEMENT';
  sourceId: number | null;
  sourceCode: string | null;
  relatedBudgetId: number | null;
  relatedBudgetCode: string | null;
  allocatedDelta: number;
  reservedDelta: number;
  spentDelta: number;
  balanceAllocatedAfter: number;
  balanceReservedAfter: number;
  balanceSpentAfter: number;
  balanceAvailableAfter: number;
  note: string | null;
  actorUserId: number | null;
  actorName: string | null;
  createdAt: string;
}

export interface BudgetLinkedProposalView {
  id: number;
  proposalCode: string;
  title: string;
  status: string;
  requesterName: string;
  estimatedBudget: number;
  approvedBudget: number | null;
  budgetReservedAmount: number;
  isOverBudget: boolean;
  createdAt: string;
}

export interface BudgetLinkedPaymentView {
  id: number;
  code: string;
  paymentType: string;
  title: string;
  status: string;
  requesterName: string;
  totalAmount: number;
  disbursedAmount: number;
  budgetReservedAmount: number;
  budgetSpentAmount: number;
  proposalCode: string | null;
  isOverBudget: boolean;
  createdAt: string;
}

export interface BudgetDetailView extends BudgetListItemView {
  transactions: BudgetTransactionView[];
  linkedProposals: BudgetLinkedProposalView[];
  linkedPayments: BudgetLinkedPaymentView[];
  actions: {
    canEdit: boolean;
    canAdjust: boolean;
    canTransfer: boolean;
    canActivate: boolean;
    canFreeze: boolean;
    canClose: boolean;
    canDelete: boolean;
  };
}

export interface BudgetSummaryView {
  totalBudgets: number;
  activeBudgets: number;
  frozenBudgets: number;
  closedBudgets: number;
  totalAllocated: number;
  totalReserved: number;
  totalSpent: number;
  totalAvailable: number;
  overallUtilizationPercent: number;
  warningCount: number;
  exceededCount: number;
}

export interface BudgetOptionView {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  fiscalYear: number;
  periodLabel: string;
  branchId: number | null;
  branchName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  categoryId: number | null;
  allocatedAmount: number;
  reservedAmount: number;
  spentAmount: number;
  availableAmount: number;
  utilizationPercent: number;
  warningThresholdPercent: number;
  enforcementMode: BudgetEnforcementMode;
  health: BudgetHealthStatus;
}

export interface ListBudgetsQuery {
  fiscalYear?: number;
  periodType?: string;
  status?: string;
  branchId?: number;
  departmentId?: number;
  categoryId?: number;
  health?: string;
  search?: string;
  page?: number;
  limit?: number;
}

function toIsoDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function toIsoDateTime(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

export function canManageBudgets(auth: AuthContext): boolean {
  return (
    auth.isSuperAdmin ||
    auth.permissions.includes('payments.budgets.manage') ||
    auth.permissions.includes('payments.manage')
  );
}

export function canViewBudgets(auth: AuthContext): boolean {
  return (
    canManageBudgets(auth) ||
    auth.permissions.includes('payments.budgets.read') ||
    auth.permissions.includes('payments.disburse')
  );
}

async function generateNextBudgetCode(
  trx: Transaction<DatabaseSchema>,
  fiscalYear: number,
  scopeCode: string,
): Promise<string> {
  const cleanScope =
    scopeCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8) || 'GEN';
  const prefix = `BUD-${String(fiscalYear).padStart(4, '0')}-${cleanScope}-`;

  const last = await trx
    .selectFrom('payment_budgets')
    .select(['code'])
    .where('code', 'like', `${prefix}%`)
    .orderBy('code', 'desc')
    .limit(1)
    .executeTakeFirst();

  let seq = 1;
  if (last?.code) {
    const num = Number.parseInt(last.code.slice(prefix.length), 10);
    if (Number.isFinite(num) && num >= 1) {
      seq = num + 1;
    }
  }
  return formatBudgetCode(fiscalYear, cleanScope, seq);
}

async function fetchBudgetRows(auth: AuthContext, query: ListBudgetsQuery): Promise<BudgetListItemView[]> {
  const db = getDb();
  let qb = db
    .selectFrom('payment_budgets as pb')
    .leftJoin('branches as b', 'b.id', 'pb.branch_id')
    .leftJoin('departments as d', 'd.id', 'pb.department_id')
    .leftJoin('payment_categories as c', 'c.id', 'pb.category_id')
    .leftJoin('projects as proj', 'proj.id', 'pb.project_id')
    .leftJoin('users as owner', 'owner.id', 'pb.owner_user_id')
    .select([
      'pb.id',
      'pb.code',
      'pb.name',
      'pb.name_en',
      'pb.description',
      'pb.fiscal_year',
      'pb.period_type',
      'pb.period_label',
      'pb.start_date',
      'pb.end_date',
      'pb.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'pb.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'pb.category_id',
      'c.name as category_name',
      'c.name_en as category_name_en',
      'c.color as category_color',
      'pb.project_id',
      'proj.code as project_code',
      'proj.name as project_name',
      'pb.owner_user_id',
      'owner.full_name as owner_name',
      'pb.currency',
      'pb.allocated_amount',
      'pb.reserved_amount',
      'pb.spent_amount',
      'pb.warning_threshold_percent',
      'pb.enforcement_mode',
      'pb.status',
      'pb.created_at',
      'pb.updated_at',
    ])
    .where('pb.deleted_at', 'is', null);

  if (!canManageBudgets(auth)) {
    if (!auth.hasAllBranches && auth.branchIds.length > 0) {
      qb = qb.where((eb) =>
        eb.or([eb('pb.branch_id', 'is', null), eb('pb.branch_id', 'in', auth.branchIds)]),
      );
    }

    if (auth.dataScope === 'DEPARTMENT') {
      const empScope = await resolveEmployeeAccessScope(auth);
      qb = qb.where((eb) => {
        const deptConds = [eb('pb.owner_user_id', '=', auth.userId)];
        if (empScope.departmentIds.length > 0) {
          deptConds.push(eb('pb.department_id', 'in', empScope.departmentIds));
        }
        return eb.or(deptConds);
      });
    } else if (auth.dataScope === 'OWN') {
      const empScope = await resolveEmployeeAccessScope(auth);
      qb = qb.where((eb) => {
        const ownConds = [
          eb('pb.department_id', 'is', null),
          eb('pb.owner_user_id', '=', auth.userId),
        ];
        if (empScope.departmentIds.length > 0) {
          ownConds.push(eb('pb.department_id', 'in', empScope.departmentIds));
        }
        return eb.or(ownConds);
      });
    }
  }

  if (query.fiscalYear) {
    qb = qb.where('pb.fiscal_year', '=', query.fiscalYear);
  }
  if (query.periodType) {
    qb = qb.where('pb.period_type', '=', query.periodType as BudgetPeriodType);
  }
  if (query.status) {
    qb = qb.where('pb.status', '=', query.status as BudgetStatus);
  }
  if (query.branchId) {
    qb = qb.where((eb) =>
      eb.or([eb('pb.branch_id', '=', query.branchId!), eb('pb.branch_id', 'is', null)]),
    );
  }
  if (query.departmentId) {
    qb = qb.where('pb.department_id', '=', query.departmentId);
  }
  if (query.categoryId) {
    qb = qb.where('pb.category_id', '=', query.categoryId);
  }
  if (query.search?.trim()) {
    const like = `%${query.search.trim()}%`;
    qb = qb.where((eb) =>
      eb.or([
        eb('pb.code', 'like', like),
        eb('pb.name', 'like', like),
        eb('pb.name_en', 'like', like),
        eb('pb.period_label', 'like', like),
        eb('d.name', 'like', like),
        eb('c.name', 'like', like),
      ]),
    );
  }

  const rows = await qb
    .orderBy('pb.fiscal_year', 'desc')
    .orderBy('pb.status', 'asc')
    .orderBy('pb.code', 'asc')
    .execute();

  if (rows.length === 0) {
    return [];
  }

  const budgetIds = rows.map((r) => Number(r.id));
  const [proposalCounts, paymentCounts] = await Promise.all([
    db
      .selectFrom('proposals')
      .select(['budget_id', (eb) => eb.fn.count<number>('id').as('cnt')])
      .where('budget_id', 'in', budgetIds)
      .where('deleted_at', 'is', null)
      .groupBy('budget_id')
      .execute(),
    db
      .selectFrom('payment_requests')
      .select(['budget_id', (eb) => eb.fn.count<number>('id').as('cnt')])
      .where('budget_id', 'in', budgetIds)
      .where('deleted_at', 'is', null)
      .groupBy('budget_id')
      .execute(),
  ]);

  const propCountMap = new Map<number, number>(
    proposalCounts.map((r) => [Number(r.budget_id), Number(r.cnt)]),
  );
  const payCountMap = new Map<number, number>(
    paymentCounts.map((r) => [Number(r.budget_id), Number(r.cnt)]),
  );

  let mapped = rows.map((r): BudgetListItemView => {
    const snap = computeBudgetSnapshot({
      allocatedAmount: Number(r.allocated_amount ?? 0),
      reservedAmount: Number(r.reserved_amount ?? 0),
      spentAmount: Number(r.spent_amount ?? 0),
      warningThresholdPercent: Number(r.warning_threshold_percent ?? 80),
    });

    return {
      id: Number(r.id),
      code: r.code,
      name: r.name,
      nameEn: r.name_en ?? null,
      description: r.description ?? null,
      fiscalYear: Number(r.fiscal_year),
      periodType: r.period_type,
      periodLabel: r.period_label,
      startDate: toIsoDate(r.start_date),
      endDate: toIsoDate(r.end_date),
      branchId: r.branch_id !== null ? Number(r.branch_id) : null,
      branchName: r.branch_name ?? null,
      branchNameEn: r.branch_name_en ?? null,
      departmentId: r.department_id !== null ? Number(r.department_id) : null,
      departmentName: r.department_name ?? null,
      departmentNameEn: r.department_name_en ?? null,
      categoryId: r.category_id !== null ? Number(r.category_id) : null,
      categoryName: r.category_name ?? null,
      categoryNameEn: r.category_name_en ?? null,
      categoryColor: r.category_color ?? null,
      projectId: r.project_id !== null ? Number(r.project_id) : null,
      projectCode: r.project_code ?? null,
      projectName: r.project_name ?? null,
      ownerUserId: r.owner_user_id !== null ? Number(r.owner_user_id) : null,
      ownerName: r.owner_name ?? null,
      currency: r.currency,
      allocatedAmount: snap.allocatedAmount,
      reservedAmount: snap.reservedAmount,
      spentAmount: snap.spentAmount,
      committedTotal: snap.committedTotal,
      availableAmount: snap.availableAmount,
      utilizationPercent: snap.utilizationPercent,
      spentPercent: snap.spentPercent,
      reservedPercent: snap.reservedPercent,
      warningThresholdPercent: snap.warningThresholdPercent,
      enforcementMode: r.enforcement_mode,
      status: r.status,
      health: snap.health,
      linkedProposalCount: propCountMap.get(Number(r.id)) ?? 0,
      linkedPaymentCount: payCountMap.get(Number(r.id)) ?? 0,
      createdAt: toIsoDateTime(r.created_at),
      updatedAt: toIsoDateTime(r.updated_at),
    };
  });

  if (query.health && ['HEALTHY', 'WARNING', 'EXCEEDED'].includes(query.health)) {
    mapped = mapped.filter((item) => item.health === query.health);
  }

  return mapped;
}

export async function listBudgets(
  auth: AuthContext,
  query: ListBudgetsQuery,
): Promise<{ items: BudgetListItemView[]; meta: PaginationMeta }> {
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 200 },
  );
  const all = await fetchBudgetRows(auth, query);
  const items = all.slice(pagination.offset, pagination.offset + pagination.limit);
  return {
    items,
    meta: buildPaginationMeta(all.length, pagination.page, pagination.limit),
  };
}

export async function getBudgetsSummary(
  auth: AuthContext,
  filters: { fiscalYear?: number; branchId?: number },
): Promise<BudgetSummaryView> {
  const rows = await fetchBudgetRows(auth, filters);
  const summary: BudgetSummaryView = {
    totalBudgets: rows.length,
    activeBudgets: 0,
    frozenBudgets: 0,
    closedBudgets: 0,
    totalAllocated: 0,
    totalReserved: 0,
    totalSpent: 0,
    totalAvailable: 0,
    overallUtilizationPercent: 0,
    warningCount: 0,
    exceededCount: 0,
  };

  for (const row of rows) {
    if (row.status === 'ACTIVE') summary.activeBudgets += 1;
    else if (row.status === 'FROZEN') summary.frozenBudgets += 1;
    else if (row.status === 'CLOSED') summary.closedBudgets += 1;

    if (row.status !== 'DRAFT') {
      summary.totalAllocated = roundCurrency(summary.totalAllocated + row.allocatedAmount);
      summary.totalReserved = roundCurrency(summary.totalReserved + row.reservedAmount);
      summary.totalSpent = roundCurrency(summary.totalSpent + row.spentAmount);
    }

    if (row.health === 'WARNING') summary.warningCount += 1;
    else if (row.health === 'EXCEEDED') summary.exceededCount += 1;
  }

  summary.totalAvailable = roundCurrency(
    summary.totalAllocated - summary.totalReserved - summary.totalSpent,
  );
  summary.overallUtilizationPercent =
    summary.totalAllocated > 0
      ? Math.round(
          (((summary.totalReserved + summary.totalSpent) / summary.totalAllocated) * 100 +
            Number.EPSILON) *
            100,
        ) / 100
      : 0;

  return summary;
}

export async function listActiveBudgetOptions(
  auth: AuthContext,
  filters?: { branchId?: number; departmentId?: number; fiscalYear?: number },
): Promise<BudgetOptionView[]> {
  const rows = await fetchBudgetRows(auth, {
    status: 'ACTIVE',
    branchId: filters?.branchId,
    fiscalYear: filters?.fiscalYear,
  });

  const sorted = [...rows].sort((a, b) => {
    const aDeptMatch = filters?.departmentId && a.departmentId === filters.departmentId ? 0 : 1;
    const bDeptMatch = filters?.departmentId && b.departmentId === filters.departmentId ? 0 : 1;
    if (aDeptMatch !== bDeptMatch) return aDeptMatch - bDeptMatch;
    return a.code.localeCompare(b.code);
  });

  const showFinancials = canViewBudgets(auth);

  return sorted.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    nameEn: r.nameEn,
    fiscalYear: r.fiscalYear,
    periodLabel: r.periodLabel,
    branchId: r.branchId,
    branchName: r.branchName,
    departmentId: r.departmentId,
    departmentName: r.departmentName,
    categoryId: r.categoryId,
    allocatedAmount: showFinancials ? r.allocatedAmount : 0,
    reservedAmount: showFinancials ? r.reservedAmount : 0,
    spentAmount: showFinancials ? r.spentAmount : 0,
    availableAmount: showFinancials ? r.availableAmount : 0,
    utilizationPercent: showFinancials ? r.utilizationPercent : 0,
    warningThresholdPercent: r.warningThresholdPercent,
    enforcementMode: r.enforcementMode,
    health: r.health,
  }));
}

export async function getBudgetDetail(auth: AuthContext, budgetId: number): Promise<BudgetDetailView> {
  const all = await fetchBudgetRows(auth, {});
  const found = all.find((item) => item.id === budgetId);
  if (!found) {
    throw new AppError('BUDGET_NOT_FOUND', 'Không tìm thấy quỹ ngân sách.', 404);
  }

  const db = getDb();
  const isMgr = canManageBudgets(auth);
  const empScope =
    !isMgr && auth.dataScope === 'DEPARTMENT' ? await resolveEmployeeAccessScope(auth) : null;

  let propQuery = db
    .selectFrom('proposals as p')
    .innerJoin('users as u', 'u.id', 'p.requester_user_id')
    .select([
      'p.id',
      'p.proposal_code',
      'p.title',
      'p.status',
      'u.full_name as requester_name',
      'p.estimated_budget',
      'p.approved_budget',
      'p.budget_reserved_amount',
      'p.is_over_budget',
      'p.created_at',
    ])
    .where('p.budget_id', '=', budgetId)
    .where('p.deleted_at', 'is', null);

  let payQuery = db
    .selectFrom('payment_requests as pr')
    .innerJoin('users as u', 'u.id', 'pr.requester_user_id')
    .leftJoin('proposals as prop', 'prop.id', 'pr.proposal_id')
    .select([
      'pr.id',
      'pr.code',
      'pr.payment_type',
      'pr.title',
      'pr.status',
      'u.full_name as requester_name',
      'pr.total_amount',
      'pr.disbursed_amount',
      'pr.budget_reserved_amount',
      'pr.budget_spent_amount',
      'prop.proposal_code',
      'pr.is_over_budget',
      'pr.created_at',
    ])
    .where('pr.budget_id', '=', budgetId)
    .where('pr.deleted_at', 'is', null);

  if (empScope) {
    propQuery = propQuery.where((eb) => {
      const conds = [eb('p.requester_user_id', '=', auth.userId)];
      if (empScope.departmentIds.length > 0) {
        conds.push(eb('p.department_id', 'in', empScope.departmentIds));
      }
      return eb.or(conds);
    });
    payQuery = payQuery.where((eb) => {
      const conds = [eb('pr.requester_user_id', '=', auth.userId)];
      if (empScope.departmentIds.length > 0) {
        conds.push(eb('pr.department_id', 'in', empScope.departmentIds));
      }
      return eb.or(conds);
    });
  }

  const [txRows, propRows, payRows] = await Promise.all([
    db
      .selectFrom('payment_budget_transactions as tx')
      .leftJoin('payment_budgets as rel', 'rel.id', 'tx.related_budget_id')
      .leftJoin('users as u', 'u.id', 'tx.actor_user_id')
      .select([
        'tx.id',
        'tx.budget_id',
        'tx.tx_type',
        'tx.source_type',
        'tx.source_id',
        'tx.source_code',
        'tx.related_budget_id',
        'rel.code as related_budget_code',
        'tx.allocated_delta',
        'tx.reserved_delta',
        'tx.spent_delta',
        'tx.balance_allocated_after',
        'tx.balance_reserved_after',
        'tx.balance_spent_after',
        'tx.balance_available_after',
        'tx.note',
        'tx.actor_user_id',
        'u.full_name as actor_name',
        'tx.created_at',
      ])
      .where('tx.budget_id', '=', budgetId)
      .orderBy('tx.id', 'desc')
      .limit(100)
      .execute(),
    propQuery.orderBy('p.id', 'desc').limit(100).execute(),
    payQuery.orderBy('pr.id', 'desc').limit(100).execute(),
  ]);

  return {
    ...found,
    transactions: txRows.map((t) => ({
      id: Number(t.id),
      budgetId: Number(t.budget_id),
      txType: t.tx_type,
      sourceType: t.source_type,
      sourceId: t.source_id !== null ? Number(t.source_id) : null,
      sourceCode: t.source_code ?? null,
      relatedBudgetId: t.related_budget_id !== null ? Number(t.related_budget_id) : null,
      relatedBudgetCode: t.related_budget_code ?? null,
      allocatedDelta: Number(t.allocated_delta ?? 0),
      reservedDelta: Number(t.reserved_delta ?? 0),
      spentDelta: Number(t.spent_delta ?? 0),
      balanceAllocatedAfter: Number(t.balance_allocated_after ?? 0),
      balanceReservedAfter: Number(t.balance_reserved_after ?? 0),
      balanceSpentAfter: Number(t.balance_spent_after ?? 0),
      balanceAvailableAfter: Number(t.balance_available_after ?? 0),
      note: t.note ?? null,
      actorUserId: t.actor_user_id !== null ? Number(t.actor_user_id) : null,
      actorName: t.actor_name ?? null,
      createdAt: toIsoDateTime(t.created_at),
    })),
    linkedProposals: propRows.map((p) => ({
      id: Number(p.id),
      proposalCode: p.proposal_code,
      title: p.title,
      status: p.status,
      requesterName: p.requester_name,
      estimatedBudget: Number(p.estimated_budget ?? 0),
      approvedBudget: p.approved_budget !== null ? Number(p.approved_budget) : null,
      budgetReservedAmount: Number(p.budget_reserved_amount ?? 0),
      isOverBudget: Number(p.is_over_budget) === 1,
      createdAt: toIsoDateTime(p.created_at),
    })),
    linkedPayments: payRows.map((pr) => ({
      id: Number(pr.id),
      code: pr.code,
      paymentType: pr.payment_type,
      title: pr.title,
      status: pr.status,
      requesterName: pr.requester_name,
      totalAmount: Number(pr.total_amount ?? 0),
      disbursedAmount: Number(pr.disbursed_amount ?? 0),
      budgetReservedAmount: Number(pr.budget_reserved_amount ?? 0),
      budgetSpentAmount: Number(pr.budget_spent_amount ?? 0),
      proposalCode: pr.proposal_code ?? null,
      isOverBudget: Number(pr.is_over_budget) === 1,
      createdAt: toIsoDateTime(pr.created_at),
    })),
    actions: {
      canEdit: isMgr && found.status !== 'CLOSED',
      canAdjust: isMgr && (found.status === 'DRAFT' || found.status === 'ACTIVE' || found.status === 'FROZEN'),
      canTransfer: isMgr && found.status === 'ACTIVE' && found.availableAmount > 0,
      canActivate: isMgr && (found.status === 'DRAFT' || found.status === 'FROZEN'),
      canFreeze: isMgr && found.status === 'ACTIVE',
      canClose: isMgr && found.status !== 'CLOSED',
      canDelete:
        isMgr &&
        found.status === 'DRAFT' &&
        found.linkedProposalCount === 0 &&
        found.linkedPaymentCount === 0,
    },
  };
}

export async function createBudget(
  auth: AuthContext,
  input: CreateBudgetInput,
  ipAddress?: string | null,
): Promise<BudgetDetailView> {
  const db = getDb();
  const allocatedAmount = roundCurrency(input.allocatedAmount);

  let scopeCode = 'GEN';
  if (input.departmentId) {
    const dept = await db
      .selectFrom('departments')
      .select(['code'])
      .where('id', '=', input.departmentId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (dept?.code) scopeCode = dept.code;
  } else if (input.categoryId) {
    const cat = await db
      .selectFrom('payment_categories')
      .select(['code'])
      .where('id', '=', input.categoryId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (cat?.code) scopeCode = cat.code.slice(0, 6);
  }

  const createdId = await db.transaction().execute(async (trx) => {
    const finalCode = input.code?.trim()
      ? input.code.trim().toUpperCase()
      : await generateNextBudgetCode(trx, input.fiscalYear, scopeCode);

    const dup = await trx
      .selectFrom('payment_budgets')
      .select(['id'])
      .where('code', '=', finalCode)
      .executeTakeFirst();
    if (dup) {
      throw new AppError('BUDGET_CODE_EXISTS', `Mã quỹ ngân sách "${finalCode}" đã tồn tại.`, 409);
    }

    const inserted = await trx
      .insertInto('payment_budgets')
      .values({
        code: finalCode,
        name: input.name,
        name_en: input.nameEn?.trim() || null,
        description: input.description?.trim() || null,
        fiscal_year: input.fiscalYear,
        period_type: input.periodType,
        period_label: input.periodLabel,
        start_date: input.startDate,
        end_date: input.endDate,
        branch_id: input.branchId ?? null,
        department_id: input.departmentId ?? null,
        category_id: input.categoryId ?? null,
        project_id: input.projectId ?? null,
        owner_user_id: input.ownerUserId ?? auth.userId,
        currency: 'VND',
        allocated_amount: allocatedAmount,
        reserved_amount: 0,
        spent_amount: 0,
        warning_threshold_percent: input.warningThresholdPercent,
        enforcement_mode: input.enforcementMode,
        status: input.status,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    const budgetId = Number(inserted.insertId);
    await trx
      .insertInto('payment_budget_transactions')
      .values({
        budget_id: budgetId,
        tx_type: 'ALLOCATE',
        source_type: 'MANUAL',
        source_id: null,
        source_code: finalCode,
        related_budget_id: null,
        allocated_delta: allocatedAmount,
        reserved_delta: 0,
        spent_delta: 0,
        balance_allocated_after: allocatedAmount,
        balance_reserved_after: 0,
        balance_spent_after: 0,
        balance_available_after: allocatedAmount,
        note: `Khởi tạo quỹ ngân sách kỳ ${input.periodLabel}`,
        actor_user_id: auth.userId,
      })
      .execute();

    return budgetId;
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'BUDGET_CREATED',
    entityType: BUDGET_ENTITY_TYPE,
    entityId: createdId,
    newValues: { name: input.name, allocatedAmount, fiscalYear: input.fiscalYear },
    ipAddress,
  });

  return getBudgetDetail(auth, createdId);
}

export async function updateBudget(
  auth: AuthContext,
  budgetId: number,
  input: UpdateBudgetInput,
  ipAddress?: string | null,
): Promise<BudgetDetailView> {
  const db = getDb();
  const existing = await db
    .selectFrom('payment_budgets')
    .select(['id', 'code', 'status', 'start_date', 'end_date'])
    .where('id', '=', budgetId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('BUDGET_NOT_FOUND', 'Không tìm thấy quỹ ngân sách.', 404);
  }
  if (existing.status === 'CLOSED') {
    throw new AppError('BUDGET_CLOSED', 'Không thể chỉnh sửa quỹ ngân sách đã đóng sổ.', 409);
  }

  const nextStart = input.startDate ?? toIsoDate(existing.start_date);
  const nextEnd = input.endDate ?? toIsoDate(existing.end_date);
  if (nextEnd < nextStart) {
    throw new AppError('INVALID_DATE_RANGE', 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.', 400);
  }

  await db
    .updateTable('payment_budgets')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nameEn !== undefined ? { name_en: input.nameEn?.trim() || null } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.fiscalYear !== undefined ? { fiscal_year: input.fiscalYear } : {}),
      ...(input.periodType !== undefined ? { period_type: input.periodType } : {}),
      ...(input.periodLabel !== undefined ? { period_label: input.periodLabel } : {}),
      ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
      ...(input.endDate !== undefined ? { end_date: input.endDate } : {}),
      ...(input.branchId !== undefined ? { branch_id: input.branchId } : {}),
      ...(input.departmentId !== undefined ? { department_id: input.departmentId } : {}),
      ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
      ...(input.projectId !== undefined ? { project_id: input.projectId } : {}),
      ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}),
      ...(input.warningThresholdPercent !== undefined
        ? { warning_threshold_percent: input.warningThresholdPercent }
        : {}),
      ...(input.enforcementMode !== undefined ? { enforcement_mode: input.enforcementMode } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', budgetId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'BUDGET_UPDATED',
    entityType: BUDGET_ENTITY_TYPE,
    entityId: budgetId,
    newValues: input as Record<string, unknown>,
    ipAddress,
  });

  return getBudgetDetail(auth, budgetId);
}

export async function adjustBudgetAllocation(
  auth: AuthContext,
  budgetId: number,
  input: AdjustBudgetInput,
  ipAddress?: string | null,
): Promise<BudgetDetailView> {
  const db = getDb();
  const amount = roundCurrency(input.amount);

  await db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom('payment_budgets')
      .select(['id', 'code', 'status', 'allocated_amount', 'reserved_amount', 'spent_amount'])
      .where('id', '=', budgetId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!row) {
      throw new AppError('BUDGET_NOT_FOUND', 'Không tìm thấy quỹ ngân sách.', 404);
    }
    if (row.status === 'CLOSED') {
      throw new AppError('BUDGET_CLOSED', 'Không thể điều chỉnh hạn mức quỹ ngân sách đã đóng sổ.', 409);
    }

    const allocated = Number(row.allocated_amount ?? 0);
    const reserved = Number(row.reserved_amount ?? 0);
    const spent = Number(row.spent_amount ?? 0);
    const usedTotal = roundCurrency(reserved + spent);
    const delta = input.action === 'TOP_UP' ? amount : -amount;
    const nextAllocated = roundCurrency(allocated + delta);

    if (input.action === 'REDUCE' && nextAllocated < usedTotal - 0.005) {
      throw new AppError(
        'BUDGET_REDUCE_BELOW_USED',
        `Không thể cắt giảm hạn mức xuống ${nextAllocated.toLocaleString('vi-VN')} ₫ vì quỹ đã giữ chỗ & thực chi ${usedTotal.toLocaleString('vi-VN')} ₫.`,
        409,
      );
    }

    const nextAvailable = roundCurrency(nextAllocated - reserved - spent);
    await trx
      .updateTable('payment_budgets')
      .set({ allocated_amount: nextAllocated, updated_by: auth.userId })
      .where('id', '=', budgetId)
      .execute();

    await trx
      .insertInto('payment_budget_transactions')
      .values({
        budget_id: budgetId,
        tx_type: input.action,
        source_type: 'MANUAL',
        source_id: null,
        source_code: row.code,
        related_budget_id: null,
        allocated_delta: delta,
        reserved_delta: 0,
        spent_delta: 0,
        balance_allocated_after: nextAllocated,
        balance_reserved_after: reserved,
        balance_spent_after: spent,
        balance_available_after: nextAvailable,
        note: input.reason.trim(),
        actor_user_id: auth.userId,
      })
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: input.action === 'TOP_UP' ? 'BUDGET_TOP_UP' : 'BUDGET_REDUCE',
    entityType: BUDGET_ENTITY_TYPE,
    entityId: budgetId,
    newValues: { action: input.action, amount, reason: input.reason },
    ipAddress,
  });

  return getBudgetDetail(auth, budgetId);
}

export async function transferBudgetAllocation(
  auth: AuthContext,
  input: TransferBudgetInput,
  ipAddress?: string | null,
): Promise<{ fromBudget: BudgetDetailView; toBudget: BudgetDetailView }> {
  const db = getDb();
  const amount = roundCurrency(input.amount);
  const lockIds = [input.fromBudgetId, input.toBudgetId].sort((a, b) => a - b);

  await db.transaction().execute(async (trx) => {
    // Lock in deterministic ascending ID order to prevent deadlocks
    const lockedRows = await trx
      .selectFrom('payment_budgets')
      .select(['id', 'code', 'name', 'status', 'allocated_amount', 'reserved_amount', 'spent_amount'])
      .where('id', 'in', lockIds)
      .where('deleted_at', 'is', null)
      .orderBy('id', 'asc')
      .forUpdate()
      .execute();

    const fromRow = lockedRows.find((r) => Number(r.id) === input.fromBudgetId);
    const toRow = lockedRows.find((r) => Number(r.id) === input.toBudgetId);

    if (!fromRow) {
      throw new AppError('SOURCE_BUDGET_NOT_FOUND', 'Không tìm thấy quỹ ngân sách nguồn.', 404);
    }
    if (!toRow) {
      throw new AppError('TARGET_BUDGET_NOT_FOUND', 'Không tìm thấy quỹ ngân sách đích.', 404);
    }
    if (fromRow.status !== 'ACTIVE' || toRow.status !== 'ACTIVE') {
      throw new AppError(
        'BUDGET_NOT_ACTIVE',
        'Cả quỹ nguồn và quỹ đích đều phải đang ở trạng thái Đang hiệu lực (ACTIVE) để điều chuyển.',
        409,
      );
    }

    const fromAlloc = Number(fromRow.allocated_amount ?? 0);
    const fromResv = Number(fromRow.reserved_amount ?? 0);
    const fromSpent = Number(fromRow.spent_amount ?? 0);
    const fromAvailable = roundCurrency(fromAlloc - fromResv - fromSpent);

    if (amount > fromAvailable + 0.005) {
      throw new AppError(
        'INSUFFICIENT_BUDGET_FOR_TRANSFER',
        `Quỹ nguồn ${fromRow.code} chỉ còn khả dụng ${fromAvailable.toLocaleString('vi-VN')} ₫, không đủ để điều chuyển ${amount.toLocaleString('vi-VN')} ₫.`,
        409,
      );
    }

    const toAlloc = Number(toRow.allocated_amount ?? 0);
    const toResv = Number(toRow.reserved_amount ?? 0);
    const toSpent = Number(toRow.spent_amount ?? 0);

    const nextFromAlloc = roundCurrency(fromAlloc - amount);
    const nextToAlloc = roundCurrency(toAlloc + amount);

    await trx
      .updateTable('payment_budgets')
      .set({ allocated_amount: nextFromAlloc, updated_by: auth.userId })
      .where('id', '=', Number(fromRow.id))
      .execute();

    await trx
      .updateTable('payment_budgets')
      .set({ allocated_amount: nextToAlloc, updated_by: auth.userId })
      .where('id', '=', Number(toRow.id))
      .execute();

    await trx
      .insertInto('payment_budget_transactions')
      .values([
        {
          budget_id: Number(fromRow.id),
          tx_type: 'TRANSFER_OUT',
          source_type: 'TRANSFER',
          source_id: Number(toRow.id),
          source_code: toRow.code,
          related_budget_id: Number(toRow.id),
          allocated_delta: -amount,
          reserved_delta: 0,
          spent_delta: 0,
          balance_allocated_after: nextFromAlloc,
          balance_reserved_after: fromResv,
          balance_spent_after: fromSpent,
          balance_available_after: roundCurrency(nextFromAlloc - fromResv - fromSpent),
          note: `Điều chuyển sang ${toRow.code}: ${input.reason.trim()}`,
          actor_user_id: auth.userId,
        },
        {
          budget_id: Number(toRow.id),
          tx_type: 'TRANSFER_IN',
          source_type: 'TRANSFER',
          source_id: Number(fromRow.id),
          source_code: fromRow.code,
          related_budget_id: Number(fromRow.id),
          allocated_delta: amount,
          reserved_delta: 0,
          spent_delta: 0,
          balance_allocated_after: nextToAlloc,
          balance_reserved_after: toResv,
          balance_spent_after: toSpent,
          balance_available_after: roundCurrency(nextToAlloc - toResv - toSpent),
          note: `Nhận điều chuyển từ ${fromRow.code}: ${input.reason.trim()}`,
          actor_user_id: auth.userId,
        },
      ])
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'BUDGET_TRANSFERRED',
    entityType: BUDGET_ENTITY_TYPE,
    entityId: input.fromBudgetId,
    newValues: {
      fromBudgetId: input.fromBudgetId,
      toBudgetId: input.toBudgetId,
      amount,
      reason: input.reason,
    },
    ipAddress,
  });

  const [fromBudget, toBudget] = await Promise.all([
    getBudgetDetail(auth, input.fromBudgetId),
    getBudgetDetail(auth, input.toBudgetId),
  ]);
  return { fromBudget, toBudget };
}

export async function changeBudgetStatus(
  auth: AuthContext,
  budgetId: number,
  input: ChangeBudgetStatusInput,
  ipAddress?: string | null,
): Promise<BudgetDetailView> {
  const db = getDb();
  const row = await db
    .selectFrom('payment_budgets')
    .select(['id', 'code', 'status'])
    .where('id', '=', budgetId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('BUDGET_NOT_FOUND', 'Không tìm thấy quỹ ngân sách.', 404);
  }
  if (!canTransitionBudgetStatus(row.status, input.status)) {
    throw new AppError(
      'INVALID_BUDGET_STATUS_TRANSITION',
      `Không thể chuyển quỹ ngân sách từ trạng thái ${row.status} sang ${input.status}.`,
      409,
    );
  }

  if (input.status === 'CLOSED') {
    const [pendingProp, pendingPay] = await Promise.all([
      db
        .selectFrom('proposals')
        .select((eb) => eb.fn.countAll<number>().as('cnt'))
        .where('budget_id', '=', budgetId)
        .where('deleted_at', 'is', null)
        .where('status', '=', 'PENDING_APPROVAL')
        .executeTakeFirst(),
      db
        .selectFrom('payment_requests')
        .select((eb) => eb.fn.countAll<number>().as('cnt'))
        .where('budget_id', '=', budgetId)
        .where('deleted_at', 'is', null)
        .where('status', '=', 'PENDING_APPROVAL')
        .executeTakeFirst(),
    ]);

    const pendingTotal = Number(pendingProp?.cnt ?? 0) + Number(pendingPay?.cnt ?? 0);
    if (pendingTotal > 0) {
      throw new AppError(
        'BUDGET_HAS_PENDING_ITEMS',
        `Không thể đóng sổ quỹ ${row.code} vì vẫn còn ${pendingTotal} Đề xuất / Phiếu thanh toán đang Chờ phê duyệt.`,
        409,
      );
    }
  }

  await db
    .updateTable('payment_budgets')
    .set({ status: input.status, updated_by: auth.userId })
    .where('id', '=', budgetId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'BUDGET_STATUS_CHANGED',
    entityType: BUDGET_ENTITY_TYPE,
    entityId: budgetId,
    oldValues: { status: row.status },
    newValues: { status: input.status, reason: input.reason ?? null },
    ipAddress,
  });

  return getBudgetDetail(auth, budgetId);
}

export async function deleteBudget(
  auth: AuthContext,
  budgetId: number,
  ipAddress?: string | null,
): Promise<void> {
  const db = getDb();
  const row = await db
    .selectFrom('payment_budgets')
    .select(['id', 'code', 'status'])
    .where('id', '=', budgetId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('BUDGET_NOT_FOUND', 'Không tìm thấy quỹ ngân sách.', 404);
  }
  if (row.status !== 'DRAFT') {
    throw new AppError(
      'BUDGET_DELETE_FORBIDDEN',
      'Chỉ có thể xóa quỹ ngân sách ở trạng thái Nháp (DRAFT) và chưa phát sinh liên kết.',
      409,
    );
  }

  const [propUse, payUse] = await Promise.all([
    db
      .selectFrom('proposals')
      .select((eb) => eb.fn.countAll<number>().as('cnt'))
      .where('budget_id', '=', budgetId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('payment_requests')
      .select((eb) => eb.fn.countAll<number>().as('cnt'))
      .where('budget_id', '=', budgetId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
  ]);

  if (Number(propUse?.cnt ?? 0) + Number(payUse?.cnt ?? 0) > 0) {
    throw new AppError(
      'BUDGET_IN_USE',
      'Không thể xóa quỹ ngân sách đã có Đề xuất hoặc Phiếu thanh toán liên kết.',
      409,
    );
  }

  await db
    .updateTable('payment_budgets')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', budgetId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: 'BUDGET_DELETED',
    entityType: BUDGET_ENTITY_TYPE,
    entityId: budgetId,
    oldValues: { code: row.code },
    ipAddress,
  });
}

const STATUS_LABELS_VI: Record<BudgetStatus, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang hiệu lực',
  FROZEN: 'Tạm khóa',
  CLOSED: 'Đã đóng sổ',
};

const ENFORCEMENT_LABELS_VI: Record<BudgetEnforcementMode, string> = {
  HARD_BLOCK: 'Chặn cứng',
  SOFT_WARN: 'Cảnh báo mềm',
};

const HEALTH_LABELS_VI: Record<BudgetHealthStatus, string> = {
  HEALTHY: 'An toàn',
  WARNING: 'Cảnh báo',
  EXCEEDED: 'Vượt hạn mức',
};

export async function exportBudgetsExcel(
  auth: AuthContext,
  query: ListBudgetsQuery,
): Promise<{ buffer: Buffer; filename: string }> {
  const rows = await fetchBudgetRows(auth, query);

  const exportRows = rows.map((item, idx) => ({
    stt: idx + 1,
    code: item.code,
    name: item.name,
    periodLabel: item.periodLabel,
    dateRange: `${formatDateVN(item.startDate)} – ${formatDateVN(item.endDate)}`,
    scope: [item.branchName, item.departmentName, item.categoryName].filter(Boolean).join(' / ') || 'Toàn công ty',
    ownerName: item.ownerName ?? '—',
    enforcementMode: ENFORCEMENT_LABELS_VI[item.enforcementMode],
    allocatedAmount: item.allocatedAmount,
    reservedAmount: item.reservedAmount,
    spentAmount: item.spentAmount,
    availableAmount: item.availableAmount,
    utilizationPercent: `${item.utilizationPercent}%`,
    health: HEALTH_LABELS_VI[item.health],
    status: STATUS_LABELS_VI[item.status],
    linkedCounts: `${item.linkedProposalCount} ĐX / ${item.linkedPaymentCount} TT`,
    updatedAt: formatDateTimeVN(item.updatedAt),
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      allocated: roundCurrency(acc.allocated + r.allocatedAmount),
      reserved: roundCurrency(acc.reserved + r.reservedAmount),
      spent: roundCurrency(acc.spent + r.spentAmount),
      available: roundCurrency(acc.available + r.availableAmount),
    }),
    { allocated: 0, reserved: 0, spent: 0, available: 0 },
  );

  const buffer = await buildExcelBuffer(
    exportRows,
    [
      { header: 'STT', key: 'stt', width: 6, align: 'center' },
      { header: 'Mã quỹ', key: 'code', width: 20, align: 'center' },
      { header: 'Tên quỹ ngân sách', key: 'name', width: 38 },
      { header: 'Kỳ', key: 'periodLabel', width: 12, align: 'center' },
      { header: 'Thời hạn hiệu lực', key: 'dateRange', width: 24, align: 'center' },
      { header: 'Phạm vi áp dụng', key: 'scope', width: 30 },
      { header: 'Phụ trách', key: 'ownerName', width: 22 },
      { header: 'Kiểm soát', key: 'enforcementMode', width: 16, align: 'center' },
      { header: 'Hạn mức cấp (VNĐ)', key: 'allocatedAmount', width: 20, align: 'right', numFmt: '#,##0' },
      { header: 'Đang giữ chỗ (VNĐ)', key: 'reservedAmount', width: 20, align: 'right', numFmt: '#,##0' },
      { header: 'Đã thực chi (VNĐ)', key: 'spentAmount', width: 20, align: 'right', numFmt: '#,##0' },
      { header: 'Khả dụng còn lại (VNĐ)', key: 'availableAmount', width: 22, align: 'right', numFmt: '#,##0' },
      { header: '% Sử dụng', key: 'utilizationPercent', width: 12, align: 'right' },
      { header: 'Cảnh báo', key: 'health', width: 15, align: 'center' },
      { header: 'Trạng thái', key: 'status', width: 15, align: 'center' },
      { header: 'Hồ sơ gắn quỹ', key: 'linkedCounts', width: 16, align: 'center' },
      { header: 'Cập nhật lúc', key: 'updatedAt', width: 20, align: 'center' },
    ],
    {
      sheetName: 'Ngan_sach',
      title: `BÁO CÁO QUẢN LÝ NGÂN SÁCH — Tổng cấp: ${formatVND(totals.allocated)} | Giữ chỗ: ${formatVND(totals.reserved)} | Thực chi: ${formatVND(totals.spent)} | Khả dụng: ${formatVND(totals.available)}`,
    },
  );

  const dateTag = new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `operon-budgets-${dateTag}.xlsx`,
  };
}
