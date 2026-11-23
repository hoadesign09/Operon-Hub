import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createWorkShiftSchema } from '@/modules/hrm/attendance/attendance.schema';
import { createWorkShift, listWorkShifts } from '@/modules/hrm/attendance/shifts.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest) => {
    const sp = request.nextUrl.searchParams;
    const items = await listWorkShifts({
      branchId: sp.get('branchId'),
      isActive: sp.get('isActive'),
      search: sp.get('search'),
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

    const input = createWorkShiftSchema.parse(rawBody);
    const shift = await createWorkShift(input, auth, getRequestIp(request));
    return created({ shift });
  },
  { permission: 'hrm.attendance.manage' },
);
