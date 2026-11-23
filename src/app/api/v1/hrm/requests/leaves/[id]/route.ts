import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateLeaveRequestSchema } from '@/modules/hrm/requests/leaves.schema';
import {
  getLeaveRequestDetail,
  softDeleteLeaveRequest,
  updateLeaveRequest,
} from '@/modules/hrm/requests/leave-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositiveId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID đơn nghỉ phép không hợp lệ.', 400);
  }
  return id;
}

export const GET = withAuth<{ id: string }>(async (_request, context, auth) => {
  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);
  const leaveRequest = await getLeaveRequestDetail(id, auth);
  return ok({ leaveRequest });
});

export const PATCH = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
  }

  const input = updateLeaveRequestSchema.parse(rawBody);
  const leaveRequest = await updateLeaveRequest(id, input, auth, getRequestIp(request));
  return ok({ leaveRequest });
});

export const DELETE = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);
  const result = await softDeleteLeaveRequest(id, auth, getRequestIp(request));
  return ok(result);
});
