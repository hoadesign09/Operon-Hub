import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const createLeaveRequestMock = vi.fn();
const submitLeaveRequestMock = vi.fn();
const cancelLeaveRequestMock = vi.fn();
const exportLeaveRequestsMock = vi.fn();

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

vi.mock('@/modules/hrm/requests/leave-requests.service', () => ({
  listLeaveRequests: vi.fn(),
  createLeaveRequest: (...args: unknown[]) => createLeaveRequestMock(...args),
  submitLeaveRequest: (...args: unknown[]) => submitLeaveRequestMock(...args),
  cancelLeaveRequest: (...args: unknown[]) => cancelLeaveRequestMock(...args),
  exportLeaveRequestsToExcel: (...args: unknown[]) => exportLeaveRequestsMock(...args),
}));

import { POST as createPOST } from '@/app/api/v1/hrm/requests/leaves/route';
import { POST as submitPOST } from '@/app/api/v1/hrm/requests/leaves/[id]/submit/route';
import { POST as cancelPOST } from '@/app/api/v1/hrm/requests/leaves/[id]/cancel/route';
import { GET as exportGET } from '@/app/api/v1/hrm/requests/leaves/export/route';
import {
  dispatchApprovalCompletionHook,
  registerApprovalCompletionHook,
} from '@/modules/approvals/approval-hooks';

describe('API /api/v1/hrm/requests/leaves/* & Approval Completion Hook', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    createLeaveRequestMock.mockReset();
    submitLeaveRequestMock.mockReset();
    cancelLeaveRequestMock.mockReset();
    exportLeaveRequestsMock.mockReset();

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

  it('tạo đơn nghỉ phép trả 201, validate định dạng ngày 400 và chặn trùng lịch 409', async () => {
    const resBad = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          leaveTypeId: 1,
          startDate: '23/11/2026',
          endDate: '24/11/2026',
          reason: 'Việc cá nhân',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resBad.status).toBe(400);

    createLeaveRequestMock.mockResolvedValueOnce({
      id: 10,
      requestCode: 'NP-2026-0010',
      totalDays: 1.5,
      status: 'PENDING',
      approvalRequestId: 99,
    });
    const resOk = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          leaveTypeId: 1,
          startDate: '2026-12-01',
          endDate: '2026-12-02',
          startSession: 'FULL',
          endSession: 'AM',
          reason: 'Giải quyết việc gia đình',
          submitNow: true,
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOk.status).toBe(201);

    createLeaveRequestMock.mockRejectedValueOnce(
      new AppError('LEAVE_DATE_OVERLAP', 'Trùng lịch nghỉ', 409),
    );
    const resOverlap = await createPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          leaveTypeId: 1,
          startDate: '2026-12-01',
          endDate: '2026-12-02',
          reason: 'Trùng đơn cũ',
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOverlap.status).toBe(409);
  });

  it('gửi duyệt (/submit), hủy đơn (/cancel) và xuất Excel (/export) trả đúng header & status', async () => {
    submitLeaveRequestMock.mockResolvedValueOnce({ id: 10, status: 'PENDING' });
    const resSubmit = await submitPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leaves/10/submit', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(resSubmit.status).toBe(200);

    cancelLeaveRequestMock.mockResolvedValueOnce({ id: 10, status: 'CANCELLED' });
    const resCancel = await cancelPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leaves/10/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ comment: 'Đổi kế hoạch' }),
      }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(resCancel.status).toBe(200);

    exportLeaveRequestsMock.mockResolvedValueOnce({
      buffer: Buffer.from('PK-mock-xlsx'),
      filename: 'don-nghi-phep-2026-11-23.xlsx',
    });
    const resExport = await exportGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/requests/leaves/export?year=2026', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resExport.status).toBe(200);
    expect(resExport.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(resExport.headers.get('content-disposition')).toContain('don-nghi-phep-2026-11-23.xlsx');
  });

  it('dispatchApprovalCompletionHook gọi đúng handler đã đăng ký theo entityType', async () => {
    const spy = vi.fn().mockResolvedValue(undefined);
    registerApprovalCompletionHook('test_entity', spy);

    await dispatchApprovalCompletionHook({} as never, {
      approvalRequestId: 1,
      moduleCode: 'hrm',
      entityType: 'test_entity',
      entityId: 42,
      nextStatus: 'APPROVED',
      actorUserId: 1,
      comment: 'OK',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ entityId: 42, nextStatus: 'APPROVED' }),
    );
  });
});
