import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const listWorkShiftsMock = vi.fn();
const createWorkShiftMock = vi.fn();
const assignShiftMock = vi.fn();
const createHolidayMock = vi.fn();

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

vi.mock('@/modules/hrm/attendance/shifts.service', () => ({
  listWorkShifts: (...args: unknown[]) => listWorkShiftsMock(...args),
  createWorkShift: (...args: unknown[]) => createWorkShiftMock(...args),
  updateWorkShift: vi.fn(),
  deleteWorkShift: vi.fn(),
  listShiftAssignments: vi.fn(),
  assignShiftToEmployees: (...args: unknown[]) => assignShiftMock(...args),
  deleteShiftAssignment: vi.fn(),
}));

vi.mock('@/modules/hrm/attendance/holidays.service', () => ({
  listHolidays: vi.fn(),
  createHoliday: (...args: unknown[]) => createHolidayMock(...args),
  updateHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
}));

import { GET as shiftsGET, POST as shiftsPOST } from '@/app/api/v1/hrm/attendance/shifts/route';
import { POST as assignPOST } from '@/app/api/v1/hrm/attendance/shift-assignments/route';
import { POST as holidaysPOST } from '@/app/api/v1/hrm/attendance/holidays/route';

describe('API /api/v1/hrm/attendance/{shifts,shift-assignments,holidays}', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    listWorkShiftsMock.mockReset();
    createWorkShiftMock.mockReset();
    assignShiftMock.mockReset();
    createHolidayMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 2, email: 'hr@operonhub.local' });
  });

  it('kiểm tra RBAC (403 khi thiếu manage), validate (400), tạo ca (201) và trùng mã (409)', async () => {
    loadAuthContextMock.mockResolvedValueOnce({
      userId: 3,
      email: 'emp@operonhub.local',
      fullName: 'Nhân viên',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 8, code: 'EMPLOYEE', name: 'Nhân viên', dataScope: 'OWN', branchId: 1 }],
      permissions: ['hrm.attendance.read'],
      dataScope: 'OWN',
      isSuperAdmin: false,
      hasAllBranches: false,
      branchIds: [1],
      branches: [],
    });

    const resForbidden = await shiftsPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          code: 'CA_TOI',
          name: 'Ca tối',
          startTime: '14:00',
          endTime: '22:00',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resForbidden.status).toBe(403);

    loadAuthContextMock.mockResolvedValue({
      userId: 2,
      email: 'hr@operonhub.local',
      fullName: 'HR Manager',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 3, code: 'HR_MANAGER', name: 'HR', dataScope: 'ALL', branchId: null }],
      permissions: ['hrm.attendance.read', 'hrm.attendance.manage'],
      dataScope: 'ALL',
      isSuperAdmin: false,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });

    listWorkShiftsMock.mockResolvedValueOnce([{ id: 1, code: 'HC', name: 'Ca Hành chính' }]);
    const resList = await shiftsGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/shifts', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resList.status).toBe(200);

    createWorkShiftMock.mockResolvedValueOnce({ id: 2, code: 'CA_CHIEU', workingHours: 8 });
    const resCreated = await shiftsPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          code: 'ca_chieu',
          name: 'Ca Chiều',
          startTime: '13:00',
          endTime: '21:00',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resCreated.status).toBe(201);
    expect(createWorkShiftMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CA_CHIEU' }),
      expect.anything(),
      null,
    );

    createWorkShiftMock.mockRejectedValueOnce(new AppError('DUPLICATE_SHIFT_CODE', 'Trùng mã ca', 409));
    const resDup = await shiftsPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          code: 'HC',
          name: 'Trùng HC',
          startTime: '08:00',
          endTime: '17:30',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resDup.status).toBe(409);
  });

  it('phân ca nhân viên & tạo ngày lễ validate chặt ngày ngược (400) và thành công (201)', async () => {
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'admin@operonhub.local',
      fullName: 'Admin',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'Admin', dataScope: 'ALL', branchId: null }],
      permissions: ['hrm.attendance.read', 'hrm.attendance.manage'],
      dataScope: 'ALL',
      isSuperAdmin: true,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });

    const resBadAssign = await assignPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/shift-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          employeeIds: [1],
          shiftId: 1,
          effectiveFrom: '2026-12-01',
          effectiveTo: '2026-11-01',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resBadAssign.status).toBe(400);

    assignShiftMock.mockResolvedValueOnce({ assignedCount: 2, shiftId: 1 });
    const resOkAssign = await assignPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/shift-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          employeeIds: [1, 2],
          shiftId: 1,
          effectiveFrom: '2026-11-01',
          workDays: [1, 2, 3, 4, 5],
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOkAssign.status).toBe(201);

    createHolidayMock.mockResolvedValueOnce({
      id: 10,
      holidayDate: '2026-09-02',
      name: 'Quốc khánh 2/9',
      isPaid: true,
    });
    const resHoliday = await holidaysPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          holidayDate: '2026-09-02',
          name: 'Quốc khánh 2/9',
          isPaid: true,
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resHoliday.status).toBe(201);
  });
});
