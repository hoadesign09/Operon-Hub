import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportPayrollPeriodExcel } from '@/modules/hrm/payroll/payroll.service';
import { AppError } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID kỳ lương không hợp lệ.', 400);
    }

    const sp = request.nextUrl.searchParams;
    const { buffer, fileName } = await exportPayrollPeriodExcel(id, auth, {
      departmentId: sp.get('departmentId'),
      search: sp.get('search'),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  },
  { permission: 'hrm.payroll.export' },
);
