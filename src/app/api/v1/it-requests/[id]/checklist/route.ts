import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { createItChecklistItemSchema } from '@/modules/it-requests/it-requests.schema';
import {
  createItChecklistItem,
  listItChecklistItems,
} from '@/modules/it-requests/it-requests-collab.service';
import { AppError, created, ok } from '@/shared/api-response';

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
    const items = await listItChecklistItems(auth, parseId(id));
    return ok(items);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = createItChecklistItemSchema.parse(rawBody);
    const items = await createItChecklistItem(auth, parseId(id), input);
    return created(items);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);
