import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const listUserNotificationsMock = vi.fn();
const markNotificationReadMock = vi.fn();

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

vi.mock('@/modules/notifications/notifications.service', () => ({
  listUserNotifications: (...args: unknown[]) => listUserNotificationsMock(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationReadMock(...args),
}));

import { GET } from '@/app/api/v1/core/notifications/route';
import { PATCH } from '@/app/api/v1/core/notifications/[id]/read/route';

describe('API /api/v1/core/notifications', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    listUserNotificationsMock.mockReset();
    markNotificationReadMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 3, email: 'nv@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 3,
      email: 'nv@operonhub.local',
      fullName: 'Nhân viên A',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [],
      permissions: ['core.approvals.read'],
      dataScope: 'OWN',
      isSuperAdmin: false,
      hasAllBranches: false,
      branchIds: [1],
      branches: [],
    });
  });

  it('lists notifications strictly scoped to authenticated userId with unreadCount', async () => {
    listUserNotificationsMock.mockResolvedValue({
      items: [{ id: 1, title: 'Đơn đã duyệt', message: 'OK', isRead: false }],
      unreadCount: 1,
      meta: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    const req = new NextRequest('http://localhost:3000/api/v1/core/notifications?limit=10', {
      headers: { Authorization: 'Bearer nv-token' },
    });
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(listUserNotificationsMock).toHaveBeenCalledWith(3, expect.any(Object));
    expect(json.data.unreadCount).toBe(1);
  });

  it('returns 404 when attempting to mark another user notification (IDOR protection)', async () => {
    markNotificationReadMock.mockRejectedValueOnce(
      new AppError('NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.', 404),
    );

    const req = new NextRequest('http://localhost:3000/api/v1/core/notifications/999/read', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer nv-token' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '999' }) });
    expect(res.status).toBe(404);
    expect(markNotificationReadMock).toHaveBeenCalledWith(3, 999);
  });
});
