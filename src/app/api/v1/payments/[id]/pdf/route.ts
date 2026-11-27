import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { generatePaymentPdf } from '@/modules/payments/payments-reports.service';
import { AppError } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const paymentId = Number(id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      throw new AppError('INVALID_ID', 'ID đề nghị thanh toán không hợp lệ.', 400);
    }
    const { filename, buffer } = await generatePaymentPdf(auth, paymentId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  },
  { permission: 'payments.read' },
);
