import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const initializeLeaveBalancesMock = vi.fn();
const updateLeaveBalanceMock = vi.fn();

vi.mock('@/modules/auth/jwt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/auth/jwt')>();
  return {
    ...actual,
    verifyAccessToken: (...args: unknown[]) => verifyAccessTokenMock(...args),
  };
});

vi.mock('@/modules/auth/auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/auth/auth.service')>();
  return {
    ...actual,
    loadAuthContext: (...args: unknown[]) => loadAuthContextMock(...args),
  };
});

vi.mock('@/modules/hrm/requests/leave-balances.service', () => ({
  initializeLeaveBalancesForYear: (...args: unknown[]) => initializeLeaveBalancesMock(...args),
  updateLeaveBalance: (...args: unknown[]) => updateLeaveBalanceMock(...args),
}));

import { POST as initPOST } from '@/app/api/v1/hrm/requests/leave-balances/initialize/route';
import { PATCH as adjustPATCH } from '@/app/api/v1/hrm/requests/leave-balances/[id]/route';

describe('API /api/v1/hrm/requests/leave-balances/*', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    initializeLeaveBalancesMock.mockReset();
    updateLeaveBalanceMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 2, email: 'hr@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 2,
      email: 'hr@operonhub.local',
      fullName: 'HR Manager',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 3, code: 'HR_MANAGER', name: 'HR Manager', dataScope: 'ALL', branchId: null }],
      permissions: ['hrm.requests.read', 'hrm.requests.manage'],
      dataScope: 'ALL',
      isSuperAdmin: false,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });
  });

  it('khởi tạo quỹ phép năm trả 201 và validate năm hợp lệ (400)', async () => {
    const resBadYear = await initPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leave-balances/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ year: 1999 }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resBadYear.status).toBe(400);

    initializeLeaveBalancesMock.mockResolvedValueOnce({
      year: 2027,
      createdCount: 9,
      skippedCount: 0,
    });

    const resOk = await initPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leave-balances/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          year: 2027,
          includeCarryOver: true,
          includeSeniorityBonus: true,
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOk.status).toBe(201);
  });

  it('điều chỉnh quỹ phép năm trả 200 khi hợp lệ và 400 khi làm số dư âm', async () => {
    updateLeaveBalanceMock.mockResolvedValueOnce({ id: 5, remainingDays: 14 });
    const resOk = await adjustPATCH(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leave-balances/5', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ entitledDays: 14, carriedOverDays: 0, note: 'Thưởng' }),
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resOk.status).toBe(200);

    updateLeaveBalanceMock.mockRejectedValueOnce(
      new AppError('INVALID_BALANCE_ADJUSTMENT', 'Số dư âm', 400),
    );
    const resInvalid = await adjustPATCH(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leave-balances/5', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ entitledDays: 1, carriedOverDays: 0 }),
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resInvalid.status).toBe(400);
  });
});
