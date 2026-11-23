import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const listSummariesMock = vi.fn();
const calculateSummariesMock = vi.fn();
const updateSummaryMock = vi.fn();
const lockSummariesMock = vi.fn();
const unlockSummariesMock = vi.fn();
const exportSummariesMock = vi.fn();
const getMySummaryMock = vi.fn();

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

vi.mock('@/modules/hrm/attendance/attendance-summaries.service', () => ({
  listAttendanceSummaries: (...args: unknown[]) => listSummariesMock(...args),
  calculateMonthlyAttendanceSummaries: (...args: unknown[]) => calculateSummariesMock(...args),
  updateAttendanceSummaryManual: (...args: unknown[]) => updateSummaryMock(...args),
  lockAttendanceSummaries: (...args: unknown[]) => lockSummariesMock(...args),
  unlockAttendanceSummaries: (...args: unknown[]) => unlockSummariesMock(...args),
  exportAttendanceSummariesExcel: (...args: unknown[]) => exportSummariesMock(...args),
  getMyAttendanceSummary: (...args: unknown[]) => getMySummaryMock(...args),
}));

import { GET as listGET } from '@/app/api/v1/hrm/attendance/summaries/route';
import { POST as calcPOST } from '@/app/api/v1/hrm/attendance/summaries/calculate/route';
import { PATCH as patchSummary } from '@/app/api/v1/hrm/attendance/summaries/[id]/route';
import { POST as lockPOST } from '@/app/api/v1/hrm/attendance/summaries/lock/route';
import { POST as unlockPOST } from '@/app/api/v1/hrm/attendance/summaries/unlock/route';
import { GET as exportGET } from '@/app/api/v1/hrm/attendance/summaries/export/route';
import { GET as meGET } from '@/app/api/v1/hrm/attendance/summaries/me/route';

describe('API /api/v1/hrm/attendance/summaries/*', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    listSummariesMock.mockReset();
    calculateSummariesMock.mockReset();
    updateSummaryMock.mockReset();
    lockSummariesMock.mockReset();
    unlockSummariesMock.mockReset();
    exportSummariesMock.mockReset();
    getMySummaryMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 1, email: 'hr@operonhub.local' });
  });

  it('kiểm tra RBAC chốt công (403 cho HR_STAFF không có hrm.attendance.lock) và mở khóa bắt buộc lý do (400)', async () => {
    loadAuthContextMock.mockResolvedValueOnce({
      userId: 5,
      email: 'hrstaff@operonhub.local',
      fullName: 'HR Staff',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 4, code: 'HR_STAFF', name: 'HR Staff', dataScope: 'BRANCH', branchId: 1 }],
      permissions: ['hrm.attendance.read', 'hrm.attendance.manage', 'hrm.attendance.export'],
      dataScope: 'BRANCH',
      isSuperAdmin: false,
      hasAllBranches: false,
      branchIds: [1],
      branches: [],
    });

    const resForbiddenLock = await lockPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ year: 2026, month: 11 }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resForbiddenLock.status).toBe(403);

    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'hr@operonhub.local',
      fullName: 'HR Manager',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 3, code: 'HR_MANAGER', name: 'HR Manager', dataScope: 'ALL', branchId: null }],
      permissions: [
        'hrm.attendance.read',
        'hrm.attendance.manage',
        'hrm.attendance.lock',
        'hrm.attendance.export',
      ],
      dataScope: 'ALL',
      isSuperAdmin: false,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });

    const resBadUnlock = await unlockPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ year: 2026, month: 11, reason: 'ok' }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resBadUnlock.status).toBe(400);

    lockSummariesMock.mockResolvedValueOnce({ lockedCount: 3 });
    const resLockOk = await lockPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ year: 2026, month: 11 }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resLockOk.status).toBe(200);

    unlockSummariesMock.mockResolvedValueOnce({ unlockedCount: 3 });
    const resUnlockOk = await unlockPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ year: 2026, month: 11, reason: 'Bổ sung đơn nghỉ phép đã duyệt trễ' }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resUnlockOk.status).toBe(200);
  });

  it('hỗ trợ GET list, POST calculate, PATCH điều chỉnh (409 khi LOCKED / 200 khi DRAFT), GET /me & GET /export', async () => {
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'admin@operonhub.local',
      fullName: 'Admin',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'Admin', dataScope: 'ALL', branchId: null }],
      permissions: ['hrm.attendance.read', 'hrm.attendance.manage', 'hrm.attendance.lock', 'hrm.attendance.export'],
      dataScope: 'ALL',
      isSuperAdmin: true,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });

    listSummariesMock.mockResolvedValueOnce({
      items: [],
      stats: { totalEmployees: 0, draftCount: 0, lockedCount: 0, totalPayableDays: 0, totalOtHours: 0 },
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });
    const resList = await listGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries?year=2026&month=11', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resList.status).toBe(200);

    calculateSummariesMock.mockResolvedValueOnce({
      year: 2026,
      month: 11,
      totalProcessed: 3,
      createdCount: 3,
      updatedCount: 0,
      skippedLockedCount: 0,
    });
    const resCalc = await calcPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ year: 2026, month: 11 }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resCalc.status).toBe(200);

    updateSummaryMock.mockRejectedValueOnce(new AppError('SUMMARY_LOCKED', 'Đã chốt công', 409));
    const resPatchLocked = await patchSummary(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ actualWorkDays: 20, adjustmentNote: 'Điều chỉnh bổ sung công' }),
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(resPatchLocked.status).toBe(409);

    getMySummaryMock.mockResolvedValueOnce({ id: 1, payableDays: 21, status: 'LOCKED' });
    const resMe = await meGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries/me?year=2026&month=11', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resMe.status).toBe(200);

    exportSummariesMock.mockResolvedValueOnce({
      buffer: Buffer.from('PK-summary-xlsx'),
      fileName: 'bang-cong-thang-2026-11.xlsx',
    });
    const resExport = await exportGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/summaries/export?year=2026&month=11', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resExport.status).toBe(200);
    expect(resExport.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(resExport.headers.get('content-disposition')).toContain('bang-cong-thang-2026-11.xlsx');
  });
});
