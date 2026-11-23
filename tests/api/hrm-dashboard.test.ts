import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const getHrmDashboardSummaryMock = vi.fn();

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

vi.mock('@/modules/hrm/dashboard/dashboard.service', () => ({
  getHrmDashboardSummary: (...args: unknown[]) => getHrmDashboardSummaryMock(...args),
}));

import { GET as dashboardSummaryGET } from '@/app/api/v1/hrm/dashboard/summary/route';

function makeReq(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: { Authorization: 'Bearer test-token' },
  });
}

describe('HRM Dashboard Summary API (/api/v1/hrm/dashboard/summary)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessTokenMock.mockResolvedValue({ sub: '1', email: 'admin@operonhub.local', type: 'access' });
  });

  it('returns 403 when user lacks hrm.dashboard.read permission', async () => {
    loadAuthContextMock.mockResolvedValueOnce({
      userId: 99,
      email: 'guest@operonhub.local',
      fullName: 'Guest',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [],
      permissions: [],
      dataScope: 'OWN',
      isSuperAdmin: false,
      hasAllBranches: false,
      branchIds: [],
      branches: [],
    });

    const res = await dashboardSummaryGET(
      makeReq('http://localhost/api/v1/hrm/dashboard/summary'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
  });

  it('forwards query parameters and maps 200 success and 403 branch scope errors cleanly', async () => {
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'admin@operonhub.local',
      fullName: 'Admin',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'SA', dataScope: 'ALL', branchId: null }],
      permissions: ['hrm.dashboard.read', 'hrm.payroll.read'],
      dataScope: 'ALL',
      isSuperAdmin: true,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });

    getHrmDashboardSummaryMock.mockResolvedValueOnce({
      period: { year: 2026, month: 11 },
      scopeMode: 'ALL',
      visibility: {
        canViewWorkforce: true,
        canViewContracts: true,
        canViewAttendance: true,
        canViewPayroll: true,
        canViewAssets: true,
        canViewApprovals: true,
      },
      kpis: { workforce: { activeEmployees: 3, probationCount: 0, newHiresThisMonth: 0 } },
    });

    const okRes = await dashboardSummaryGET(
      makeReq('http://localhost/api/v1/hrm/dashboard/summary?branchId=1&year=2026&month=11'),
      { params: Promise.resolve({}) },
    );
    expect(okRes.status).toBe(200);
    expect(getHrmDashboardSummaryMock).toHaveBeenCalledWith(expect.anything(), {
      branchId: '1',
      year: '2026',
      month: '11',
    });

    getHrmDashboardSummaryMock.mockRejectedValueOnce(
      new AppError('FORBIDDEN_BRANCH', 'Không có quyền xem chi nhánh này', 403),
    );
    const forbiddenBranchRes = await dashboardSummaryGET(
      makeReq('http://localhost/api/v1/hrm/dashboard/summary?branchId=99'),
      { params: Promise.resolve({}) },
    );
    expect(forbiddenBranchRes.status).toBe(403);
  });
});
