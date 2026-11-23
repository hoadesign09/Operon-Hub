import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateAttendanceSummarySchema } from '@/modules/hrm/attendance/attendance-summary.schema';
import { updateAttendanceSummaryManual } from '@/modules/hrm/attendance/attendance-summaries.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID bảng công tháng không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = updateAttendanceSummarySchema.parse(rawBody);
    const summary = await updateAttendanceSummaryManual(
      id,
      input,
      auth,
      getRequestIp(request),
    );
    return ok({ summary });
  },
  { permission: 'hrm.attendance.manage' },
);
