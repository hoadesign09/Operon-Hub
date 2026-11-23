import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updatePayslipManualSchema } from '@/modules/hrm/payroll/payroll.schema';
import {
  getPayslipDetail,
  updatePayslipManualItems,
} from '@/modules/hrm/payroll/payroll.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request: NextRequest, context, auth) => {
  const params = await context.params;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'ID phiếu lương không hợp lệ.', 400);
  }

  const payslip = await getPayslipDetail(id, auth);
  return ok({ payslip });
});

export const PATCH = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID phiếu lương không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = updatePayslipManualSchema.parse(rawBody);
    const payslip = await updatePayslipManualItems(
      id,
      input,
      auth,
      getRequestIp(request),
    );
    return ok({ payslip });
  },
  { permission: 'hrm.payroll.manage' },
);
