import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listAvailableMeetingRooms } from '@/modules/hrm/office/meeting-rooms.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const startTime = sp.get('startTime')?.trim() ?? '';
    const endTime = sp.get('endTime')?.trim() ?? '';

    if (!startTime || !endTime) {
      throw new AppError(
        'INVALID_BOOKING_TIME',
        'Vui lòng cung cấp đầy đủ thời gian bắt đầu và kết thúc để kiểm tra phòng trống.',
        400,
      );
    }

    const result = await listAvailableMeetingRooms(auth, {
      startTime,
      endTime,
      branchId: sp.get('branchId'),
      excludeBookingId: sp.get('excludeBookingId'),
    });

    return ok(result);
  },
  { permission: 'hrm.rooms.read' },
);
