import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { calculateSummariesSchema } from '@/modules/hrm/attendance/attendance-summary.schema';
import { calculateMonthlyAttendanceSummaries } from '@/modules/hrm/attendance/attendance-summaries.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = calculateSummariesSchema.parse(rawBody);
    const result = await calculateMonthlyAttendanceSummaries(
      input,
      auth,
      getRequestIp(request),
    );
    return ok(result);
  },
  { permission: 'hrm.attendance.manage' },
);
