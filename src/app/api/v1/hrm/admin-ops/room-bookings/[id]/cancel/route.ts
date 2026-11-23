import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { cancelRoomBookingSchema } from '@/modules/hrm/office/meeting-rooms.schema';
import { cancelRoomBooking } from '@/modules/hrm/office/meeting-rooms.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID lịch đặt phòng không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = cancelRoomBookingSchema.parse(rawBody);
    const booking = await cancelRoomBooking(id, input, auth, getRequestIp(request));
    return ok({ booking });
  },
  { permission: 'hrm.rooms.book' },
);
