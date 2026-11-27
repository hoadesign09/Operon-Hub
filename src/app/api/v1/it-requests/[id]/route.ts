import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { updateItRequestSchema } from '@/modules/it-requests/it-requests.schema';
import {
  deleteItRequest,
  getItRequestDetail,
  updateItRequest,
} from '@/modules/it-requests/it-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID yêu cầu IT không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const detail = await getItRequestDetail(auth, parseId(id));
    return ok(detail);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = updateItRequestSchema.parse(rawBody);
    const detail = await updateItRequest(auth, parseId(id), input);
    return ok(detail);
  },
  { permission: IT_REQUEST_PERMISSIONS.CREATE },
);

export const DELETE = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    await deleteItRequest(auth, parseId(id));
    return ok({ deleted: true });
  },
  { permission: IT_REQUEST_PERMISSIONS.CREATE },
);
