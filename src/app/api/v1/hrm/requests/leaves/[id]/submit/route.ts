import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { submitLeaveRequest } from '@/modules/hrm/requests/leave-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID đơn nghỉ phép không hợp lệ.', 400);
  }

  const leaveRequest = await submitLeaveRequest(id, auth, getRequestIp(request));
  return ok({ leaveRequest });
});
