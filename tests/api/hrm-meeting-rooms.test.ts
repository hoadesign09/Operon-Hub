import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();

const listMeetingRoomsMock = vi.fn();
const listAvailableMeetingRoomsMock = vi.fn();
const createMeetingRoomMock = vi.fn();
const getMeetingRoomDetailMock = vi.fn();
const updateMeetingRoomMock = vi.fn();
const deleteMeetingRoomMock = vi.fn();
const listRoomBookingsMock = vi.fn();
const createRoomBookingMock = vi.fn();
const getRoomBookingDetailMock = vi.fn();
const updateRoomBookingMock = vi.fn();
const cancelRoomBookingMock = vi.fn();

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

vi.mock('@/modules/hrm/office/meeting-rooms.service', () => ({
  listMeetingRooms: (...args: unknown[]) => listMeetingRoomsMock(...args),
  listAvailableMeetingRooms: (...args: unknown[]) => listAvailableMeetingRoomsMock(...args),
  createMeetingRoom: (...args: unknown[]) => createMeetingRoomMock(...args),
  getMeetingRoomDetail: (...args: unknown[]) => getMeetingRoomDetailMock(...args),
  updateMeetingRoom: (...args: unknown[]) => updateMeetingRoomMock(...args),
  deleteMeetingRoom: (...args: unknown[]) => deleteMeetingRoomMock(...args),
  listRoomBookings: (...args: unknown[]) => listRoomBookingsMock(...args),
  createRoomBooking: (...args: unknown[]) => createRoomBookingMock(...args),
  getRoomBookingDetail: (...args: unknown[]) => getRoomBookingDetailMock(...args),
  updateRoomBooking: (...args: unknown[]) => updateRoomBookingMock(...args),
  cancelRoomBooking: (...args: unknown[]) => cancelRoomBookingMock(...args),
}));

import { GET as roomsGET, POST as roomsPOST } from '@/app/api/v1/hrm/admin-ops/meeting-rooms/route';
import { GET as availableRoomsGET } from '@/app/api/v1/hrm/admin-ops/meeting-rooms/available/route';
import {
  DELETE as roomDELETE,
  GET as roomDetailGET,
  PATCH as roomPATCH,
} from '@/app/api/v1/hrm/admin-ops/meeting-rooms/[id]/route';
import { GET as bookingsGET, POST as bookingsPOST } from '@/app/api/v1/hrm/admin-ops/room-bookings/route';
import {
  DELETE as bookingDELETE,
  GET as bookingDetailGET,
  PATCH as bookingPATCH,
} from '@/app/api/v1/hrm/admin-ops/room-bookings/[id]/route';
import { POST as cancelPOST } from '@/app/api/v1/hrm/admin-ops/room-bookings/[id]/cancel/route';

const ADMIN_OPS_AUTH = {
  userId: 6,
  email: 'adminops@operonhub.local',
  fullName: 'Hành chính Văn phòng',
  avatarUrl: null,
  status: 'ACTIVE' as const,
  roles: [{ id: 6, code: 'ADMIN_OPS', name: 'Hành chính Văn phòng', dataScope: 'BRANCH' as const, branchId: 1 }],
  permissions: ['hrm.rooms.read', 'hrm.rooms.book', 'hrm.rooms.manage'],
  dataScope: 'BRANCH' as const,
  isSuperAdmin: false,
  hasAllBranches: false,
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
  permissions: ['hrm.rooms.read', 'hrm.rooms.book'],
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

describe('HRM Admin Ops — Meeting Rooms & Room Bookings APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessTokenMock.mockResolvedValue({ sub: '6', email: 'adminops@operonhub.local', type: 'access' });
    loadAuthContextMock.mockResolvedValue(ADMIN_OPS_AUTH);
  });

  it('enforces RBAC on meeting room CRUD and handles 409 upcoming bookings on delete', async () => {
    loadAuthContextMock.mockResolvedValueOnce(EMPLOYEE_AUTH);
    const forbiddenRes = await roomsPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/meeting-rooms', {
        method: 'POST',
        body: { branchId: 1, code: 'PH-04', name: 'Phòng mới', capacity: 8 },
      }),
      { params: Promise.resolve({}) },
    );
    expect(forbiddenRes.status).toBe(403);

    listMeetingRoomsMock.mockResolvedValueOnce({
      items: [{ id: 1, code: 'PH-01', name: 'Phòng họp Lớn', capacity: 16 }],
      stats: { total: 1, active: 1, inactive: 0, todayBookings: 2 },
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    const listRes = await roomsGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/meeting-rooms'),
      { params: Promise.resolve({}) },
    );
    expect(listRes.status).toBe(200);

    createMeetingRoomMock.mockResolvedValueOnce({ id: 4, code: 'PH-04', name: 'Phòng Sáng tạo' });
    const createRes = await roomsPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/meeting-rooms', {
        method: 'POST',
        body: { branchId: 1, code: 'PH-04', name: 'Phòng Sáng tạo', capacity: 10 },
      }),
      { params: Promise.resolve({}) },
    );
    expect(createRes.status).toBe(201);

    getMeetingRoomDetailMock.mockResolvedValueOnce({ id: 4, code: 'PH-04' });
    const detailRes = await roomDetailGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/meeting-rooms/4'),
      { params: Promise.resolve({ id: '4' }) },
    );
    expect(detailRes.status).toBe(200);

    updateMeetingRoomMock.mockResolvedValueOnce({ id: 4, capacity: 12 });
    const patchRes = await roomPATCH(
      makeReq('http://localhost/api/v1/hrm/admin-ops/meeting-rooms/4', {
        method: 'PATCH',
        body: { capacity: 12 },
      }),
      { params: Promise.resolve({ id: '4' }) },
    );
    expect(patchRes.status).toBe(200);

    deleteMeetingRoomMock.mockRejectedValueOnce(
      new AppError('ROOM_HAS_UPCOMING_BOOKINGS', 'Phòng đang có lịch đặt sắp tới', 409),
    );
    const conflictDeleteRes = await roomDELETE(
      makeReq('http://localhost/api/v1/hrm/admin-ops/meeting-rooms/4', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '4' }) },
    );
    expect(conflictDeleteRes.status).toBe(409);
  });

  it('handles room booking creation, 409 double-booking conflict, update and cancellation', async () => {
    loadAuthContextMock.mockResolvedValue(EMPLOYEE_AUTH);

    listRoomBookingsMock.mockResolvedValueOnce({
      items: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
    });
    const listRes = await bookingsGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/room-bookings?dateFrom=2026-11-23&dateTo=2026-11-29'),
      { params: Promise.resolve({}) },
    );
    expect(listRes.status).toBe(200);

    createRoomBookingMock.mockResolvedValueOnce({ id: 10, title: 'Họp Sprint', status: 'PENDING' });
    const createdRes = await bookingsPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/room-bookings', {
        method: 'POST',
        body: {
          roomId: 1,
          title: 'Họp Sprint',
          startTime: '2026-11-24T09:00',
          endTime: '2026-11-24T10:00',
          attendeesCount: 5,
        },
      }),
      { params: Promise.resolve({}) },
    );
    expect(createdRes.status).toBe(201);

    createRoomBookingMock.mockRejectedValueOnce(
      new AppError('ROOM_BOOKING_CONFLICT', 'Trùng lịch phòng họp', 409, [
        { field: 'timeRange', message: '"Họp Sprint" (24/11/2026 09:00 – 24/11/2026 10:00)' },
      ]),
    );
    const conflictRes = await bookingsPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/room-bookings', {
        method: 'POST',
        body: {
          roomId: 1,
          title: 'Họp khác trùng giờ',
          startTime: '2026-11-24T09:30',
          endTime: '2026-11-24T10:30',
          attendeesCount: 4,
        },
      }),
      { params: Promise.resolve({}) },
    );
    expect(conflictRes.status).toBe(409);
    const conflictJson = await conflictRes.json();
    expect(conflictJson.error.code).toBe('ROOM_BOOKING_CONFLICT');
    expect(conflictJson.error.details).toHaveLength(1);

    getRoomBookingDetailMock.mockResolvedValueOnce({ id: 10, title: 'Họp Sprint' });
    const detailRes = await bookingDetailGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/room-bookings/10'),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(detailRes.status).toBe(200);

    updateRoomBookingMock.mockResolvedValueOnce({ id: 10, title: 'Họp Sprint (Cập nhật)' });
    const patchRes = await bookingPATCH(
      makeReq('http://localhost/api/v1/hrm/admin-ops/room-bookings/10', {
        method: 'PATCH',
        body: { title: 'Họp Sprint (Cập nhật)' },
      }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(patchRes.status).toBe(200);

    // Cancel missing reason -> 400
    const badCancelRes = await cancelPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/room-bookings/10/cancel', {
        method: 'POST',
        body: { cancelReason: 'x' },
      }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(badCancelRes.status).toBe(400);

    cancelRoomBookingMock.mockResolvedValueOnce({ id: 10, status: 'CANCELLED' });
    const cancelRes = await cancelPOST(
      makeReq('http://localhost/api/v1/hrm/admin-ops/room-bookings/10/cancel', {
        method: 'POST',
        body: { cancelReason: 'Dời sang chiều thứ Sáu' },
      }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(cancelRes.status).toBe(200);

    // Direct hard delete of room booking MUST be rejected with 405
    const hardDeleteRes = await bookingDELETE(
      makeReq('http://localhost/api/v1/hrm/admin-ops/room-bookings/10', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(hardDeleteRes.status).toBe(405);
    const hardDeleteJson = await hardDeleteRes.json();
    expect(hardDeleteJson.error.code).toBe('BOOKING_HARD_DELETE_FORBIDDEN');
  });

  it('validates and returns only available meeting rooms for a selected time slot', async () => {
    loadAuthContextMock.mockResolvedValue(EMPLOYEE_AUTH);

    // Missing query params -> 400
    const missingParamsRes = await availableRoomsGET(
      makeReq('http://localhost/api/v1/hrm/admin-ops/meeting-rooms/available'),
      { params: Promise.resolve({}) },
    );
    expect(missingParamsRes.status).toBe(400);

    // Valid slot -> returns only available rooms
    listAvailableMeetingRoomsMock.mockResolvedValueOnce({
      availableRooms: [{ id: 2, code: 'PH-02', name: 'Phòng Sáng tạo', capacity: 8 }],
      totalActiveRooms: 3,
      busyRoomsCount: 2,
    });
    const availRes = await availableRoomsGET(
      makeReq(
        'http://localhost/api/v1/hrm/admin-ops/meeting-rooms/available?startTime=2026-11-25T09:00&endTime=2026-11-25T10:00&excludeBookingId=10',
      ),
      { params: Promise.resolve({}) },
    );
    expect(availRes.status).toBe(200);
    const availJson = await availRes.json();
    expect(availJson.data.availableRooms).toHaveLength(1);
    expect(availJson.data.busyRoomsCount).toBe(2);

    // Past time slot -> 400 BOOKING_IN_PAST
    listAvailableMeetingRoomsMock.mockRejectedValueOnce(
      new AppError('BOOKING_IN_PAST', 'Không thể đặt phòng họp trong quá khứ.', 400),
    );
    const pastRes = await availableRoomsGET(
      makeReq(
        'http://localhost/api/v1/hrm/admin-ops/meeting-rooms/available?startTime=2025-01-01T09:00&endTime=2025-01-01T10:00',
      ),
      { params: Promise.resolve({}) },
    );
    expect(pastRes.status).toBe(400);
    const pastJson = await pastRes.json();
    expect(pastJson.error.code).toBe('BOOKING_IN_PAST');
  });
});
