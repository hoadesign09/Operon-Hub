import { withAuth } from '@/middlewares/auth';
import { ensureApprovalHooksRegistered } from '@/modules/approvals/register-module-hooks';
import { updatePaymentSchema } from '@/modules/payments/payments.schema';
import {
  deletePaymentRequest,
  getPaymentDetail,
  updatePaymentRequest,
} from '@/modules/payments/payments.service';
import { AppError, ok } from '@/shared/api-response';

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
    ensureApprovalHooksRegistered();
    const { id } = await context.params;
    const detail = await getPaymentDetail(auth, parseId(id));
    return ok(detail);
  },
  { permission: 'payments.read' },
);

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu cập nhật không đúng định dạng JSON.', 400);
    }
    const input = updatePaymentSchema.parse(rawBody);
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    const detail = await updatePaymentRequest(auth, parseId(id), input, ip);
    return ok(detail);
  },
  { permission: 'payments.create' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    await deletePaymentRequest(auth, parseId(id), ip);
    return ok({ deleted: true });
  },
  { permission: 'payments.create' },
);
