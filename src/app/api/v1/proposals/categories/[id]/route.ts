import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateProposalCategorySchema } from '@/modules/proposals/proposals.schema';
import {
  softDeleteProposalCategory,
  updateProposalCategory,
} from '@/modules/proposals/proposals.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseCategoryId(raw: string): number {
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
      throw new AppError('INVALID_JSON', 'Dữ liệu cập nhật không đúng định dạng JSON.', 400);
    }
    const input = updateProposalCategorySchema.parse(rawBody);
    const updated = await updateProposalCategory(
      parseCategoryId(id),
      input,
      auth,
      getRequestIp(request),
    );
    return ok(updated);
  },
  { permission: 'proposals.manage' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    await softDeleteProposalCategory(parseCategoryId(id), auth, getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'proposals.manage' },
);
