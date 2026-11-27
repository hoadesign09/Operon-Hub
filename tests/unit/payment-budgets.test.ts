import { describe, expect, it } from 'vitest';
import {
  adjustBudgetSchema,
  changeBudgetStatusSchema,
  createBudgetSchema,
  transferBudgetSchema,
} from '@/modules/payments/budgets.schema';
import { canManageBudgets, canViewBudgets } from '@/modules/payments/budgets.service';
import type { AuthContext } from '@/modules/auth/auth.service';

function makeAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 10,
    email: 'user@operonhub.local',
    fullName: 'Test User',
    avatarUrl: null,
    status: 'ACTIVE',
    isSuperAdmin: false,
    dataScope: 'OWN',
    hasAllBranches: false,
    branchIds: [1],
    branches: [],
    roles: [],
    permissions: [],
    ...overrides,
  };
}

describe('unit/payment-budgets', () => {
  it('validates createBudgetSchema date ordering and positive allocation', () => {
    const valid = createBudgetSchema.safeParse({
      name: 'Ngân sách IT 2026',
      fiscalYear: 2026,
      periodType: 'ANNUAL',
      periodLabel: 'FY2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      allocatedAmount: 250_000_000,
      warningThresholdPercent: 80,
      enforcementMode: 'HARD_BLOCK',
      status: 'ACTIVE',
    });
    expect(valid.success).toBe(true);

    const badDate = createBudgetSchema.safeParse({
      name: 'Ngân sách lỗi ngày',
      fiscalYear: 2026,
      periodType: 'CUSTOM',
      periodLabel: 'CUSTOM',
      startDate: '2026-12-31',
      endDate: '2026-01-01',
      allocatedAmount: 10_000_000,
    });
    expect(badDate.success).toBe(false);

    const zeroAlloc = createBudgetSchema.safeParse({
      name: 'Ngân sách 0 đồng',
      fiscalYear: 2026,
      periodType: 'ANNUAL',
      periodLabel: 'FY2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      allocatedAmount: 0,
    });
    expect(zeroAlloc.success).toBe(false);
  });

  it('validates adjustBudgetSchema, transferBudgetSchema and changeBudgetStatusSchema', () => {
    expect(
      adjustBudgetSchema.safeParse({
        action: 'TOP_UP',
        amount: 25_000_000,
        reason: 'Bổ sung theo tờ trình Q4',
      }).success,
    ).toBe(true);

    expect(
      adjustBudgetSchema.safeParse({
        action: 'REDUCE',
        amount: 5_000_000,
        reason: 'ok',
      }).success,
    ).toBe(false);

    // Reject transfer to same budget
    expect(
      transferBudgetSchema.safeParse({
        fromBudgetId: 5,
        toBudgetId: 5,
        amount: 10_000_000,
        reason: 'Chuyển cùng quỹ',
      }).success,
    ).toBe(false);

    expect(
      transferBudgetSchema.safeParse({
        fromBudgetId: 1,
        toBudgetId: 2,
        amount: 10_000_000,
        reason: 'Điều chuyển giữa 2 phòng ban',
      }).success,
    ).toBe(true);

    expect(changeBudgetStatusSchema.safeParse({ status: 'FROZEN' }).success).toBe(true);
    expect(changeBudgetStatusSchema.safeParse({ status: 'INVALID' }).success).toBe(false);
  });

  it('enforces RBAC checks for viewing and managing budgets', () => {
    const plainEmployee = makeAuth({ permissions: ['payments.read', 'payments.create'] });
    expect(canViewBudgets(plainEmployee)).toBe(false);
    expect(canManageBudgets(plainEmployee)).toBe(false);

    const deptMgr = makeAuth({ permissions: ['payments.read', 'payments.budgets.read'] });
    expect(canViewBudgets(deptMgr)).toBe(true);
    expect(canManageBudgets(deptMgr)).toBe(false);

    const finance = makeAuth({
      permissions: ['payments.read', 'payments.budgets.read', 'payments.budgets.manage'],
    });
    expect(canViewBudgets(finance)).toBe(true);
    expect(canManageBudgets(finance)).toBe(true);

    const superAdmin = makeAuth({ isSuperAdmin: true });
    expect(canViewBudgets(superAdmin)).toBe(true);
    expect(canManageBudgets(superAdmin)).toBe(true);
  });
});
