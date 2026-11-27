import { withAuth } from '@/middlewares/auth';
import { updatePaymentCategorySchema } from '@/modules/payments/payments.schema';
import {
  deletePaymentCategory,
  updatePaymentCategory,
} from '@/modules/payments/payments.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID danh mục khoản chi không hợp lệ.', 400);
  }
  return num;
}

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu cập nhật danh mục không đúng định dạng JSON.', 400);
    }
    const input = updatePaymentCategorySchema.parse(rawBody);
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    const updated = await updatePaymentCategory(auth, parseId(id), input, ip);
    return ok(updated);
  },
  { permission: 'payments.manage' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    await deletePaymentCategory(auth, parseId(id), ip);
    return ok({ deleted: true });
  },
  { permission: 'payments.manage' },
);
