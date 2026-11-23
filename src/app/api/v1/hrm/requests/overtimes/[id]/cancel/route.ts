import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { cancelRequestCommentSchema } from '@/modules/hrm/requests/ot-trip.schema';
import { cancelOvertimeRequest } from '@/modules/hrm/requests/overtime-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID đơn tăng ca không hợp lệ.', 400);
  }

  const rawBody = await request.json().catch(() => ({}));
  const input = cancelRequestCommentSchema.parse(rawBody ?? {});
  const overtimeRequest = await cancelOvertimeRequest(
    id,
    input.comment,
    auth,
    getRequestIp(request),
  );
  return ok({ overtimeRequest });
});
