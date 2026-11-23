import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateHolidaySchema } from '@/modules/hrm/attendance/attendance.schema';
import { deleteHoliday, updateHoliday } from '@/modules/hrm/attendance/holidays.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositiveId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'ID ngày lễ không hợp lệ.', 400);
  }
  return id;
}

export const PATCH = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = parsePositiveId(params.id ?? '');
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = updateHolidaySchema.parse(rawBody);
    const holiday = await updateHoliday(id, input, auth, getRequestIp(request));
    return ok({ holiday });
  },
  { permission: 'hrm.attendance.manage' },
);

export const DELETE = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = parsePositiveId(params.id ?? '');
    const result = await deleteHoliday(id, auth, getRequestIp(request));
    return ok(result);
  },
  { permission: 'hrm.attendance.manage' },
);
