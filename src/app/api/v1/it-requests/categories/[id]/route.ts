import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { updateItCategorySchema } from '@/modules/it-requests/it-requests.schema';
import { deleteItCategory, updateItCategory } from '@/modules/it-requests/it-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID danh mục không hợp lệ.', 400);
  }
  return num;
}

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = updateItCategorySchema.parse(rawBody);
    const updated = await updateItCategory(auth, parseId(id), input);
    return ok(updated);
  },
  { permission: IT_REQUEST_PERMISSIONS.MANAGE },
);

export const DELETE = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    await deleteItCategory(auth, parseId(id));
    return ok({ deleted: true });
  },
  { permission: IT_REQUEST_PERMISSIONS.MANAGE },
);
