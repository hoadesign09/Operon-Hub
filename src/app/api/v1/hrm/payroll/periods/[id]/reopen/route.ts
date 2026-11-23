import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { reopenPayrollPeriodSchema } from '@/modules/hrm/payroll/payroll.schema';
import { reopenPayrollPeriod } from '@/modules/hrm/payroll/payroll.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID kỳ lương không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = reopenPayrollPeriodSchema.parse(rawBody);
    const period = await reopenPayrollPeriod(id, input, auth, getRequestIp(request));
    return ok({ period });
  },
  { permission: 'hrm.payroll.approve' },
);
