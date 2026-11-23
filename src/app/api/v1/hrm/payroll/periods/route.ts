import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createPayrollPeriodSchema } from '@/modules/hrm/payroll/payroll.schema';
import {
  createPayrollPeriod,
  listPayrollPeriods,
} from '@/modules/hrm/payroll/payroll.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listPayrollPeriods(auth, {
      year: sp.get('year'),
      month: sp.get('month'),
      branchId: sp.get('branchId'),
      status: sp.get('status'),
      search: sp.get('search'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok({ items: result.items }, result.meta);
  },
  { permission: 'hrm.payroll.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createPayrollPeriodSchema.parse(rawBody);
    const period = await createPayrollPeriod(input, auth, getRequestIp(request));
    return created({ period });
  },
  { permission: 'hrm.payroll.manage' },
);
