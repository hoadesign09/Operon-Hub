import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listLeaveBalances } from '@/modules/hrm/requests/leave-balances.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  const sp = request.nextUrl.searchParams;
  const result = await listLeaveBalances(auth, {
    year: sp.get('year'),
    mine: sp.get('mine'),
    branchId: sp.get('branchId'),
    employeeId: sp.get('employeeId'),
    leaveTypeId: sp.get('leaveTypeId'),
    search: sp.get('search'),
    page: sp.get('page'),
    limit: sp.get('limit'),
  });

  return ok({ items: result.items, year: result.year }, result.meta);
});
