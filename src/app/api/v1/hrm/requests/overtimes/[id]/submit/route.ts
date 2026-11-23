import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { submitOvertimeRequest } from '@/modules/hrm/requests/overtime-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID đơn tăng ca không hợp lệ.', 400);
  }

  const overtimeRequest = await submitOvertimeRequest(id, auth, getRequestIp(request));
  return ok({ overtimeRequest });
});
