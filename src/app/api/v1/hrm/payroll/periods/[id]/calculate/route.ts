import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { calculatePayrollPeriodSchema } from '@/modules/hrm/payroll/payroll.schema';
import { calculatePayrollPeriod } from '@/modules/hrm/payroll/payroll.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID kỳ lương không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => ({}));
    const input = calculatePayrollPeriodSchema.parse(
      rawBody && typeof rawBody === 'object' ? rawBody : {},
    );
    const result = await calculatePayrollPeriod(id, input, auth, getRequestIp(request));
    return ok(result);
  },
  { permission: 'hrm.payroll.manage' },
);
