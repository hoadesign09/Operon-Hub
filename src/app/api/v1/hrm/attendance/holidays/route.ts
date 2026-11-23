import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createHolidaySchema } from '@/modules/hrm/attendance/attendance.schema';
import { createHoliday, listHolidays } from '@/modules/hrm/attendance/holidays.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest) => {
    const sp = request.nextUrl.searchParams;
    const items = await listHolidays({
      year: sp.get('year'),
      branchId: sp.get('branchId'),
    });
    return ok({ items });
  },
  { permission: 'hrm.attendance.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createHolidaySchema.parse(rawBody);
    const holiday = await createHoliday(input, auth, getRequestIp(request));
    return created({ holiday });
  },
  { permission: 'hrm.attendance.manage' },
);
