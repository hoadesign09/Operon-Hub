import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { getMyAttendanceSummary } from '@/modules/hrm/attendance/attendance-summaries.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  const sp = request.nextUrl.searchParams;
  const summary = await getMyAttendanceSummary(auth, {
    year: sp.get('year'),
    month: sp.get('month'),
  });
  return ok({ summary });
});
