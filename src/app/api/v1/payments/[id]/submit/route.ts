import { withAuth } from '@/middlewares/auth';
import { ensureApprovalHooksRegistered } from '@/modules/approvals/register-module-hooks';
import { submitPaymentRequest } from '@/modules/payments/payments.service';
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
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    const detail = await submitPaymentRequest(auth, paymentId, ip);
    return ok(detail);
  },
  { permission: 'payments.create' },
);
