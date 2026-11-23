import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createRoomBookingSchema } from '@/modules/hrm/office/meeting-rooms.schema';
import { createRoomBooking, listRoomBookings } from '@/modules/hrm/office/meeting-rooms.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listRoomBookings(auth, {
      branchId: sp.get('branchId'),
      roomId: sp.get('roomId'),
      status: sp.get('status'),
      dateFrom: sp.get('dateFrom'),
      dateTo: sp.get('dateTo'),
      mineOnly: sp.get('mineOnly'),
      search: sp.get('search'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok({ items: result.items }, result.meta);
  },
  { permission: 'hrm.rooms.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createRoomBookingSchema.parse(rawBody);
    const booking = await createRoomBooking(input, auth, getRequestIp(request));
    return created({ booking });
  },
  { permission: 'hrm.rooms.book' },
);
