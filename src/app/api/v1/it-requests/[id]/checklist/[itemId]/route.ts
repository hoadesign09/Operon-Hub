import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { updateItChecklistItemSchema } from '@/modules/it-requests/it-requests.schema';
import {
  deleteItChecklistItem,
  updateItChecklistItem,
} from '@/modules/it-requests/it-requests-collab.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositiveId(raw: string, label: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', `${label} không hợp lệ.`, 400);
  }
  return num;
}

export const PATCH = withAuth<{ id: string; itemId: string }>(
  async (request, context, auth) => {
    const { id, itemId } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = updateItChecklistItemSchema.parse(rawBody);
    const items = await updateItChecklistItem(
      auth,
      parsePositiveId(id, 'ID yêu cầu IT'),
      parsePositiveId(itemId, 'ID checklist'),
      input,
    );
    return ok(items);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);

export const DELETE = withAuth<{ id: string; itemId: string }>(
  async (_request, context, auth) => {
    const { id, itemId } = await context.params;
    const items = await deleteItChecklistItem(
      auth,
      parsePositiveId(id, 'ID yêu cầu IT'),
      parsePositiveId(itemId, 'ID checklist'),
    );
    return ok(items);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);
