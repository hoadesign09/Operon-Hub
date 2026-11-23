import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateOvertimeRequestSchema } from '@/modules/hrm/requests/ot-trip.schema';
import {
  getOvertimeRequestDetail,
  softDeleteOvertimeRequest,
  updateOvertimeRequest,
} from '@/modules/hrm/requests/overtime-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositiveId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID đơn tăng ca không hợp lệ.', 400);
  }
  return id;
}

export const GET = withAuth<{ id: string }>(async (_request, context, auth) => {
  const { id: rawId } = await context.params;
  const overtimeRequest = await getOvertimeRequestDetail(parsePositiveId(rawId), auth);
  return ok({ overtimeRequest });
});

export const PATCH = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
  }

  const input = updateOvertimeRequestSchema.parse(rawBody);
  const overtimeRequest = await updateOvertimeRequest(id, input, auth, getRequestIp(request));
  return ok({ overtimeRequest });
});

export const DELETE = withAuth<{ id: string }>(async (request: NextRequest, context, auth) => {
  const { id: rawId } = await context.params;
  const result = await softDeleteOvertimeRequest(
    parsePositiveId(rawId),
    auth,
    getRequestIp(request),
  );
  return ok(result);
});
