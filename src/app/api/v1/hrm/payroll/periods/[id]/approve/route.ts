import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { approvePayrollPeriod } from '@/modules/hrm/payroll/payroll.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID kỳ lương không hợp lệ.', 400);
    }

    const period = await approvePayrollPeriod(id, auth, getRequestIp(request));
    return ok({ period });
  },
  { permission: 'hrm.payroll.approve' },
);
