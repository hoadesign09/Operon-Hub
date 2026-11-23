import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateMeetingRoomSchema } from '@/modules/hrm/office/meeting-rooms.schema';
import {
  deleteMeetingRoom,
  getMeetingRoomDetail,
  updateMeetingRoom,
} from '@/modules/hrm/office/meeting-rooms.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID phòng họp không hợp lệ.', 400);
    }

    const room = await getMeetingRoomDetail(id, auth);
    return ok({ room });
  },
  { permission: 'hrm.rooms.read' },
);

export const PATCH = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID phòng họp không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = updateMeetingRoomSchema.parse(rawBody);
    const room = await updateMeetingRoom(id, input, auth, getRequestIp(request));
    return ok({ room });
  },
  { permission: 'hrm.rooms.manage' },
);

export const DELETE = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID phòng họp không hợp lệ.', 400);
    }

    await deleteMeetingRoom(id, auth, getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'hrm.rooms.manage' },
);
