import { withAuth } from '@/middlewares/auth';
import { ensureApprovalHooksRegistered } from '@/modules/approvals/register-module-hooks';
import { paymentStatusActionSchema } from '@/modules/payments/payments.schema';
import { transitionPaymentStatus } from '@/modules/payments/payments.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    ensureApprovalHooksRegistered();
    const { id } = await context.params;
    const paymentId = Number(id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      throw new AppError('INVALID_ID', 'ID đề nghị thanh toán không hợp lệ.', 400);
    }
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = paymentStatusActionSchema.parse(rawBody);
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    const detail = await transitionPaymentStatus(auth, paymentId, input, ip);
    return ok(detail);
  },
  { permission: 'payments.read' },
);
