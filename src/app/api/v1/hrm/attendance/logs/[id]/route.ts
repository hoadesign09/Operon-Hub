import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateManualAttendanceSchema } from '@/modules/hrm/attendance/attendance.schema';
import { updateManualAttendanceLog } from '@/modules/hrm/attendance/attendance-logs.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID bản ghi chấm công không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = updateManualAttendanceSchema.parse(rawBody);
    const log = await updateManualAttendanceLog(id, input, auth, getRequestIp(request));
    return ok({ log });
  },
  { permission: 'hrm.attendance.manage' },
);
