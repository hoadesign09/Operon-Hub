import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { assignItRequestSchema } from '@/modules/it-requests/it-requests.schema';
import { assignItRequest } from '@/modules/it-requests/it-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const ticketId = Number(id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      throw new AppError('INVALID_ID', 'ID yêu cầu IT không hợp lệ.', 400);
    }
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = assignItRequestSchema.parse(rawBody);
    const detail = await assignItRequest(auth, ticketId, input);
    return ok(detail);
  },
  { permission: IT_REQUEST_PERMISSIONS.MANAGE },
);
