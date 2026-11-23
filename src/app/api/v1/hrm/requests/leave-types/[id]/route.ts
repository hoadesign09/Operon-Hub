import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateLeaveTypeSchema } from '@/modules/hrm/requests/leaves.schema';
import {
  softDeleteLeaveType,
  updateLeaveType,
} from '@/modules/hrm/requests/leave-types.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositiveId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID loại nghỉ phép không hợp lệ.', 400);
  }
  return id;
}

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id: rawId } = await context.params;
    const id = parsePositiveId(rawId);

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = updateLeaveTypeSchema.parse(rawBody);
    const leaveType = await updateLeaveType(id, input, auth, getRequestIp(request));
    return ok({ leaveType });
  },
  { permission: 'hrm.requests.manage' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id: rawId } = await context.params;
    const id = parsePositiveId(rawId);
    const result = await softDeleteLeaveType(id, auth, getRequestIp(request));
    return ok(result);
  },
  { permission: 'hrm.requests.manage' },
);
