import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const listBranchesMock = vi.fn();
const createBranchMock = vi.fn();

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

vi.mock('@/modules/branches/branches.service', () => ({
  listBranches: (...args: unknown[]) => listBranchesMock(...args),
  createBranch: (...args: unknown[]) => createBranchMock(...args),
}));

import { GET, POST } from '@/app/api/v1/core/branches/route';

const EMPTY_CTX = { params: Promise.resolve({}) };

describe('API /api/v1/core/branches (Auth + RBAC + CRUD)', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    listBranchesMock.mockReset();
    createBranchMock.mockReset();
  });

  it('returns 401 when request has no access token', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/core/branches');
    const res = await GET(req, EMPTY_CTX);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user lacks core.branches.create permission', async () => {
    verifyAccessTokenMock.mockResolvedValue({ userId: 2, email: 'emp@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 2,
      email: 'emp@operonhub.local',
      fullName: 'Nhân viên',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [],
      permissions: ['core.branches.read'],
      dataScope: 'OWN',
      isSuperAdmin: false,
      hasAllBranches: false,
      branchIds: [1],
      branches: [],
    });

    const req = new NextRequest('http://localhost:3000/api/v1/core/branches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ code: 'HN-01', name: 'Chi nhánh Hà Nội' }),
    });

    const res = await POST(req, EMPTY_CTX);
    expect(res.status).toBe(403);
  });

  it('returns 201 on valid branch creation and 409 on duplicate branch code', async () => {
    verifyAccessTokenMock.mockResolvedValue({ userId: 1, email: 'admin@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'admin@operonhub.local',
      fullName: 'Admin',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [],
      permissions: ['core.branches.create'],
      dataScope: 'ALL',
      isSuperAdmin: true,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });

    createBranchMock.mockResolvedValueOnce({
      id: 2,
      code: 'HN-01',
      name: 'Chi nhánh Hà Nội',
      isHeadquarters: false,
      isActive: true,
    });

    const req201 = new NextRequest('http://localhost:3000/api/v1/core/branches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ code: 'hn-01', name: 'Chi nhánh Hà Nội' }),
    });
    const res201 = await POST(req201, EMPTY_CTX);
    const json201 = await res201.json();
    expect(res201.status).toBe(201);
    expect(json201.data.code).toBe('HN-01');

    createBranchMock.mockRejectedValueOnce(
      new AppError('BRANCH_CODE_EXISTS', 'Mã chi nhánh đã tồn tại.', 409),
    );
    const req409 = new NextRequest('http://localhost:3000/api/v1/core/branches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ code: 'HN-01', name: 'Chi nhánh Hà Nội' }),
    });
    const res409 = await POST(req409, EMPTY_CTX);
    expect(res409.status).toBe(409);
  });
});
