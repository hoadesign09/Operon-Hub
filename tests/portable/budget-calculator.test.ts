import { describe, expect, it } from 'vitest';
import {
  canTransitionBudgetStatus,
  computeBudgetSnapshot,
  computeDisbursementBudgetMutation,
  computePaymentReserveRequirement,
  computeProposalTransferReserve,
  evaluateBudgetImpact,
  formatBudgetCode,
} from '@/lib/portable/budget-calculator';

describe('portable/budget-calculator', () => {
  it('computes snapshot balances, utilization percentages and health thresholds accurately', () => {
    const healthy = computeBudgetSnapshot({
      allocatedAmount: 100_000_000,
      reservedAmount: 20_000_000,
      spentAmount: 30_000_000,
      warningThresholdPercent: 80,
    });
    expect(healthy.committedTotal).toBe(50_000_000);
    expect(healthy.availableAmount).toBe(50_000_000);
    expect(healthy.utilizationPercent).toBe(50);
    expect(healthy.health).toBe('HEALTHY');

    const warning = computeBudgetSnapshot({
      allocatedAmount: 100_000_000,
      reservedAmount: 25_000_000,
      spentAmount: 60_000_000,
      warningThresholdPercent: 80,
    });
    expect(warning.availableAmount).toBe(15_000_000);
    expect(warning.utilizationPercent).toBe(85);
    expect(warning.health).toBe('WARNING');

    const exceeded = computeBudgetSnapshot({
      allocatedAmount: 100_000_000,
      reservedAmount: 40_000_000,
      spentAmount: 70_000_000,
      warningThresholdPercent: 80,
    });
    expect(exceeded.availableAmount).toBe(-10_000_000);
    expect(exceeded.utilizationPercent).toBe(110);
    expect(exceeded.health).toBe('EXCEEDED');
  });

  it('enforces HARD_BLOCK and SOFT_WARN correctly on budget impact evaluation', () => {
    const snap = computeBudgetSnapshot({
      allocatedAmount: 50_000_000,
      reservedAmount: 10_000_000,
      spentAmount: 35_000_000,
      warningThresholdPercent: 80,
    }); // available = 5M

    const blocked = evaluateBudgetImpact(snap, 8_000_000, 'HARD_BLOCK');
    expect(blocked.allowed).toBe(false);
    expect(blocked.isOverBudget).toBe(true);
    expect(blocked.shortfallAmount).toBe(3_000_000);
    expect(blocked.projectedAvailable).toBe(-3_000_000);
    expect(blocked.projectedHealth).toBe('EXCEEDED');

    const softAllowed = evaluateBudgetImpact(snap, 8_000_000, 'SOFT_WARN');
    expect(softAllowed.allowed).toBe(true);
    expect(softAllowed.isOverBudget).toBe(true);
    expect(softAllowed.shortfallAmount).toBe(3_000_000);

    const zeroDelta = evaluateBudgetImpact(snap, 0, 'HARD_BLOCK');
    expect(zeroDelta.allowed).toBe(true);
    expect(zeroDelta.isOverBudget).toBe(false);
  });

  it('prevents double-counting when transferring reserve from Proposal to Payment', () => {
    // Proposal reserved 30M; Payment requests 20M => 20M transferred, 0 extra needed
    const within = computeProposalTransferReserve(20_000_000, 30_000_000);
    expect(within.fromProposalReserve).toBe(20_000_000);
    expect(within.extraReserveNeeded).toBe(0);

    // Proposal reserved 30M; Payment requests 35M => 30M transferred, 5M extra needed
    const over = computeProposalTransferReserve(35_000_000, 30_000_000);
    expect(over.fromProposalReserve).toBe(30_000_000);
    expect(over.extraReserveNeeded).toBe(5_000_000);
  });

  it('computes payment reserve requirement & disbursement/refund mutations properly', () => {
    expect(computePaymentReserveRequirement('VENDOR_PAYMENT', 12_000_000, 0)).toBe(12_000_000);
    expect(computePaymentReserveRequirement('ADVANCE_SETTLEMENT', 12_000_000, 2_000_000)).toBe(
      2_000_000,
    );
    expect(computePaymentReserveRequirement('ADVANCE_SETTLEMENT', 7_000_000, -3_000_000)).toBe(0);
    expect(computePaymentReserveRequirement('ADVANCE_SETTLEMENT', 10_000_000, 0)).toBe(0);

    // Partial outgoing disbursement: 10M disbursed from 22M reserved
    const partialOut = computeDisbursementBudgetMutation('OUTGOING', 10_000_000, 22_000_000);
    expect(partialOut).toEqual({
      reservedDelta: -10_000_000,
      spentDelta: 10_000_000,
      paymentReservedDelta: -10_000_000,
      paymentSpentDelta: 10_000_000,
    });

    // Incoming refund from advance settlement returns money to budget (reduces spent)
    const refund = computeDisbursementBudgetMutation('INCOMING_REFUND', 3_000_000, 0);
    expect(refund).toEqual({
      reservedDelta: 0,
      spentDelta: -3_000_000,
      paymentReservedDelta: 0,
      paymentSpentDelta: -3_000_000,
    });
  });

  it('validates lifecycle status transitions and formats budget codes', () => {
    expect(canTransitionBudgetStatus('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionBudgetStatus('ACTIVE', 'FROZEN')).toBe(true);
    expect(canTransitionBudgetStatus('FROZEN', 'ACTIVE')).toBe(true);
    expect(canTransitionBudgetStatus('ACTIVE', 'CLOSED')).toBe(true);
    expect(canTransitionBudgetStatus('CLOSED', 'ACTIVE')).toBe(false);
    expect(formatBudgetCode(2026, 'tech-ops', 7)).toBe('BUD-2026-TECHOPS-007');
  });
});
