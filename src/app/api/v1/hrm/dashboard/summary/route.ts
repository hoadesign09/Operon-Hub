import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { getHrmDashboardSummary } from '@/modules/hrm/dashboard/dashboard.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const summary = await getHrmDashboardSummary(auth, {
      branchId: sp.get('branchId'),
      year: sp.get('year'),
      month: sp.get('month'),
    });
    return ok(summary);
  },
  { permission: 'hrm.dashboard.read' },
);
