import { describe, expect, it } from 'vitest';
import {
  computeApprovalTransition,
  evaluateWorkflowConditions,
} from '@/lib/portable/approval-engine';

describe('portable/approval-engine', () => {
  it('evaluates workflow condition rules accurately', () => {
    expect(evaluateWorkflowConditions(null, { days: 1 })).toBe(true);
    expect(evaluateWorkflowConditions({ minDays: 3 }, { days: 3 })).toBe(true);
    expect(evaluateWorkflowConditions({ minDays: 3 }, { days: 2 })).toBe(false);
    expect(evaluateWorkflowConditions({ minAmount: 10_000_000, maxAmount: 50_000_000 }, { amount: 25_000_000 })).toBe(true);
    expect(evaluateWorkflowConditions({ minAmount: 10_000_000 }, {})).toBe(false);
  });

  it('computes multi-step transitions for APPROVE, REJECT, and CANCEL', () => {
    expect(computeApprovalTransition(1, 2, 'APPROVE')).toEqual({
      nextStatus: 'PENDING',
      nextStep: 2,
      isCompleted: false,
    });
    expect(computeApprovalTransition(2, 2, 'APPROVE')).toEqual({
      nextStatus: 'APPROVED',
      nextStep: 2,
      isCompleted: true,
    });
    expect(computeApprovalTransition(1, 3, 'REJECT')).toEqual({
      nextStatus: 'REJECTED',
      nextStep: 1,
      isCompleted: true,
    });
    expect(computeApprovalTransition(1, 2, 'CANCEL')).toEqual({
      nextStatus: 'CANCELLED',
      nextStep: 1,
      isCompleted: true,
    });
  });

  it('throws on invalid step boundaries', () => {
    expect(() => computeApprovalTransition(0, 2, 'APPROVE')).toThrow('currentStep');
    expect(() => computeApprovalTransition(3, 2, 'APPROVE')).toThrow('không thể lớn hơn');
  });
});
