import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import {
  deletePayrollPeriod,
  getPayrollPeriodDetail,
} from '@/modules/hrm/payroll/payroll.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID kỳ lương không hợp lệ.', 400);
    }

    const sp = request.nextUrl.searchParams;
    const result = await getPayrollPeriodDetail(id, auth, {
      departmentId: sp.get('departmentId'),
      search: sp.get('search'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });

    return ok({ period: result.period, payslips: result.payslips }, result.meta);
  },
  { permission: 'hrm.payroll.read' },
);

export const DELETE = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID kỳ lương không hợp lệ.', 400);
    }

    await deletePayrollPeriod(id, auth, getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'hrm.payroll.manage' },
);
