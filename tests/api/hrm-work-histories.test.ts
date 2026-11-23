import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/modules/auth/auth.service';

const {
  mockVerifyAccessToken,
  mockLoadAuthContext,
  mockCreateWorkHistory,
  mockSoftDeleteWorkHistory,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockLoadAuthContext: vi.fn(),
  mockCreateWorkHistory: vi.fn(),
  mockSoftDeleteWorkHistory: vi.fn(),
}));

vi.mock('@/modules/auth/jwt', () => ({
  ACCESS_TOKEN_COOKIE: 'operon_access_token',
  verifyAccessToken: mockVerifyAccessToken,
}));

vi.mock('@/modules/auth/auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/auth/auth.service')>();
  return {
    ...actual,
    loadAuthContext: mockLoadAuthContext,
  };
});

vi.mock('@/modules/hrm/contracts/work-histories.service', () => ({
  listEmployeeWorkHistories: vi.fn(),
  createEmployeeWorkHistory: mockCreateWorkHistory,
  softDeleteWorkHistory: mockSoftDeleteWorkHistory,
}));

import { POST } from '@/app/api/v1/hrm/employees/[id]/work-histories/route';
import { DELETE } from '@/app/api/v1/hrm/work-histories/[id]/route';

function makeAuth(permissions: string[]): AuthContext {
  return {
    userId: 10,
    email: 'hr@operonhub.local',
    fullName: 'HR Manager',
    avatarUrl: null,
    status: 'ACTIVE',
    roles: [{ id: 3, code: 'HR_MANAGER', name: 'Trưởng phòng NS', dataScope: 'ALL', branchId: null }],
    permissions,
    dataScope: 'ALL',
    isSuperAdmin: false,
    hasAllBranches: true,
    branchIds: [1],
    branches: [{ id: 1, code: 'HQ', name: 'Trụ sở chính', isHeadquarters: true }],
  };
}

describe('HRM Work Histories API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAccessToken.mockResolvedValue({ userId: 10, email: 'hr@operonhub.local' });
  });

  it('POST /employees/[id]/work-histories chặn 403 thiếu quyền, 400 sai ngày và trả 201 khi hợp lệ', async () => {
    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.read']));
    const res403 = await POST(
      new NextRequest('http://localhost/api/v1/hrm/employees/2/work-histories', {
        method: 'POST',
        headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
        body: JSON.stringify({ changeType: 'PROMOTION', effectiveDate: '2026-11-23' }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(res403.status).toBe(403);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.manage']));
    const res400 = await POST(
      new NextRequest('http://localhost/api/v1/hrm/employees/2/work-histories', {
        method: 'POST',
        headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
        body: JSON.stringify({ changeType: 'PROMOTION', effectiveDate: '23/11/2026' }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(res400.status).toBe(400);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.manage']));
    mockCreateWorkHistory.mockResolvedValueOnce({
      id: 15,
      employeeId: 2,
      changeType: 'PROMOTION',
      effectiveDate: '2026-11-23',
    });
    const res201 = await POST(
      new NextRequest('http://localhost/api/v1/hrm/employees/2/work-histories', {
        method: 'POST',
        headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
        body: JSON.stringify({
          changeType: 'PROMOTION',
          effectiveDate: '2026-11-23',
          decisionNo: 'QD-BN-2026-01',
          toPositionId: 2,
          syncToEmployeeProfile: true,
        }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(res201.status).toBe(201);
  });

  it('DELETE /work-histories/[id] chặn ID sai (400) và xóa mềm hợp lệ (200)', async () => {
    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.manage']));
    const res400 = await DELETE(
      new NextRequest('http://localhost/api/v1/hrm/work-histories/abc', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid' },
      }),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(res400.status).toBe(400);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.manage']));
    mockSoftDeleteWorkHistory.mockResolvedValueOnce(undefined);
    const res200 = await DELETE(
      new NextRequest('http://localhost/api/v1/hrm/work-histories/15', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid' },
      }),
      { params: Promise.resolve({ id: '15' }) },
    );
    expect(res200.status).toBe(200);
  });
});
