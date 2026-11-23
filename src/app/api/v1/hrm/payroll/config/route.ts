import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { payrollConfigSchema } from '@/modules/hrm/payroll/payroll.schema';
import {
  getPayrollConfig,
  updatePayrollConfig,
} from '@/modules/hrm/payroll/payroll-config.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async () => {
    const config = await getPayrollConfig();
    return ok({ config });
  },
  { permission: 'hrm.payroll.read' },
);

export const PATCH = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = payrollConfigSchema.parse(rawBody);
    const config = await updatePayrollConfig(input, auth, getRequestIp(request));
    return ok({ config });
  },
  { permission: 'hrm.payroll.manage' },
);
