import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateRoomBookingSchema } from '@/modules/hrm/office/meeting-rooms.schema';
import { getRoomBookingDetail, updateRoomBooking } from '@/modules/hrm/office/meeting-rooms.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID lịch đặt phòng không hợp lệ.', 400);
    }

    const booking = await getRoomBookingDetail(id, auth);
    return ok({ booking });
  },
  { permission: 'hrm.rooms.read' },
);

export const PATCH = withAuth(
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

    const input = updateRoomBookingSchema.parse(rawBody);
    const booking = await updateRoomBooking(id, input, auth, getRequestIp(request));
    return ok({ booking });
  },
  { permission: 'hrm.rooms.book' },
);

export const DELETE = withAuth(
  async () => {
    throw new AppError(
      'BOOKING_HARD_DELETE_FORBIDDEN',
      'Không cho phép xóa trực tiếp lịch đặt phòng khỏi cơ sở dữ liệu. Vui lòng sử dụng chức năng Hủy lịch (Cancelled).',
      405,
    );
  },
  { permission: 'hrm.rooms.book' },
);
