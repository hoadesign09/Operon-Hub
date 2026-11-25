import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { getPortfolioDashboardSummary } from '@/modules/projects/reports.service';
import { ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const branchParam = request.nextUrl.searchParams.get('branchId');
    const branchId = branchParam && /^\d+$/.test(branchParam) ? Number(branchParam) : undefined;
    return ok(await getPortfolioDashboardSummary(auth, branchId));
  },
  { permission: 'pm.dashboard.read' },
);
