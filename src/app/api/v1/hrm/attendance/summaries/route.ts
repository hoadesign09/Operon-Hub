import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listAttendanceSummaries } from '@/modules/hrm/attendance/attendance-summaries.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listAttendanceSummaries(auth, {
      year: sp.get('year'),
      month: sp.get('month'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      status: sp.get('status'),
      search: sp.get('search'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok({ items: result.items, stats: result.stats }, result.meta);
  },
  { permission: 'hrm.attendance.read' },
);
