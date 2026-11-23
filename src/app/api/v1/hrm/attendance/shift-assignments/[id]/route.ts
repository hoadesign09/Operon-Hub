import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { deleteShiftAssignment } from '@/modules/hrm/attendance/shifts.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const DELETE = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID phân ca không hợp lệ.', 400);
    }

    const result = await deleteShiftAssignment(id, auth, getRequestIp(request));
    return ok(result);
  },
  { permission: 'hrm.attendance.manage' },
);
