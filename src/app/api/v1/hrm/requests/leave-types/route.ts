import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createLeaveTypeSchema } from '@/modules/hrm/requests/leaves.schema';
import {
  createLeaveType,
  listLeaveTypes,
} from '@/modules/hrm/requests/leave-types.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest) => {
  const activeOnlyParam = request.nextUrl.searchParams.get('activeOnly');
  const activeOnly = activeOnlyParam === 'true' || activeOnlyParam === '1';
  const items = await listLeaveTypes({ activeOnly });
  return ok({ items });
});

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createLeaveTypeSchema.parse(rawBody);
    const leaveType = await createLeaveType(input, auth, getRequestIp(request));
    return created({ leaveType });
  },
  { permission: 'hrm.requests.manage' },
);
