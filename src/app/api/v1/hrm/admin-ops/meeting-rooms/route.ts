import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createMeetingRoomSchema } from '@/modules/hrm/office/meeting-rooms.schema';
import { createMeetingRoom, listMeetingRooms } from '@/modules/hrm/office/meeting-rooms.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listMeetingRooms(auth, {
      branchId: sp.get('branchId'),
      isActive: sp.get('isActive'),
      minCapacity: sp.get('minCapacity'),
      search: sp.get('search'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok({ items: result.items, stats: result.stats }, result.meta);
  },
  { permission: 'hrm.rooms.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createMeetingRoomSchema.parse(rawBody);
    const room = await createMeetingRoom(input, auth, getRequestIp(request));
    return created({ room });
  },
  { permission: 'hrm.rooms.manage' },
);
