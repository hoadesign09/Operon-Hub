import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();

const listAnnouncementsMock = vi.fn();
const createAnnouncementMock = vi.fn();
const getAnnouncementDetailMock = vi.fn();
const updateAnnouncementMock = vi.fn();
const deleteAnnouncementMock = vi.fn();
const publishAnnouncementMock = vi.fn();
const markAnnouncementReadMock = vi.fn();
const listAnnouncementReadersMock = vi.fn();

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

vi.mock('@/modules/hrm/office/announcements.service', () => ({
  listAnnouncements: (...args: unknown[]) => listAnnouncementsMock(...args),
  createAnnouncement: (...args: unknown[]) => createAnnouncementMock(...args),
  getAnnouncementDetail: (...args: unknown[]) => getAnnouncementDetailMock(...args),
  updateAnnouncement: (...args: unknown[]) => updateAnnouncementMock(...args),
  deleteAnnouncement: (...args: unknown[]) => deleteAnnouncementMock(...args),
  publishAnnouncement: (...args: unknown[]) => publishAnnouncementMock(...args),
  markAnnouncementRead: (...args: unknown[]) => markAnnouncementReadMock(...args),
  listAnnouncementReaders: (...args: unknown[]) => listAnnouncementReadersMock(...args),
}));

import { GET as listGET, POST as createPOST } from '@/app/api/v1/hrm/admin-ops/announcements/route';
import {
  DELETE as deleteDELETE,
  GET as detailGET,
  PATCH as updatePATCH,
} from '@/app/api/v1/hrm/admin-ops/announcements/[id]/route';
import { POST as publishPOST } from '@/app/api/v1/hrm/admin-ops/announcements/[id]/publish/route';
import { POST as readPOST } from '@/app/api/v1/hrm/admin-ops/announcements/[id]/read/route';
import { GET as readersGET } from '@/app/api/v1/hrm/admin-ops/announcements/[id]/readers/route';

const HR_MANAGER_AUTH = {
  userId: 3,
  email: 'hr@operonhub.local',
  fullName: 'Trưởng phòng Nhân sự',
  avatarUrl: null,
  status: 'ACTIVE' as const,
  roles: [{ id: 3, code: 'HR_MANAGER', name: 'Trưởng phòng Nhân sự', dataScope: 'ALL' as const, branchId: null }],
  permissions: ['hrm.announcements.read', 'hrm.announcements.manage'],
  dataScope: 'ALL' as const,
  isSuperAdmin: false,
  hasAllBranches: true,
  branchIds: [1],
  branches: [],
};

const EMPLOYEE_AUTH = {
  userId: 9,
  email: 'emp@operonhub.local',
  fullName: 'Nhân viên',
  avatarUrl: null,
  status: 'ACTIVE' as const,
  roles: [{ id: 8, code: 'EMPLOYEE', name: 'Nhân viên', dataScope: 'OWN' as const, branchId: 1 }],
  permissions: ['hrm.announcements.read'],
  dataScope: 'OWN' as const,
  isSuperAdmin: false,
  hasAllBranches: false,
  branchIds: [1],
  branches: [],
};

function makeReq(url: string, init?: { method?: string; body?: unknown }): NextRequest {
  return new NextRequest(url, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

describe('HRM Admin Ops — Internal Announcements APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessTokenMock.mockResolvedValue({ sub: '3', email: 'hr@operonhub.local', type: 'access' });
    loadAuthContextMock.mockResolvedValue(HR_MANAGER_AUTH);
  });

  it('blocks EMPLOYEE from managing announcements or viewing reader stats while allowing read & mark-read', async () => {
    loadAuthContextMock.mockResolvedValue(EMPLOYEE_AUTH);

    const createBlocked = await createPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements', {
        method: 'POST',
        body: { title: 'Thông báo thử', content: 'Nội dung thử nghiệm dài hơn 10 ký tự', category: 'GENERAL' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(createBlocked.status).toBe(403);

    const readersBlocked = await readersGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements/1/readers'),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(readersBlocked.status).toBe(403);

    markAnnouncementReadMock.mockResolvedValueOnce({
      announcementId: 1,
      isRead: true,
      readAt: '2026-11-23T10:00:00.000Z',
      readCount: 2,
      targetEmployeeCount: 3,
      readRatePercent: 66.7,
    });
    const readRes = await readPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements/1/read', { method: 'POST' }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(readRes.status).toBe(200);
    const readJson = await readRes.json();
    expect(readJson.data.isRead).toBe(true);
    expect(readJson.data.readRatePercent).toBe(66.7);
  });

  it('supports full announcement lifecycle: create, list, detail, update, publish (409 on re-publish), readers and soft delete', async () => {
    createAnnouncementMock.mockResolvedValueOnce({ id: 5, status: 'DRAFT', category: 'URGENT' });
    const createRes = await createPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements', {
        method: 'POST',
        body: {
          branchId: null,
          title: 'Thông báo bảo trì hệ thống khẩn cấp',
          content: 'Hệ thống sẽ tiến hành bảo trì nâng cấp định kỳ vào lúc 22:00 tối nay.',
          category: 'URGENT',
          isPinned: true,
          publishNow: false,
        },
      }),
      { params: Promise.resolve({}) },
    );
    expect(createRes.status).toBe(201);

    listAnnouncementsMock.mockResolvedValueOnce({
      items: [{ id: 5, title: 'Thông báo bảo trì hệ thống khẩn cấp' }],
      stats: { total: 1, unreadCount: 0, pinnedCount: 1, urgentCount: 0 },
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const listRes = await listGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements'),
      { params: Promise.resolve({}) },
    );
    expect(listRes.status).toBe(200);

    getAnnouncementDetailMock.mockResolvedValueOnce({ id: 5, status: 'DRAFT' });
    const detailRes = await detailGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements/5'),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(detailRes.status).toBe(200);

    updateAnnouncementMock.mockResolvedValueOnce({ id: 5, isPinned: true });
    const patchRes = await updatePATCH(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements/5', {
        method: 'PATCH',
        body: { isPinned: true },
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(patchRes.status).toBe(200);

    publishAnnouncementMock.mockResolvedValueOnce({ id: 5, status: 'PUBLISHED' });
    const pubRes = await publishPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements/5/publish', { method: 'POST' }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(pubRes.status).toBe(200);

    publishAnnouncementMock.mockRejectedValueOnce(
      new AppError('ANNOUNCEMENT_ALREADY_PUBLISHED', 'Đã xuất bản', 409),
    );
    const rePubRes = await publishPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements/5/publish', { method: 'POST' }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(rePubRes.status).toBe(409);

    listAnnouncementReadersMock.mockResolvedValueOnce({
      summary: { targetEmployeeCount: 3, readCount: 1, unreadCount: 2, readRatePercent: 33.3 },
      items: [],
    });
    const readersRes = await readersGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements/5/readers?filter=unread'),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(readersRes.status).toBe(200);

    deleteAnnouncementMock.mockResolvedValueOnce(undefined);
    const delRes = await deleteDELETE(
      makeReq('http://localhost/api/v1/hrm/admin-ops/announcements/5', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(delRes.status).toBe(200);
  });
});
