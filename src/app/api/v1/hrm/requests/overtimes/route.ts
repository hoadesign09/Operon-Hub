import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createOvertimeRequestSchema } from '@/modules/hrm/requests/ot-trip.schema';
import {
  createOvertimeRequest,
  listOvertimeRequests,
} from '@/modules/hrm/requests/overtime-requests.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  const sp = request.nextUrl.searchParams;
  const result = await listOvertimeRequests(auth, {
    mine: sp.get('mine'),
    year: sp.get('year'),
    status: sp.get('status'),
    otRateType: sp.get('otRateType'),
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

    const input = createOvertimeRequestSchema.parse(rawBody);
    const overtimeRequest = await createOvertimeRequest(input, auth, getRequestIp(request));
    return created({ overtimeRequest });
  },
  { permission: 'hrm.requests.create' },
);
