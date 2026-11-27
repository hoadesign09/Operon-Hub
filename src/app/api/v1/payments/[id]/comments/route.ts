import { withAuth } from '@/middlewares/auth';
import { createPaymentCommentSchema } from '@/modules/payments/payments.schema';
import {
  createPaymentComment,
  listPaymentComments,
} from '@/modules/payments/payments-collab.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID đề nghị thanh toán không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const items = await listPaymentComments(auth, parseId(id));
    return ok(items);
  },
  { permission: 'payments.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu bình luận không đúng định dạng JSON.', 400);
    }
    const input = createPaymentCommentSchema.parse(rawBody);
    const items = await createPaymentComment(auth, parseId(id), input);
    return created(items);
  },
  { permission: 'payments.read' },
);
