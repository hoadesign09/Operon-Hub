import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { cancelBusinessTripRequest } from '@/modules/hrm/requests/business-trip-requests.service';
import { cancelRequestCommentSchema } from '@/modules/hrm/requests/ot-trip.schema';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID đơn công tác không hợp lệ.', 400);
  }

  const rawBody = await request.json().catch(() => ({}));
  const input = cancelRequestCommentSchema.parse(rawBody ?? {});
  const businessTripRequest = await cancelBusinessTripRequest(
    id,
    input.comment,
    auth,
    getRequestIp(request),
  );
  return ok({ businessTripRequest });
});
