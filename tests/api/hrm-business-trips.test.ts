import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const createTripMock = vi.fn();
const submitTripMock = vi.fn();
const cancelTripMock = vi.fn();
const exportTripsMock = vi.fn();

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

vi.mock('@/modules/hrm/requests/business-trip-requests.service', () => ({
  listBusinessTripRequests: vi.fn(),
  createBusinessTripRequest: (...args: unknown[]) => createTripMock(...args),
  submitBusinessTripRequest: (...args: unknown[]) => submitTripMock(...args),
  cancelBusinessTripRequest: (...args: unknown[]) => cancelTripMock(...args),
  exportBusinessTripRequestsToExcel: (...args: unknown[]) => exportTripsMock(...args),
}));

import { POST as createPOST } from '@/app/api/v1/hrm/requests/business-trips/route';
import { POST as submitPOST } from '@/app/api/v1/hrm/requests/business-trips/[id]/submit/route';
import { POST as cancelPOST } from '@/app/api/v1/hrm/requests/business-trips/[id]/cancel/route';
import { GET as exportGET } from '@/app/api/v1/hrm/requests/business-trips/export/route';

describe('API /api/v1/hrm/requests/business-trips/*', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    createTripMock.mockReset();
    submitTripMock.mockReset();
    cancelTripMock.mockReset();
    exportTripsMock.mockReset();

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

  it('tạo đơn công tác hợp lệ (201), chặn chi phí âm (400) và trùng lịch công tác (409)', async () => {
    const resNeg = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/business-trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          destination: 'TP.HCM',
          startDate: '2026-12-03',
          endDate: '2026-12-05',
          estimatedCost: -500000,
          purpose: 'Gặp khách hàng',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resNeg.status).toBe(400);

    createTripMock.mockResolvedValueOnce({
      id: 2,
      requestCode: 'CT-2026-0002',
      totalDays: 3,
      estimatedCost: 4500000,
      status: 'PENDING',
    });
    const resOk = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/business-trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          destination: 'Chi nhánh TP.HCM',
          startDate: '2026-12-03',
          endDate: '2026-12-05',
          estimatedCost: 4500000,
          purpose: 'Gặp gỡ đối tác chiến lược',
          submitNow: true,
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOk.status).toBe(201);

    createTripMock.mockRejectedValueOnce(new AppError('TRIP_DATE_OVERLAP', 'Trùng lịch công tác', 409));
    const resDup = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/business-trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          destination: 'Đà Nẵng',
          startDate: '2026-12-04',
          endDate: '2026-12-06',
          estimatedCost: 2000000,
          purpose: 'Trùng ngày',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resDup.status).toBe(409);
  });

  it('gửi duyệt, hủy đơn và xuất Excel đơn công tác trả đúng HTTP status & headers', async () => {
    submitTripMock.mockResolvedValueOnce({ id: 2, status: 'PENDING' });
    const resSubmit = await submitPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/business-trips/2/submit', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(resSubmit.status).toBe(200);

    cancelTripMock.mockResolvedValueOnce({ id: 2, status: 'CANCELLED' });
    const resCancel = await cancelPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/business-trips/2/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ comment: 'Chuyển lịch sang tuần sau' }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(resCancel.status).toBe(200);

    exportTripsMock.mockResolvedValueOnce({
      buffer: Buffer.from('PK-trip-xlsx'),
      filename: 'don-cong-tac-2026-11-23.xlsx',
    });
    const resExport = await exportGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/business-trips/export?year=2026', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resExport.status).toBe(200);
    expect(resExport.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(resExport.headers.get('content-disposition')).toContain('don-cong-tac-2026-11-23.xlsx');
  });
});
