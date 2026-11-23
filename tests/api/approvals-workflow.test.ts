import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const createWorkflowMock = vi.fn();
const listWorkflowsMock = vi.fn();

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

vi.mock('@/modules/approvals/workflows.service', () => ({
  createWorkflow: (...args: unknown[]) => createWorkflowMock(...args),
  listWorkflows: (...args: unknown[]) => listWorkflowsMock(...args),
}));

import { POST } from '@/app/api/v1/approvals/workflows/route';

const EMPTY_CTX = { params: Promise.resolve({}) };

describe('API POST /api/v1/approvals/workflows', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    createWorkflowMock.mockReset();
    listWorkflowsMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 1, email: 'hr@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'hr@operonhub.local',
      fullName: 'HR Manager',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [],
      permissions: ['core.approvals.workflow_manage', 'core.approvals.read'],
      dataScope: 'ALL',
      isSuperAdmin: false,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });
  });

  it('returns 400 when ROLE step misses approverRoleId', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/approvals/workflows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer hr-token',
      },
      body: JSON.stringify({
        moduleCode: 'hrm',
        requestType: 'LEAVE',
        name: 'Luồng thiếu role',
        steps: [{ approverType: 'ROLE' }],
      }),
    });

    const res = await POST(req, EMPTY_CTX);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 when workflow payload is valid', async () => {
    createWorkflowMock.mockResolvedValue({
      id: 10,
      moduleCode: 'hrm',
      requestType: 'LEAVE',
      name: 'Nghỉ phép 2 cấp',
      steps: [{ id: 1, stepOrder: 1, approverType: 'ROLE', approverRoleId: 7 }],
    });

    const req = new NextRequest('http://localhost:3000/api/v1/approvals/workflows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer hr-token',
      },
      body: JSON.stringify({
        moduleCode: 'hrm',
        requestType: 'leave',
        name: 'Nghỉ phép 2 cấp',
        steps: [{ approverType: 'ROLE', approverRoleId: 7 }],
      }),
    });

    const res = await POST(req, EMPTY_CTX);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.id).toBe(10);
  });
});
