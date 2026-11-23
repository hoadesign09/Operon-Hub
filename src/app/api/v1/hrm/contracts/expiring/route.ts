import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listExpiringContracts } from '@/modules/hrm/contracts/contracts.service';
import { ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listExpiringContracts(auth, {
      days: sp.get('days'),
      branchId: sp.get('branchId'),
    });
    return ok(result);
  },
  { permission: 'hrm.contracts.read' },
);
