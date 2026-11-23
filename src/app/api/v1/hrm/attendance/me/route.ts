import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { getMyAttendance } from '@/modules/hrm/attendance/attendance-logs.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  const sp = request.nextUrl.searchParams;
  const data = await getMyAttendance(auth, {
    year: sp.get('year'),
    month: sp.get('month'),
  });
  return ok(data);
});
