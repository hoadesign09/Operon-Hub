import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const createDepartmentMock = vi.fn();
const listDepartmentsMock = vi.fn();
const updateDepartmentMock = vi.fn();
const softDeleteDepartmentMock = vi.fn();

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

vi.mock('@/modules/hrm/organization/departments.service', () => ({
  createDepartment: (...args: unknown[]) => createDepartmentMock(...args),
  listDepartments: (...args: unknown[]) => listDepartmentsMock(...args),
  updateDepartment: (...args: unknown[]) => updateDepartmentMock(...args),
  softDeleteDepartment: (...args: unknown[]) => softDeleteDepartmentMock(...args),
}));

import { POST } from '@/app/api/v1/hrm/org/departments/route';
import { DELETE, PATCH } from '@/app/api/v1/hrm/org/departments/[id]/route';

describe('API /api/v1/hrm/org/departments', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    createDepartmentMock.mockReset();
    listDepartmentsMock.mockReset();
    updateDepartmentMock.mockReset();
    softDeleteDepartmentMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 2, email: 'hr@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 2,
      email: 'hr@operonhub.local',
      fullName: 'HR Manager',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [],
      permissions: ['hrm.org.read', 'hrm.org.manage'],
      dataScope: 'ALL',
      isSuperAdmin: false,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });
  });

  it('creates department with uppercase code (201) and rejects invalid code (400)', async () => {
    createDepartmentMock.mockResolvedValueOnce({
      id: 10,
      code: 'MKT-01',
      name: 'Phòng Marketing',
      branchId: 1,
      parentId: 1,
    });

    const reqOk = new NextRequest('http://localhost:3000/api/v1/hrm/org/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer hr-token' },
      body: JSON.stringify({ branchId: 1, parentId: 1, code: 'mkt-01', name: 'Phòng Marketing' }),
    });
    const resOk = await POST(reqOk, { params: Promise.resolve({}) });
    const jsonOk = await resOk.json();
    expect(resOk.status).toBe(201);
    expect(jsonOk.data.code).toBe('MKT-01');

    const reqBad = new NextRequest('http://localhost:3000/api/v1/hrm/org/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer hr-token' },
      body: JSON.stringify({ branchId: 1, code: 'm!', name: 'A' }),
    });
    const resBad = await POST(reqBad, { params: Promise.resolve({}) });
    expect(resBad.status).toBe(400);
  });

  it('propagates 400 when updating parent creates a cycle or deleting dept with children', async () => {
    updateDepartmentMock.mockRejectedValueOnce(
      new AppError('DEPARTMENT_CYCLE_DETECTED', 'Vòng lặp phân cấp.', 400),
    );
    const reqCycle = new NextRequest('http://localhost:3000/api/v1/hrm/org/departments/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer hr-token' },
      body: JSON.stringify({ parentId: 4 }),
    });
    const resCycle = await PATCH(reqCycle, { params: Promise.resolve({ id: '1' }) });
    expect(resCycle.status).toBe(400);

    softDeleteDepartmentMock.mockRejectedValueOnce(
      new AppError('DEPARTMENT_HAS_CHILDREN', 'Còn phòng ban con.', 400),
    );
    const reqDel = new NextRequest('http://localhost:3000/api/v1/hrm/org/departments/1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hr-token' },
    });
    const resDel = await DELETE(reqDel, { params: Promise.resolve({ id: '1' }) });
    expect(resDel.status).toBe(400);
  });
});
