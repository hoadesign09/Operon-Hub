import { withAuth } from '@/middlewares/auth';
import { createPaymentDisbursementSchema } from '@/modules/payments/payments.schema';
import { recordPaymentDisbursement } from '@/modules/payments/payments-disbursement.service';
import { AppError, created } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const paymentId = Number(id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      throw new AppError('INVALID_ID', 'ID đề nghị thanh toán không hợp lệ.', 400);
    }
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu giải ngân không đúng định dạng JSON.', 400);
    }
    const input = createPaymentDisbursementSchema.parse(rawBody);
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    const detail = await recordPaymentDisbursement(auth, paymentId, input, ip);
    return created(detail);
  },
  { permission: 'payments.disburse' },
);
