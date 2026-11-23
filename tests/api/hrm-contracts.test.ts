import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  classifyContractExpiry,
  validateContractDates,
} from '@/modules/hrm/contracts/contracts.service';

const {
  mockVerifyAccessToken,
  mockLoadAuthContext,
  mockCreateContract,
  mockListExpiring,
  mockExportContracts,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockLoadAuthContext: vi.fn(),
  mockCreateContract: vi.fn(),
  mockListExpiring: vi.fn(),
  mockExportContracts: vi.fn(),
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

vi.mock('@/modules/hrm/contracts/contracts.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/hrm/contracts/contracts.service')>();
  return {
    ...actual,
    listContracts: vi.fn(),
    createContract: mockCreateContract,
    listExpiringContracts: mockListExpiring,
    exportContractsToExcel: mockExportContracts,
  };
});

import { POST } from '@/app/api/v1/hrm/contracts/route';
import { GET as GET_EXPIRING } from '@/app/api/v1/hrm/contracts/expiring/route';
import { GET as GET_EXPORT } from '@/app/api/v1/hrm/contracts/export/route';

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

describe('HRM Contracts Logic & API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAccessToken.mockResolvedValue({ userId: 10, email: 'hr@operonhub.local' });
  });

  it('phân loại chính xác cảnh báo hết hạn (OVERDUE / URGENT_15D / WARNING_30D / SAFE / NONE)', () => {
    expect(classifyContractExpiry('2026-11-20', 'ACTIVE', '2026-11-23')).toEqual({
      level: 'OVERDUE',
      daysRemaining: -3,
    });
    expect(classifyContractExpiry('2026-12-05', 'ACTIVE', '2026-11-23')).toEqual({
      level: 'URGENT_15D',
      daysRemaining: 12,
    });
    expect(classifyContractExpiry('2026-12-20', 'ACTIVE', '2026-11-23')).toEqual({
      level: 'WARNING_30D',
      daysRemaining: 27,
    });
    expect(classifyContractExpiry('2027-06-01', 'ACTIVE', '2026-11-23').level).toBe('SAFE');
    expect(classifyContractExpiry(null, 'ACTIVE', '2026-11-23').level).toBe('NONE');
    expect(classifyContractExpiry('2026-11-20', 'EXPIRED', '2026-11-23').level).toBe('NONE');
  });

  it('validateContractDates chuẩn hóa INDEFINITE về null và chặn FIXED_TERM thiếu ngày hoặc ngày ngược', () => {
    expect(validateContractDates('INDEFINITE', '2026-01-01', '2027-01-01')).toBeNull();
    expect(() => validateContractDates('FIXED_TERM', '2026-01-01', null)).toThrow('bắt buộc');
    expect(() => validateContractDates('PROBATION', '2026-05-01', '2026-04-01')).toThrow(
      'không được nhỏ hơn',
    );
  });

  it('POST /api/v1/hrm/contracts chặn 403 thiếu quyền, 400 sai dữ liệu và trả 201 khi hợp lệ', async () => {
    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.read']));
    const req403 = new NextRequest('http://localhost/api/v1/hrm/contracts', {
      method: 'POST',
      headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res403 = await POST(req403, { params: Promise.resolve({}) });
    expect(res403.status).toBe(403);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.manage']));
    mockCreateContract.mockResolvedValueOnce({ id: 7, contractNo: 'HDLD-2026-009' });
    const req201 = new NextRequest('http://localhost/api/v1/hrm/contracts', {
      method: 'POST',
      headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
      body: JSON.stringify({
        employeeId: 2,
        contractNo: 'hdld-2026-009',
        contractType: 'FIXED_TERM',
        startDate: '2026-11-23',
        endDate: '2027-11-22',
        baseSalary: 20000000,
        insuranceSalary: 15000000,
        allowances: [{ code: 'meal', label: 'Ăn trưa', amount: 1000000 }],
      }),
    });
    const res201 = await POST(req201, { params: Promise.resolve({}) });
    expect(res201.status).toBe(201);
    expect(mockCreateContract).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ contractNo: 'HDLD-2026-009', baseSalary: 20000000 }),
      null,
    );
  });

  it('GET /expiring trả summary cảnh báo & GET /export trả file .xlsx chuẩn header', async () => {
    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.read']));
    mockListExpiring.mockResolvedValueOnce({
      summary: { overdueCount: 0, urgent15Count: 1, warning30Count: 0, totalAlertCount: 1 },
      items: [],
    });
    const expRes = await GET_EXPIRING(
      new NextRequest('http://localhost/api/v1/hrm/contracts/expiring?days=30', {
        headers: { authorization: 'Bearer valid' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(expRes.status).toBe(200);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.contracts.export']));
    mockExportContracts.mockResolvedValueOnce({
      buffer: Buffer.from('PK-mock-contracts'),
      filename: 'danh-sach-hop-dong-20261123.xlsx',
      rowCount: 3,
    });
    const exportRes = await GET_EXPORT(
      new NextRequest('http://localhost/api/v1/hrm/contracts/export', {
        headers: { authorization: 'Bearer valid' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(exportRes.headers.get('content-disposition')).toContain('danh-sach-hop-dong-20261123.xlsx');
  });
});
