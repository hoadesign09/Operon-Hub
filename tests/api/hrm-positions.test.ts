import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const createPositionMock = vi.fn();
const listPositionsMock = vi.fn();

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

vi.mock('@/modules/hrm/organization/positions.service', () => ({
  createPosition: (...args: unknown[]) => createPositionMock(...args),
  listPositions: (...args: unknown[]) => listPositionsMock(...args),
}));

import { POST } from '@/app/api/v1/hrm/org/positions/route';

describe('API /api/v1/hrm/org/positions', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    createPositionMock.mockReset();
    listPositionsMock.mockReset();
  });

  it('blocks users without hrm.org.manage (403)', async () => {
    verifyAccessTokenMock.mockResolvedValue({ userId: 8, email: 'staff@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 8,
      email: 'staff@operonhub.local',
      fullName: 'Nhân viên',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [],
      permissions: ['hrm.org.read'],
      dataScope: 'OWN',
      isSuperAdmin: false,
      hasAllBranches: false,
      branchIds: [1],
      branches: [],
    });

    const req = new NextRequest('http://localhost:3000/api/v1/hrm/org/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer staff-token' },
      body: JSON.stringify({ code: 'DEV', name: 'Lập trình viên', level: 2 }),
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it('validates level bounds (400), creates position (201) and handles duplicate code (409)', async () => {
    verifyAccessTokenMock.mockResolvedValue({ userId: 1, email: 'admin@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'admin@operonhub.local',
      fullName: 'Admin',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [],
      permissions: ['hrm.org.manage'],
      dataScope: 'ALL',
      isSuperAdmin: true,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });

    const reqBad = new NextRequest('http://localhost:3000/api/v1/hrm/org/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
      body: JSON.stringify({ code: 'DEV', name: 'Lập trình viên', level: 99 }),
    });
    expect((await POST(reqBad, { params: Promise.resolve({}) })).status).toBe(400);

    createPositionMock.mockResolvedValueOnce({ id: 7, code: 'DEV', name: 'Lập trình viên', level: 2 });
    const reqOk = new NextRequest('http://localhost:3000/api/v1/hrm/org/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
      body: JSON.stringify({ code: 'dev', name: 'Lập trình viên', level: 2 }),
    });
    expect((await POST(reqOk, { params: Promise.resolve({}) })).status).toBe(201);

    createPositionMock.mockRejectedValueOnce(
      new AppError('POSITION_CODE_EXISTS', 'Trùng mã chức danh.', 409),
    );
    const reqDup = new NextRequest('http://localhost:3000/api/v1/hrm/org/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
      body: JSON.stringify({ code: 'DEV', name: 'Lập trình viên', level: 2 }),
    });
    expect((await POST(reqDup, { params: Promise.resolve({}) })).status).toBe(409);
  });
});
