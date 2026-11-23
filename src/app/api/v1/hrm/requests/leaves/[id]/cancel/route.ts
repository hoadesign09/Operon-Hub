import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { cancelLeaveRequestSchema } from '@/modules/hrm/requests/leaves.schema';
import { cancelLeaveRequest } from '@/modules/hrm/requests/leave-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID đơn nghỉ phép không hợp lệ.', 400);
  }

  const rawBody = await request.json().catch(() => ({}));
  const input = cancelLeaveRequestSchema.parse(rawBody ?? {});
  const leaveRequest = await cancelLeaveRequest(
    id,
    input.comment,
    auth,
    getRequestIp(request),
  );
  return ok({ leaveRequest });
});
