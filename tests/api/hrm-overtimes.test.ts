import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const createOvertimeMock = vi.fn();
const submitOvertimeMock = vi.fn();
const cancelOvertimeMock = vi.fn();
const exportOvertimesMock = vi.fn();

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

vi.mock('@/modules/hrm/requests/overtime-requests.service', () => ({
  listOvertimeRequests: vi.fn(),
  createOvertimeRequest: (...args: unknown[]) => createOvertimeMock(...args),
  submitOvertimeRequest: (...args: unknown[]) => submitOvertimeMock(...args),
  cancelOvertimeRequest: (...args: unknown[]) => cancelOvertimeMock(...args),
  exportOvertimeRequestsToExcel: (...args: unknown[]) => exportOvertimesMock(...args),
}));

import { POST as createPOST } from '@/app/api/v1/hrm/requests/overtimes/route';
import { POST as submitPOST } from '@/app/api/v1/hrm/requests/overtimes/[id]/submit/route';
import { POST as cancelPOST } from '@/app/api/v1/hrm/requests/overtimes/[id]/cancel/route';
import { GET as exportGET } from '@/app/api/v1/hrm/requests/overtimes/export/route';

describe('API /api/v1/hrm/requests/overtimes/*', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    createOvertimeMock.mockReset();
    submitOvertimeMock.mockReset();
    cancelOvertimeMock.mockReset();
    exportOvertimesMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 1, email: 'admin@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'admin@operonhub.local',
      fullName: 'Admin',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'Super Admin', dataScope: 'ALL', branchId: null }],
      permissions: ['hrm.requests.read', 'hrm.requests.create', 'hrm.requests.export'],
      dataScope: 'ALL',
      isSuperAdmin: true,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });
  });

  it('tạo đơn OT hợp lệ (201), validate định dạng giờ (400) và chặn trùng khung giờ (409)', async () => {
    const resBad = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/overtimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          workDate: '2026-11-28',
          startTime: '9:00',
          endTime: '13:00',
          reason: 'Deploy cuối tuần',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resBad.status).toBe(400);

    createOvertimeMock.mockResolvedValueOnce({
      id: 1,
      requestCode: 'OT-2026-0001',
      totalHours: 4,
      otRateType: 'WEEKEND_200',
      status: 'PENDING',
    });
    const resOk = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/overtimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          workDate: '2026-11-28',
          startTime: '09:00',
          endTime: '13:00',
          reason: 'Deploy cuối tuần',
          submitNow: true,
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOk.status).toBe(201);

    createOvertimeMock.mockRejectedValueOnce(new AppError('OT_TIME_OVERLAP', 'Trùng giờ OT', 409));
    const resDup = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/overtimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          workDate: '2026-11-28',
          startTime: '10:00',
          endTime: '12:00',
          reason: 'Trùng khung giờ',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resDup.status).toBe(409);
  });

  it('gửi duyệt, hủy đơn và xuất Excel đơn OT trả đúng HTTP status & headers', async () => {
    submitOvertimeMock.mockResolvedValueOnce({ id: 1, status: 'PENDING' });
    const resSubmit = await submitPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/overtimes/1/submit', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(resSubmit.status).toBe(200);

    cancelOvertimeMock.mockResolvedValueOnce({ id: 1, status: 'CANCELLED' });
    const resCancel = await cancelPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/overtimes/1/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ comment: 'Hoãn lịch' }),
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(resCancel.status).toBe(200);

    exportOvertimesMock.mockResolvedValueOnce({
      buffer: Buffer.from('PK-ot-xlsx'),
      filename: 'don-tang-ca-2026-11-23.xlsx',
    });
    const resExport = await exportGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/overtimes/export?year=2026', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resExport.status).toBe(200);
    expect(resExport.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(resExport.headers.get('content-disposition')).toContain('don-tang-ca-2026-11-23.xlsx');
  });
});
