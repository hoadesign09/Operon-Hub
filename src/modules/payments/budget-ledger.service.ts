import type { Transaction } from 'kysely';
import type {
  BudgetEnforcementMode,
  BudgetStatus,
  BudgetTxType,
  DatabaseSchema,
  PaymentDisbursementDirection,
  PaymentType,
} from '@/config/database';
import {
  computeBudgetSnapshot,
  computeDisbursementBudgetMutation,
  computePaymentReserveRequirement,
  computeProposalTransferReserve,
  evaluateBudgetImpact,
} from '@/lib/portable/budget-calculator';
import { roundCurrency } from '@/lib/portable/currency-utils';
import { createNotification } from '@/modules/notifications/notifications.service';
import { PAYMENT_MODULE_CODE } from '@/modules/payments/payments.constants';
import { AppError } from '@/shared/api-response';

export interface BudgetAlertInfo {
  budgetId: number;
  budgetCode: string;
  budgetName: string;
  ownerUserId: number | null;
  utilizationPercent: number;
  warningThresholdPercent: number;
  isOverBudget: boolean;
  sourceCode: string;
  sourceType: 'PROPOSAL' | 'PAYMENT';
}

export interface ReserveProposalResult {
  reservedAmount: number;
  isOverBudget: boolean;
  alert: BudgetAlertInfo | null;
}

export interface ReservePaymentResult {
  reservedAmount: number;
  fromProposalReserve: number;
  extraReserveNeeded: number;
  isOverBudget: boolean;
  alert: BudgetAlertInfo | null;
}

interface LockedBudgetRow {
  id: number;
  code: string;
  name: string;
  branchId: number | null;
  ownerUserId: number | null;
  allocatedAmount: number;
  reservedAmount: number;
  spentAmount: number;
  warningThresholdPercent: number;
  enforcementMode: BudgetEnforcementMode;
  status: BudgetStatus;
}

async function lockBudgetRow(
  trx: Transaction<DatabaseSchema>,
  budgetId: number,
): Promise<LockedBudgetRow> {
  const row = await trx
    .selectFrom('payment_budgets')
    .select([
      'id',
      'code',
      'name',
      'branch_id',
      'owner_user_id',
      'allocated_amount',
      'reserved_amount',
      'spent_amount',
      'warning_threshold_percent',
      'enforcement_mode',
      'status',
    ])
    .where('id', '=', budgetId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!row) {
    throw new AppError('BUDGET_NOT_FOUND', 'Không tìm thấy quỹ ngân sách được chọn.', 404);
  }

  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    ownerUserId: row.owner_user_id !== null ? Number(row.owner_user_id) : null,
    allocatedAmount: Number(row.allocated_amount ?? 0),
    reservedAmount: Number(row.reserved_amount ?? 0),
    spentAmount: Number(row.spent_amount ?? 0),
    warningThresholdPercent: Number(row.warning_threshold_percent ?? 80),
    enforcementMode: row.enforcement_mode,
    status: row.status,
  };
}

function assertBudgetBranchCompatibility(
  budget: LockedBudgetRow,
  targetBranchId: number | null | undefined,
): void {
  if (budget.branchId !== null && targetBranchId && budget.branchId !== targetBranchId) {
    throw new AppError(
      'BUDGET_BRANCH_MISMATCH',
      `Quỹ ngân sách ${budget.code} chỉ áp dụng cho chi nhánh khác. Vui lòng chọn quỹ ngân sách phù hợp chi nhánh.`,
      409,
    );
  }
}

async function insertLedgerTx(
  trx: Transaction<DatabaseSchema>,
  params: {
    budgetId: number;
    txType: BudgetTxType;
    sourceType: 'MANUAL' | 'TRANSFER' | 'PROPOSAL' | 'PAYMENT' | 'DISBURSEMENT';
    sourceId: number | null;
    sourceCode: string | null;
    relatedBudgetId?: number | null;
    allocatedDelta: number;
    reservedDelta: number;
    spentDelta: number;
    nextAllocated: number;
    nextReserved: number;
    nextSpent: number;
    note: string | null;
    actorUserId: number | null;
  },
): Promise<void> {
  const nextAvailable = roundCurrency(params.nextAllocated - params.nextReserved - params.nextSpent);
  await trx
    .insertInto('payment_budget_transactions')
    .values({
      budget_id: params.budgetId,
      tx_type: params.txType,
      source_type: params.sourceType,
      source_id: params.sourceId,
      source_code: params.sourceCode,
      related_budget_id: params.relatedBudgetId ?? null,
      allocated_delta: roundCurrency(params.allocatedDelta),
      reserved_delta: roundCurrency(params.reservedDelta),
      spent_delta: roundCurrency(params.spentDelta),
      balance_allocated_after: roundCurrency(params.nextAllocated),
      balance_reserved_after: roundCurrency(params.nextReserved),
      balance_spent_after: roundCurrency(params.nextSpent),
      balance_available_after: nextAvailable,
      note: params.note,
      actor_user_id: params.actorUserId,
    })
    .execute();
}

/**
 * Reserves budget for an Internal Proposal upon submission (DRAFT/NEEDS_REVISION -> PENDING_APPROVAL).
 */
export async function reserveBudgetForProposal(
  trx: Transaction<DatabaseSchema>,
  params: {
    budgetId: number;
    proposalId: number;
    proposalCode: string;
    amount: number;
    branchId: number | null;
    actorUserId: number;
  },
): Promise<ReserveProposalResult> {
  const amount = roundCurrency(Math.max(0, params.amount));
  if (amount <= 0) {
    return { reservedAmount: 0, isOverBudget: false, alert: null };
  }

  const budget = await lockBudgetRow(trx, params.budgetId);
  if (budget.status !== 'ACTIVE') {
    throw new AppError(
      'BUDGET_NOT_ACTIVE',
      `Quỹ ngân sách ${budget.code} đang ở trạng thái ${budget.status} nên không thể giữ chỗ chi tiêu mới.`,
      409,
    );
  }
  assertBudgetBranchCompatibility(budget, params.branchId);

  const snapshot = computeBudgetSnapshot({
    allocatedAmount: budget.allocatedAmount,
    reservedAmount: budget.reservedAmount,
    spentAmount: budget.spentAmount,
    warningThresholdPercent: budget.warningThresholdPercent,
  });
  const impact = evaluateBudgetImpact(snapshot, amount, budget.enforcementMode);

  if (!impact.allowed) {
    throw new AppError(
      'BUDGET_EXCEEDED',
      `Vượt hạn mức quỹ ngân sách ${budget.code} (${budget.name}). Số dư khả dụng: ${snapshot.availableAmount.toLocaleString('vi-VN')} ₫ — Cần giữ chỗ: ${amount.toLocaleString('vi-VN')} ₫ (thiếu ${impact.shortfallAmount.toLocaleString('vi-VN')} ₫).`,
      409,
    );
  }

  const nextReserved = roundCurrency(budget.reservedAmount + amount);
  await trx
    .updateTable('payment_budgets')
    .set({ reserved_amount: nextReserved, updated_by: params.actorUserId })
    .where('id', '=', budget.id)
    .execute();

  await trx
    .updateTable('proposals')
    .set({
      budget_reserved_amount: amount,
      is_over_budget: impact.isOverBudget ? 1 : 0,
      updated_by: params.actorUserId,
    })
    .where('id', '=', params.proposalId)
    .execute();

  await insertLedgerTx(trx, {
    budgetId: budget.id,
    txType: 'RESERVE',
    sourceType: 'PROPOSAL',
    sourceId: params.proposalId,
    sourceCode: params.proposalCode,
    allocatedDelta: 0,
    reservedDelta: amount,
    spentDelta: 0,
    nextAllocated: budget.allocatedAmount,
    nextReserved,
    nextSpent: budget.spentAmount,
    note: impact.isOverBudget
      ? `Giữ chỗ ngân sách cho Đề xuất ${params.proposalCode} (cảnh báo vượt hạn mức)`
      : `Giữ chỗ ngân sách khi gửi duyệt Đề xuất ${params.proposalCode}`,
    actorUserId: params.actorUserId,
  });

  const alert: BudgetAlertInfo | null =
    impact.projectedHealth !== 'HEALTHY'
      ? {
          budgetId: budget.id,
          budgetCode: budget.code,
          budgetName: budget.name,
          ownerUserId: budget.ownerUserId,
          utilizationPercent: impact.projectedUtilizationPercent,
          warningThresholdPercent: budget.warningThresholdPercent,
          isOverBudget: impact.isOverBudget,
          sourceCode: params.proposalCode,
          sourceType: 'PROPOSAL',
        }
      : null;

  return { reservedAmount: amount, isOverBudget: impact.isOverBudget, alert };
}

/**
 * Releases all or excess reserved budget held by a Proposal (on revision, reject, cancel, budget trim, or completion).
 */
export async function releaseProposalBudgetReserve(
  trx: Transaction<DatabaseSchema>,
  params: {
    proposalId: number;
    proposalCode: string;
    actorUserId: number;
    reason: string;
    /** If set, trims proposal reserve down to this target; otherwise releases 100% of remaining reserve. */
    targetRemainingReserve?: number;
  },
): Promise<number> {
  const prop = await trx
    .selectFrom('proposals')
    .select(['id', 'budget_id', 'budget_reserved_amount'])
    .where('id', '=', params.proposalId)
    .forUpdate()
    .executeTakeFirst();

  if (!prop || !prop.budget_id) {
    return 0;
  }

  const currentReserved = roundCurrency(Number(prop.budget_reserved_amount ?? 0));
  if (currentReserved <= 0.005) {
    return 0;
  }

  const target =
    params.targetRemainingReserve !== undefined
      ? Math.max(0, roundCurrency(params.targetRemainingReserve))
      : 0;
  const releaseAmount = roundCurrency(Math.max(0, currentReserved - target));
  if (releaseAmount <= 0.005) {
    return 0;
  }

  const budget = await lockBudgetRow(trx, Number(prop.budget_id));
  const nextBudgetReserved = roundCurrency(Math.max(0, budget.reservedAmount - releaseAmount));
  const nextProposalReserved = roundCurrency(Math.max(0, currentReserved - releaseAmount));

  await trx
    .updateTable('payment_budgets')
    .set({ reserved_amount: nextBudgetReserved, updated_by: params.actorUserId })
    .where('id', '=', budget.id)
    .execute();

  await trx
    .updateTable('proposals')
    .set({
      budget_reserved_amount: nextProposalReserved,
      ...(nextProposalReserved <= 0.005 ? { is_over_budget: 0 } : {}),
      updated_by: params.actorUserId,
    })
    .where('id', '=', params.proposalId)
    .execute();

  await insertLedgerTx(trx, {
    budgetId: budget.id,
    txType: 'RELEASE',
    sourceType: 'PROPOSAL',
    sourceId: params.proposalId,
    sourceCode: params.proposalCode,
    allocatedDelta: 0,
    reservedDelta: -releaseAmount,
    spentDelta: 0,
    nextAllocated: budget.allocatedAmount,
    nextReserved: nextBudgetReserved,
    nextSpent: budget.spentAmount,
    note: params.reason,
    actorUserId: params.actorUserId,
  });

  return releaseAmount;
}

/**
 * Reserves budget for a Payment Request upon submission.
 * Prevents double-counting by transferring held reserve from a linked Proposal when applicable,
 * and computes net top-up reserve for Advance Settlements.
 */
export async function reserveBudgetForPayment(
  trx: Transaction<DatabaseSchema>,
  params: {
    budgetId: number;
    paymentId: number;
    paymentCode: string;
    paymentType: PaymentType;
    totalAmount: number;
    netSettlementAmount: number;
    proposalId: number | null;
    branchId: number | null;
    actorUserId: number;
  },
): Promise<ReservePaymentResult> {
  const requiredReserve = computePaymentReserveRequirement(
    params.paymentType,
    params.totalAmount,
    params.netSettlementAmount,
  );
  if (requiredReserve <= 0.005) {
    return {
      reservedAmount: 0,
      fromProposalReserve: 0,
      extraReserveNeeded: 0,
      isOverBudget: false,
      alert: null,
    };
  }

  let proposalRow: {
    id: number;
    proposal_code: string;
    budget_id: number | null;
    budget_reserved_amount: number | string;
  } | undefined;

  if (params.proposalId) {
    proposalRow = await trx
      .selectFrom('proposals')
      .select(['id', 'proposal_code', 'budget_id', 'budget_reserved_amount'])
      .where('id', '=', params.proposalId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();
  }

  const budget = await lockBudgetRow(trx, params.budgetId);
  assertBudgetBranchCompatibility(budget, params.branchId);

  const proposalHeldSameBudget =
    proposalRow && Number(proposalRow.budget_id) === budget.id
      ? roundCurrency(Number(proposalRow.budget_reserved_amount ?? 0))
      : 0;

  const split = computeProposalTransferReserve(requiredReserve, proposalHeldSameBudget);

  if (split.extraReserveNeeded > 0.005 && budget.status !== 'ACTIVE') {
    throw new AppError(
      'BUDGET_NOT_ACTIVE',
      `Quỹ ngân sách ${budget.code} đang ở trạng thái ${budget.status} nên không thể giữ chỗ thêm ngân sách mới.`,
      409,
    );
  }

  const snapshot = computeBudgetSnapshot({
    allocatedAmount: budget.allocatedAmount,
    reservedAmount: budget.reservedAmount,
    spentAmount: budget.spentAmount,
    warningThresholdPercent: budget.warningThresholdPercent,
  });

  const impact = evaluateBudgetImpact(snapshot, split.extraReserveNeeded, budget.enforcementMode);
  if (!impact.allowed) {
    throw new AppError(
      'BUDGET_EXCEEDED',
      `Vượt hạn mức quỹ ngân sách ${budget.code} (${budget.name}). Số dư khả dụng: ${snapshot.availableAmount.toLocaleString('vi-VN')} ₫ — Cần giữ thêm: ${split.extraReserveNeeded.toLocaleString('vi-VN')} ₫ (thiếu ${impact.shortfallAmount.toLocaleString('vi-VN')} ₫).`,
      409,
    );
  }

  if (proposalRow && split.fromProposalReserve > 0.005) {
    const nextPropReserved = roundCurrency(
      Math.max(0, proposalHeldSameBudget - split.fromProposalReserve),
    );
    await trx
      .updateTable('proposals')
      .set({
        budget_reserved_amount: nextPropReserved,
        updated_by: params.actorUserId,
      })
      .where('id', '=', Number(proposalRow.id))
      .execute();
  }

  const nextBudgetReserved = roundCurrency(budget.reservedAmount + split.extraReserveNeeded);
  if (split.extraReserveNeeded > 0.005) {
    await trx
      .updateTable('payment_budgets')
      .set({ reserved_amount: nextBudgetReserved, updated_by: params.actorUserId })
      .where('id', '=', budget.id)
      .execute();
  }

  await trx
    .updateTable('payment_requests')
    .set({
      budget_reserved_amount: requiredReserve,
      proposal_reserve_used: split.fromProposalReserve,
      is_over_budget: impact.isOverBudget ? 1 : 0,
      updated_by: params.actorUserId,
    })
    .where('id', '=', params.paymentId)
    .execute();

  const noteParts: string[] = [];
  if (split.fromProposalReserve > 0.005 && proposalRow) {
    noteParts.push(
      `Kế thừa ${split.fromProposalReserve.toLocaleString('vi-VN')} ₫ giữ chỗ từ Đề xuất ${proposalRow.proposal_code} (không trừ trùng)`,
    );
  }
  if (split.extraReserveNeeded > 0.005) {
    noteParts.push(
      `Giữ chỗ thêm ${split.extraReserveNeeded.toLocaleString('vi-VN')} ₫ cho Phiếu ${params.paymentCode}`,
    );
  }

  await insertLedgerTx(trx, {
    budgetId: budget.id,
    txType: 'RESERVE',
    sourceType: 'PAYMENT',
    sourceId: params.paymentId,
    sourceCode: params.paymentCode,
    allocatedDelta: 0,
    reservedDelta: split.extraReserveNeeded,
    spentDelta: 0,
    nextAllocated: budget.allocatedAmount,
    nextReserved: nextBudgetReserved,
    nextSpent: budget.spentAmount,
    note: noteParts.join(' • ') || `Giữ chỗ ngân sách cho Phiếu ${params.paymentCode}`,
    actorUserId: params.actorUserId,
  });

  const alert: BudgetAlertInfo | null =
    split.extraReserveNeeded > 0.005 && impact.projectedHealth !== 'HEALTHY'
      ? {
          budgetId: budget.id,
          budgetCode: budget.code,
          budgetName: budget.name,
          ownerUserId: budget.ownerUserId,
          utilizationPercent: impact.projectedUtilizationPercent,
          warningThresholdPercent: budget.warningThresholdPercent,
          isOverBudget: impact.isOverBudget,
          sourceCode: params.paymentCode,
          sourceType: 'PAYMENT',
        }
      : null;

  return {
    reservedAmount: requiredReserve,
    fromProposalReserve: split.fromProposalReserve,
    extraReserveNeeded: split.extraReserveNeeded,
    isOverBudget: impact.isOverBudget,
    alert,
  };
}

/**
 * Releases reserved budget held by a Payment Request (on revision request, reject, or cancel).
 * Restores proposal_reserve_used back to the linked Proposal if it is still APPROVED/IN_EXECUTION.
 */
export async function releasePaymentBudgetReserve(
  trx: Transaction<DatabaseSchema>,
  params: {
    paymentId: number;
    paymentCode: string;
    actorUserId: number;
    reason: string;
  },
): Promise<number> {
  const payment = await trx
    .selectFrom('payment_requests')
    .select([
      'id',
      'budget_id',
      'proposal_id',
      'budget_reserved_amount',
      'proposal_reserve_used',
    ])
    .where('id', '=', params.paymentId)
    .forUpdate()
    .executeTakeFirst();

  if (!payment || !payment.budget_id) {
    return 0;
  }

  const currentReserved = roundCurrency(Number(payment.budget_reserved_amount ?? 0));
  if (currentReserved <= 0.005) {
    return 0;
  }

  const proposalReserveUsed = roundCurrency(Number(payment.proposal_reserve_used ?? 0));
  let restoredToProposal = 0;
  let linkedProposalCode: string | null = null;

  if (payment.proposal_id && proposalReserveUsed > 0.005) {
    const prop = await trx
      .selectFrom('proposals')
      .select(['id', 'proposal_code', 'status', 'budget_id', 'budget_reserved_amount'])
      .where('id', '=', Number(payment.proposal_id))
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (
      prop &&
      Number(prop.budget_id) === Number(payment.budget_id) &&
      (prop.status === 'APPROVED' || prop.status === 'IN_EXECUTION')
    ) {
      restoredToProposal = roundCurrency(Math.min(proposalReserveUsed, currentReserved));
      linkedProposalCode = prop.proposal_code;
      const nextPropReserved = roundCurrency(
        Number(prop.budget_reserved_amount ?? 0) + restoredToProposal,
      );
      await trx
        .updateTable('proposals')
        .set({ budget_reserved_amount: nextPropReserved, updated_by: params.actorUserId })
        .where('id', '=', Number(prop.id))
        .execute();
    }
  }

  const releaseToBudget = roundCurrency(Math.max(0, currentReserved - restoredToProposal));
  const budget = await lockBudgetRow(trx, Number(payment.budget_id));
  const nextBudgetReserved = roundCurrency(Math.max(0, budget.reservedAmount - releaseToBudget));

  if (releaseToBudget > 0.005) {
    await trx
      .updateTable('payment_budgets')
      .set({ reserved_amount: nextBudgetReserved, updated_by: params.actorUserId })
      .where('id', '=', budget.id)
      .execute();
  }

  await trx
    .updateTable('payment_requests')
    .set({
      budget_reserved_amount: 0,
      proposal_reserve_used: 0,
      is_over_budget: 0,
      updated_by: params.actorUserId,
    })
    .where('id', '=', params.paymentId)
    .execute();

  const note =
    restoredToProposal > 0.005 && linkedProposalCode
      ? `${params.reason} (Hoàn ${restoredToProposal.toLocaleString('vi-VN')} ₫ về giữ chỗ Đề xuất ${linkedProposalCode}; giải phóng ${releaseToBudget.toLocaleString('vi-VN')} ₫ về Quỹ)`
      : params.reason;

  await insertLedgerTx(trx, {
    budgetId: budget.id,
    txType: 'RELEASE',
    sourceType: 'PAYMENT',
    sourceId: params.paymentId,
    sourceCode: params.paymentCode,
    allocatedDelta: 0,
    reservedDelta: -releaseToBudget,
    spentDelta: 0,
    nextAllocated: budget.allocatedAmount,
    nextReserved: nextBudgetReserved,
    nextSpent: budget.spentAmount,
    note,
    actorUserId: params.actorUserId,
  });

  return currentReserved;
}

/**
 * Applies a payment disbursement (OUTGOING -> CONSUME) or advance refund (INCOMING_REFUND -> REFUND)
 * to the linked budget fund inside the disbursement transaction.
 */
export async function applyDisbursementToBudget(
  trx: Transaction<DatabaseSchema>,
  params: {
    budgetId: number;
    paymentId: number;
    paymentCode: string;
    direction: PaymentDisbursementDirection;
    amount: number;
    currentPaymentReserved: number;
    currentPaymentSpent: number;
    actorUserId: number;
    bankRef?: string | null;
  },
): Promise<void> {
  const mutation = computeDisbursementBudgetMutation(
    params.direction,
    params.amount,
    params.currentPaymentReserved,
  );
  if (mutation.reservedDelta === 0 && mutation.spentDelta === 0) {
    return;
  }

  const budget = await lockBudgetRow(trx, params.budgetId);
  const nextBudgetReserved = roundCurrency(Math.max(0, budget.reservedAmount + mutation.reservedDelta));
  const nextBudgetSpent = roundCurrency(Math.max(0, budget.spentAmount + mutation.spentDelta));
  const nextPayReserved = roundCurrency(
    Math.max(0, params.currentPaymentReserved + mutation.paymentReservedDelta),
  );
  const nextPaySpent = roundCurrency(
    Math.max(0, params.currentPaymentSpent + mutation.paymentSpentDelta),
  );

  await trx
    .updateTable('payment_budgets')
    .set({
      reserved_amount: nextBudgetReserved,
      spent_amount: nextBudgetSpent,
      updated_by: params.actorUserId,
    })
    .where('id', '=', budget.id)
    .execute();

  await trx
    .updateTable('payment_requests')
    .set({
      budget_reserved_amount: nextPayReserved,
      budget_spent_amount: nextPaySpent,
      updated_by: params.actorUserId,
    })
    .where('id', '=', params.paymentId)
    .execute();

  const refSuffix = params.bankRef ? ` (Mã GD: ${params.bankRef})` : '';
  const txType: BudgetTxType = params.direction === 'INCOMING_REFUND' ? 'REFUND' : 'CONSUME';
  const note =
    params.direction === 'INCOMING_REFUND'
      ? `Thu hồi hoàn quỹ tạm ứng từ ${params.paymentCode}${refSuffix}`
      : `Giải ngân thực chi cho ${params.paymentCode}${refSuffix}`;

  await insertLedgerTx(trx, {
    budgetId: budget.id,
    txType,
    sourceType: 'DISBURSEMENT',
    sourceId: params.paymentId,
    sourceCode: params.paymentCode,
    allocatedDelta: 0,
    reservedDelta: mutation.reservedDelta,
    spentDelta: mutation.spentDelta,
    nextAllocated: budget.allocatedAmount,
    nextReserved: nextBudgetReserved,
    nextSpent: nextBudgetSpent,
    note,
    actorUserId: params.actorUserId,
  });
}

/**
 * Sends a non-blocking notification to the budget fund owner when warning or overrun occurs.
 */
export async function notifyBudgetAlertIfNeeded(
  alert: BudgetAlertInfo | null,
  actorUserId: number,
): Promise<void> {
  if (!alert || !alert.ownerUserId || alert.ownerUserId === actorUserId) {
    return;
  }

  const sourceLabel = alert.sourceType === 'PROPOSAL' ? 'Đề xuất' : 'Phiếu thanh toán';
  const title = alert.isOverBudget
    ? `Cảnh báo vượt hạn mức ngân sách [${alert.budgetCode}]`
    : `Ngân sách chạm ngưỡng cảnh báo [${alert.budgetCode}]`;
  const message = alert.isOverBudget
    ? `${sourceLabel} ${alert.sourceCode} khiến quỹ "${alert.budgetName}" đạt ${alert.utilizationPercent}% (vượt hạn mức ngân sách).`
    : `${sourceLabel} ${alert.sourceCode} khiến quỹ "${alert.budgetName}" đạt ${alert.utilizationPercent}% (ngưỡng cảnh báo ${alert.warningThresholdPercent}%).`;

  await createNotification({
    userId: alert.ownerUserId,
    moduleCode: PAYMENT_MODULE_CODE,
    type: alert.isOverBudget ? 'BUDGET_EXCEEDED' : 'BUDGET_WARNING',
    title,
    message,
    linkUrl: `/services/payments/budgets/${alert.budgetId}`,
  }).catch(() => undefined);
}
