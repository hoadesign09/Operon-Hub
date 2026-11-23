import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listMyPayslips } from '@/modules/hrm/payroll/payroll.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  const sp = request.nextUrl.searchParams;
  const result = await listMyPayslips(auth, {
    year: sp.get('year'),
  });
  return ok(result);
});
