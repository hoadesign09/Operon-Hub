import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import {
  getBusinessTripRequestDetail,
  softDeleteBusinessTripRequest,
  updateBusinessTripRequest,
} from '@/modules/hrm/requests/business-trip-requests.service';
import { updateBusinessTripRequestSchema } from '@/modules/hrm/requests/ot-trip.schema';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositiveId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID đơn công tác không hợp lệ.', 400);
  }
  return id;
}

export const GET = withAuth<{ id: string }>(async (_request, context, auth) => {
  const { id: rawId } = await context.params;
  const businessTripRequest = await getBusinessTripRequestDetail(parsePositiveId(rawId), auth);
  return ok({ businessTripRequest });
});

export const PATCH = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
  }

  const input = updateBusinessTripRequestSchema.parse(rawBody);
  const businessTripRequest = await updateBusinessTripRequest(
    id,
    input,
    auth,
    getRequestIp(request),
  );
  return ok({ businessTripRequest });
});

export const DELETE = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const result = await softDeleteBusinessTripRequest(
    parsePositiveId(rawId),
    auth,
    getRequestIp(request),
  );
  return ok(result);
});
