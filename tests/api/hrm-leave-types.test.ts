import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const listLeaveTypesMock = vi.fn();
const createLeaveTypeMock = vi.fn();

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

vi.mock('@/modules/hrm/requests/leave-types.service', () => ({
  listLeaveTypes: (...args: unknown[]) => listLeaveTypesMock(...args),
  createLeaveType: (...args: unknown[]) => createLeaveTypeMock(...args),
}));

import { GET, POST } from '@/app/api/v1/hrm/requests/leave-types/route';

describe('API /api/v1/hrm/requests/leave-types', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    listLeaveTypesMock.mockReset();
    createLeaveTypeMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 2, email: 'hr@operonhub.local' });
  });

  it('trả 200 khi nhân viên bất kỳ đọc danh mục loại phép và chặn 403 khi thiếu quyền manage', async () => {
    loadAuthContextMock.mockResolvedValue({
      userId: 8,
      email: 'nv@operonhub.local',
      fullName: 'Nhân viên',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 8, code: 'EMPLOYEE', name: 'Nhân viên', dataScope: 'OWN', branchId: 1 }],
      permissions: ['hrm.requests.read', 'hrm.requests.create'],
      dataScope: 'OWN',
      isSuperAdmin: false,
      hasAllBranches: false,
      branchIds: [1],
      branches: [],
    });

    listLeaveTypesMock.mockResolvedValueOnce([{ id: 1, code: 'ANNUAL', name: 'Nghỉ phép năm' }]);

    const resGet = await GET(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leave-types?activeOnly=true', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resGet.status).toBe(200);

    const resPostForbidden = await POST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leave-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ code: 'STUDY', name: 'Nghỉ học tập', defaultDaysPerYear: 5 }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resPostForbidden.status).toBe(403);
  });

  it('trả 201 khi HR tạo mới loại phép hợp lệ và 409 khi trùng mã', async () => {
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

    createLeaveTypeMock.mockResolvedValueOnce({
      id: 6,
      code: 'STUDY',
      name: 'Nghỉ học tập',
      defaultDaysPerYear: 5,
    });

    const resOk = await POST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leave-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ code: 'study', name: 'Nghỉ học tập', defaultDaysPerYear: 5 }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOk.status).toBe(201);

    createLeaveTypeMock.mockRejectedValueOnce(
      new AppError('DUPLICATE_LEAVE_TYPE_CODE', 'Mã đã tồn tại', 409),
    );
    const resDup = await POST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leave-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ code: 'ANNUAL', name: 'Phép năm', defaultDaysPerYear: 12 }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resDup.status).toBe(409);
  });
});
