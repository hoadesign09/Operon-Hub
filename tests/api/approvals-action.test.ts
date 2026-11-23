import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const actOnApprovalRequestMock = vi.fn();

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

vi.mock('@/modules/approvals/approvals.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/approvals/approvals.service')>();
  return {
    ...actual,
    actOnApprovalRequest: (...args: unknown[]) => actOnApprovalRequestMock(...args),
  };
});

import { POST } from '@/app/api/v1/approvals/[id]/action/route';
import { canUserActOnApproval } from '@/modules/approvals/approvals.service';

describe('API POST /api/v1/approvals/[id]/action & authorization rules', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    actOnApprovalRequestMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 5, email: 'mgr@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 5,
      email: 'mgr@operonhub.local',
      fullName: 'Manager',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 7, code: 'DEPT_MANAGER', name: 'Trưởng bộ phận', dataScope: 'DEPARTMENT', branchId: 1 }],
      permissions: ['core.approvals.read', 'core.approvals.act'],
      dataScope: 'DEPARTMENT',
      isSuperAdmin: false,
      hasAllBranches: false,
      branchIds: [1],
      branches: [],
    });
  });

  it('requires rejection comment (400) when action is REJECT without comment', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/approvals/12/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mgr-token' },
      body: JSON.stringify({ action: 'REJECT', comment: '   ' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: '12' }) });
    expect(res.status).toBe(400);
  });

  it('returns 200 on APPROVE and 409 when request is already closed', async () => {
    actOnApprovalRequestMock.mockResolvedValueOnce({ id: 12, status: 'APPROVED', currentStep: 2 });
    const reqOk = new NextRequest('http://localhost:3000/api/v1/approvals/12/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mgr-token' },
      body: JSON.stringify({ action: 'APPROVE', comment: 'Đồng ý' }),
    });
    const resOk = await POST(reqOk, { params: Promise.resolve({ id: '12' }) });
    expect(resOk.status).toBe(200);

    actOnApprovalRequestMock.mockRejectedValueOnce(
      new AppError('REQUEST_ALREADY_CLOSED', 'Đơn đã đóng.', 409),
    );
    const reqClosed = new NextRequest('http://localhost:3000/api/v1/approvals/12/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mgr-token' },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    const resClosed = await POST(reqClosed, { params: Promise.resolve({ id: '12' }) });
    expect(resClosed.status).toBe(409);
  });

  it('enforces strict approver/requester checks in canUserActOnApproval', () => {
    const req = { requesterId: 9, currentApproverUserId: null, currentApproverRoleId: 7 };

    expect(
      canUserActOnApproval(
        req,
        { userId: 5, isSuperAdmin: false, roles: [{ id: 7, code: 'DEPT_MANAGER', name: 'DM', dataScope: 'DEPARTMENT', branchId: 1 }] },
        'APPROVE',
      ),
    ).toBe(true);

    expect(
      canUserActOnApproval(
        req,
        { userId: 8, isSuperAdmin: false, roles: [{ id: 8, code: 'EMPLOYEE', name: 'NV', dataScope: 'OWN', branchId: 1 }] },
        'APPROVE',
      ),
    ).toBe(false);

    expect(
      canUserActOnApproval(req, { userId: 9, isSuperAdmin: false, roles: [] }, 'CANCEL'),
    ).toBe(true);
    expect(
      canUserActOnApproval(req, { userId: 5, isSuperAdmin: false, roles: [] }, 'CANCEL'),
    ).toBe(false);
  });
});
