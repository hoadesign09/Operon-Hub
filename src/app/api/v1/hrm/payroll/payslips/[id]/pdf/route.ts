import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { generatePayslipPdfBuffer } from '@/modules/hrm/payroll/payslip-pdf.service';
import { AppError } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request: NextRequest, context, auth) => {
  const params = await context.params;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'ID phiếu lương không hợp lệ.', 400);
  }

  const { buffer, fileName } = await generatePayslipPdfBuffer(id, auth);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
