/**
 * Pure financial calculation & encumbrance accounting engine for multi-period budget funds.
 *
 * Dependencies: None
 * Input/Output: Plain numeric & string DTOs (currency rounded to 2 decimal places)
 *
 * Example:
 * ```ts
 * const snap = computeBudgetSnapshot({
 *   allocatedAmount: 100_000_000,
 *   reservedAmount: 25_000_000,
 *   spentAmount: 60_000_000,
 *   warningThresholdPercent: 80,
 * });
 * // => { availableAmount: 15_000_000, utilizationPercent: 85, health: 'WARNING', ... }
 * ```
 */

export type BudgetHealthStatus = 'HEALTHY' | 'WARNING' | 'EXCEEDED';
export type BudgetEnforcementMode = 'HARD_BLOCK' | 'SOFT_WARN';
export type BudgetLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type BudgetDisbursementDirection = 'OUTGOING' | 'INCOMING_REFUND';

export interface BudgetSnapshotInput {
  allocatedAmount: number;
  reservedAmount: number;
  spentAmount: number;
  warningThresholdPercent?: number;
}

export interface BudgetSnapshot {
  allocatedAmount: number;
  reservedAmount: number;
  spentAmount: number;
  committedTotal: number;
  availableAmount: number;
  utilizationPercent: number;
  spentPercent: number;
  reservedPercent: number;
  warningThresholdPercent: number;
  health: BudgetHealthStatus;
}

export interface BudgetImpactEvaluation {
  allowed: boolean;
  isOverBudget: boolean;
  shortfallAmount: number;
  projectedAvailable: number;
  projectedUtilizationPercent: number;
  projectedHealth: BudgetHealthStatus;
}

export interface ProposalTransferReserveResult {
  fromProposalReserve: number;
  extraReserveNeeded: number;
}

export interface DisbursementBudgetMutation {
  reservedDelta: number;
  spentDelta: number;
  paymentReservedDelta: number;
  paymentSpentDelta: number;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Computes real-time budget balances, utilization percentages, and health indicator.
 */
export function computeBudgetSnapshot(input: BudgetSnapshotInput): BudgetSnapshot {
  const allocatedAmount = Math.max(0, roundMoney(input.allocatedAmount));
  const reservedAmount = Math.max(0, roundMoney(input.reservedAmount));
  const spentAmount = Math.max(0, roundMoney(input.spentAmount));
  const warningThresholdPercent = Math.min(
    100,
    Math.max(1, roundPercent(input.warningThresholdPercent ?? 80)),
  );

  const committedTotal = roundMoney(reservedAmount + spentAmount);
  const availableAmount = roundMoney(allocatedAmount - committedTotal);

  const utilizationPercent =
    allocatedAmount > 0
      ? roundPercent((committedTotal / allocatedAmount) * 100)
      : committedTotal > 0
        ? 100
        : 0;
  const spentPercent =
    allocatedAmount > 0 ? roundPercent((spentAmount / allocatedAmount) * 100) : 0;
  const reservedPercent =
    allocatedAmount > 0 ? roundPercent((reservedAmount / allocatedAmount) * 100) : 0;

  let health: BudgetHealthStatus = 'HEALTHY';
  if (availableAmount < -0.005 || utilizationPercent > 100) {
    health = 'EXCEEDED';
  } else if (utilizationPercent >= warningThresholdPercent) {
    health = 'WARNING';
  }

  return {
    allocatedAmount,
    reservedAmount,
    spentAmount,
    committedTotal,
    availableAmount,
    utilizationPercent,
    spentPercent,
    reservedPercent,
    warningThresholdPercent,
    health,
  };
}

/**
 * Evaluates whether a new reservation delta is allowed under HARD_BLOCK or SOFT_WARN policy.
 */
export function evaluateBudgetImpact(
  snapshot: BudgetSnapshot,
  requestedDelta: number,
  enforcementMode: BudgetEnforcementMode,
): BudgetImpactEvaluation {
  const delta = Math.max(0, roundMoney(requestedDelta));
  const projected = computeBudgetSnapshot({
    allocatedAmount: snapshot.allocatedAmount,
    reservedAmount: roundMoney(snapshot.reservedAmount + delta),
    spentAmount: snapshot.spentAmount,
    warningThresholdPercent: snapshot.warningThresholdPercent,
  });

  const shortfallAmount =
    projected.availableAmount < -0.005 ? roundMoney(Math.abs(projected.availableAmount)) : 0;
  const isOverBudget = shortfallAmount > 0;
  const allowed = delta <= 0 || !isOverBudget || enforcementMode === 'SOFT_WARN';

  return {
    allowed,
    isOverBudget,
    shortfallAmount,
    projectedAvailable: projected.availableAmount,
    projectedUtilizationPercent: projected.utilizationPercent,
    projectedHealth: projected.health,
  };
}

/**
 * Splits a payment's required reservation between an already-reserved Proposal balance
 * and any extra reservation required from the budget fund (prevents double-counting).
 */
export function computeProposalTransferReserve(
  requiredPaymentReserve: number,
  proposalRemainingReserve: number,
): ProposalTransferReserveResult {
  const required = Math.max(0, roundMoney(requiredPaymentReserve));
  const proposalAvailable = Math.max(0, roundMoney(proposalRemainingReserve));
  const fromProposalReserve = roundMoney(Math.min(required, proposalAvailable));
  const extraReserveNeeded = roundMoney(Math.max(0, required - fromProposalReserve));

  return {
    fromProposalReserve,
    extraReserveNeeded,
  };
}

/**
 * Determines how much new reservation a payment request needs on submission.
 * Advance settlements only reserve the positive net top-up; balanced or refund cases need 0.
 */
export function computePaymentReserveRequirement(
  paymentType: string,
  totalAmount: number,
  netSettlementAmount: number,
): number {
  if (paymentType === 'ADVANCE_SETTLEMENT') {
    return netSettlementAmount > 0.005 ? roundMoney(netSettlementAmount) : 0;
  }
  return Math.max(0, roundMoney(totalAmount));
}

/**
 * Computes budget & payment reserve/spent deltas when a disbursement or refund is recorded.
 */
export function computeDisbursementBudgetMutation(
  direction: BudgetDisbursementDirection,
  disbursementAmount: number,
  currentPaymentReserved: number,
): DisbursementBudgetMutation {
  const amount = Math.max(0, roundMoney(disbursementAmount));
  if (amount <= 0) {
    return {
      reservedDelta: 0,
      spentDelta: 0,
      paymentReservedDelta: 0,
      paymentSpentDelta: 0,
    };
  }

  if (direction === 'INCOMING_REFUND') {
    return {
      reservedDelta: 0,
      spentDelta: -amount,
      paymentReservedDelta: 0,
      paymentSpentDelta: -amount,
    };
  }

  const releaseFromReserve = roundMoney(Math.min(Math.max(0, currentPaymentReserved), amount));
  return {
    reservedDelta: -releaseFromReserve,
    spentDelta: amount,
    paymentReservedDelta: -releaseFromReserve,
    paymentSpentDelta: amount,
  };
}

const ALLOWED_BUDGET_TRANSITIONS: Record<BudgetLifecycleStatus, readonly BudgetLifecycleStatus[]> = {
  DRAFT: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['FROZEN', 'CLOSED'],
  FROZEN: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

/**
 * Checks whether a budget status transition is permitted.
 */
export function canTransitionBudgetStatus(
  current: BudgetLifecycleStatus,
  next: BudgetLifecycleStatus,
): boolean {
  return ALLOWED_BUDGET_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * Formats a canonical budget code, e.g. BUD-2026-TECH-001.
 */
export function formatBudgetCode(fiscalYear: number, scopeCode: string, sequence: number): string {
  const cleanYear = String(Math.max(2000, Math.floor(fiscalYear))).padStart(4, '0');
  const cleanScope =
    scopeCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8) || 'GEN';
  const cleanSeq = String(Math.max(1, Math.floor(sequence))).padStart(3, '0');
  return `BUD-${cleanYear}-${cleanScope}-${cleanSeq}`;
}
