import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  canViewSensitiveEmployeeFields,
  isEmployeeWithinScope,
} from '@/modules/hrm/employees/employees.scope';

const {
  mockVerifyAccessToken,
  mockLoadAuthContext,
  mockCreateEmployee,
  mockExportEmployees,
  mockSelfUpdate,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockLoadAuthContext: vi.fn(),
  mockCreateEmployee: vi.fn(),
  mockExportEmployees: vi.fn(),
  mockSelfUpdate: vi.fn(),
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

vi.mock('@/modules/hrm/employees/employees.service', () => ({
  listEmployees: vi.fn(),
  createEmployee: mockCreateEmployee,
  exportEmployeesToExcel: mockExportEmployees,
  getMyEmployeeProfile: vi.fn(),
  selfUpdateMyEmployeeProfile: mockSelfUpdate,
}));

import { POST } from '@/app/api/v1/hrm/employees/route';
import { GET as GET_EXPORT } from '@/app/api/v1/hrm/employees/export/route';
import { PATCH as PATCH_ME } from '@/app/api/v1/hrm/employees/me/route';

function makeAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 10,
    email: 'hr@operonhub.local',
    fullName: 'HR Manager',
    avatarUrl: null,
    status: 'ACTIVE',
    roles: [{ id: 3, code: 'HR_MANAGER', name: 'Trưởng phòng Nhân sự', dataScope: 'ALL', branchId: null }],
    permissions: ['hrm.employees.read', 'hrm.employees.create', 'hrm.employees.export'],
    dataScope: 'ALL',
    isSuperAdmin: false,
    hasAllBranches: true,
    branchIds: [1],
    branches: [{ id: 1, code: 'HQ', name: 'Trụ sở chính', isHeadquarters: true }],
    ...overrides,
  };
}

describe('HRM Employees Scope & API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAccessToken.mockResolvedValue({ userId: 10, email: 'hr@operonhub.local' });
  });

  it('thực thi chính xác Data Scope 4 tầng và ẩn trường nhạy cảm', () => {
    expect(
      isEmployeeWithinScope(
        { mode: 'BRANCH', branchIds: [1], departmentIds: [], selfEmployeeId: null },
        { id: 5, branchId: 2, departmentId: 3, userId: 99 },
        10,
      ),
    ).toBe(false);

    expect(
      isEmployeeWithinScope(
        { mode: 'DEPARTMENT', branchIds: [1], departmentIds: [2, 5], selfEmployeeId: 1 },
        { id: 8, branchId: 1, departmentId: 5, userId: 12 },
        10,
      ),
    ).toBe(true);

    expect(
      isEmployeeWithinScope(
        { mode: 'OWN', branchIds: [], departmentIds: [], selfEmployeeId: 4 },
        { id: 5, branchId: 1, departmentId: 2, userId: 99 },
        10,
      ),
    ).toBe(false);

    const adminOpsAuth = makeAuth({
      roles: [{ id: 6, code: 'ADMIN_OPS', name: 'Hành chính', dataScope: 'BRANCH', branchId: 1 }],
      permissions: ['hrm.employees.read'],
    });
    expect(canViewSensitiveEmployeeFields(adminOpsAuth, 999)).toBe(false);
    expect(canViewSensitiveEmployeeFields(adminOpsAuth, 10)).toBe(true);
  });

  it('POST /api/v1/hrm/employees chặn 403 khi thiếu quyền, 400 khi sai mã NV và trả 201 khi hợp lệ', async () => {
    mockLoadAuthContext.mockResolvedValueOnce(makeAuth({ permissions: ['hrm.employees.read'] }));
    const forbiddenReq = new NextRequest('http://localhost/api/v1/hrm/employees', {
      method: 'POST',
      headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const forbiddenRes = await POST(forbiddenReq, { params: Promise.resolve({}) });
    expect(forbiddenRes.status).toBe(403);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth());
    const badReq = new NextRequest('http://localhost/api/v1/hrm/employees', {
      method: 'POST',
      headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
      body: JSON.stringify({
        employeeCode: '!!',
        fullName: 'A',
        branchId: 1,
        departmentId: 2,
        positionId: 3,
        workEmail: 'not-an-email',
        hireDate: '2026-11-23',
      }),
    });
    const badRes = await POST(badReq, { params: Promise.resolve({}) });
    expect(badRes.status).toBe(400);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth());
    mockCreateEmployee.mockResolvedValueOnce({
      employee: { id: 9, employeeCode: 'NV0009', fullName: 'Lê Minh Tuấn' },
      provisionedAccount: {
        userId: 50,
        email: 'tuan.le@operonhub.local',
        temporaryPassword: 'Op@abcd12349',
        roleCode: 'EMPLOYEE',
      },
    });
    const okReq = new NextRequest('http://localhost/api/v1/hrm/employees', {
      method: 'POST',
      headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
      body: JSON.stringify({
        employeeCode: 'nv0009',
        fullName: 'Lê Minh Tuấn',
        branchId: 1,
        departmentId: 2,
        positionId: 3,
        workEmail: 'tuan.le@operonhub.local',
        hireDate: '2026-11-23',
        autoCreateAccount: true,
      }),
    });
    const okRes = await POST(okReq, { params: Promise.resolve({}) });
    expect(okRes.status).toBe(201);
    expect(mockCreateEmployee).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ employeeCode: 'NV0009', autoCreateAccount: true }),
      null,
    );
  });

  it('GET /api/v1/hrm/employees/export trả binary .xlsx chuẩn header', async () => {
    mockLoadAuthContext.mockResolvedValueOnce(makeAuth());
    mockExportEmployees.mockResolvedValueOnce({
      buffer: Buffer.from('PK-mock-xlsx'),
      filename: 'danh-sach-nhan-vien-20261123.xlsx',
      rowCount: 3,
    });

    const req = new NextRequest('http://localhost/api/v1/hrm/employees/export?branchId=1', {
      headers: { authorization: 'Bearer valid' },
    });
    const res = await GET_EXPORT(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(res.headers.get('content-disposition')).toContain('danh-sach-nhan-vien-20261123.xlsx');
  });

  it('PATCH /api/v1/hrm/employees/me cho phép nhân viên ESS tự cập nhật liên hệ an toàn', async () => {
    mockLoadAuthContext.mockResolvedValueOnce(makeAuth({ permissions: [] }));
    mockSelfUpdate.mockResolvedValueOnce({ id: 1, phone: '0988777666' });

    const req = new NextRequest('http://localhost/api/v1/hrm/employees/me', {
      method: 'PATCH',
      headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '0988777666', personalEmail: 'me@gmail.com' }),
    });
    const res = await PATCH_ME(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });
});
