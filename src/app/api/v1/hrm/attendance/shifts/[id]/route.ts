import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateWorkShiftSchema } from '@/modules/hrm/attendance/attendance.schema';
import { deleteWorkShift, updateWorkShift } from '@/modules/hrm/attendance/shifts.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositiveId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'ID ca làm việc không hợp lệ.', 400);
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

    const input = updateWorkShiftSchema.parse(rawBody);
    const shift = await updateWorkShift(id, input, auth, getRequestIp(request));
    return ok({ shift });
  },
  { permission: 'hrm.attendance.manage' },
);

export const DELETE = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = parsePositiveId(params.id ?? '');
    const result = await deleteWorkShift(id, auth, getRequestIp(request));
    return ok(result);
  },
  { permission: 'hrm.attendance.manage' },
);
