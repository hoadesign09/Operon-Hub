import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { initializeLeaveBalancesForYear } from '@/modules/hrm/requests/leave-balances.service';
import { initializeLeaveBalancesSchema } from '@/modules/hrm/requests/leaves.schema';
import { AppError, created } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = initializeLeaveBalancesSchema.parse(rawBody);
    const result = await initializeLeaveBalancesForYear(
      input,
      auth,
      getRequestIp(request),
    );
    return created(result);
  },
  { permission: 'hrm.requests.manage' },
);
