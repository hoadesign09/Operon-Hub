import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createLeaveRequestSchema } from '@/modules/hrm/requests/leaves.schema';
import {
  createLeaveRequest,
  listLeaveRequests,
} from '@/modules/hrm/requests/leave-requests.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  const sp = request.nextUrl.searchParams;
  const result = await listLeaveRequests(auth, {
    mine: sp.get('mine'),
    year: sp.get('year'),
    status: sp.get('status'),
    leaveTypeId: sp.get('leaveTypeId'),
    branchId: sp.get('branchId'),
    search: sp.get('search'),
    page: sp.get('page'),
    limit: sp.get('limit'),
  });

  return ok({ items: result.items }, result.meta);
});

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createLeaveRequestSchema.parse(rawBody);
    const leaveRequest = await createLeaveRequest(input, auth, getRequestIp(request));
    return created({ leaveRequest });
  },
  { permission: 'hrm.requests.create' },
);
