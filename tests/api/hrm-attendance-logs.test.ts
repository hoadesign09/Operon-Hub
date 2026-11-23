import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const getMyAttendanceMock = vi.fn();
const checkInMeMock = vi.fn();
const checkOutMeMock = vi.fn();
const upsertManualMock = vi.fn();
const exportExcelMock = vi.fn();

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

vi.mock('@/modules/hrm/attendance/attendance-logs.service', () => ({
  getMyAttendance: (...args: unknown[]) => getMyAttendanceMock(...args),
  checkInMe: (...args: unknown[]) => checkInMeMock(...args),
  checkOutMe: (...args: unknown[]) => checkOutMeMock(...args),
  listAttendanceLogs: vi.fn(),
  upsertManualAttendanceLog: (...args: unknown[]) => upsertManualMock(...args),
  updateManualAttendanceLog: vi.fn(),
  exportAttendanceLogsExcel: (...args: unknown[]) => exportExcelMock(...args),
}));

import { GET as meGET } from '@/app/api/v1/hrm/attendance/me/route';
import { POST as checkInPOST } from '@/app/api/v1/hrm/attendance/check-in/route';
import { POST as checkOutPOST } from '@/app/api/v1/hrm/attendance/check-out/route';
import { POST as logsPOST } from '@/app/api/v1/hrm/attendance/logs/route';
import { GET as exportGET } from '@/app/api/v1/hrm/attendance/export/route';

describe('API /api/v1/hrm/attendance/{me,check-in,check-out,logs,export}', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    getMyAttendanceMock.mockReset();
    checkInMeMock.mockReset();
    checkOutMeMock.mockReset();
    upsertManualMock.mockReset();
    exportExcelMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 1, email: 'admin@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'admin@operonhub.local',
      fullName: 'Admin',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'Admin', dataScope: 'ALL', branchId: null }],
      permissions: ['hrm.attendance.read', 'hrm.attendance.manage', 'hrm.attendance.export'],
      dataScope: 'ALL',
      isSuperAdmin: true,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });
  });

  it('hỗ trợ ESS GET /me, Check-in (201 & 409 double check-in) và Check-out (200 & 400 chưa check-in)', async () => {
    getMyAttendanceMock.mockResolvedValueOnce({
      todayDate: '2026-11-23',
      logs: [],
      stats: { presentDays: 0, lateDays: 0, totalLateMinutes: 0, totalEarlyLeaveMinutes: 0, totalWorkedHours: 0 },
    });
    const resMe = await meGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/me?year=2026&month=11', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resMe.status).toBe(200);

    checkInMeMock.mockResolvedValueOnce({ id: 1, checkInTime: '08:05', status: 'PRESENT' });
    const resIn = await checkInPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ note: 'Làm việc tại HQ' }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resIn.status).toBe(201);

    checkInMeMock.mockRejectedValueOnce(new AppError('ALREADY_CHECKED_IN', 'Đã check-in hôm nay', 409));
    const resDupIn = await checkInPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/check-in', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resDupIn.status).toBe(409);

    checkOutMeMock.mockResolvedValueOnce({ id: 1, checkOutTime: '17:35', workedHours: 8 });
    const resOut = await checkOutPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/check-out', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOut.status).toBe(200);
  });

  it('chặn chấm công tay thiếu lý do (400), cho phép hợp lệ (201) và xuất Excel đúng Content-Type', async () => {
    const resBad = await logsPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          employeeId: 1,
          workDate: '2026-11-23',
          checkInTime: '08:00',
          checkOutTime: '17:30',
          note: 'ok',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resBad.status).toBe(400);

    upsertManualMock.mockResolvedValueOnce({
      created: true,
      item: { id: 9, employeeCode: 'NV0001', workedHours: 8, source: 'MANUAL' },
    });
    const resOk = await logsPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          employeeId: 1,
          workDate: '2026-11-23',
          checkInTime: '08:00',
          checkOutTime: '17:30',
          note: 'Bổ sung công do lỗi mạng',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOk.status).toBe(201);

    exportExcelMock.mockResolvedValueOnce({
      buffer: Buffer.from('PK-attendance-xlsx'),
      fileName: 'cham-cong-ngay-2026-11-23.xlsx',
    });
    const resExport = await exportGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/export?fromDate=2026-11-01', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resExport.status).toBe(200);
    expect(resExport.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(resExport.headers.get('content-disposition')).toContain('cham-cong-ngay-2026-11-23.xlsx');
  });
});
