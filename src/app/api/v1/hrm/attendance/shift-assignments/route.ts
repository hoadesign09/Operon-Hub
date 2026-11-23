import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createShiftAssignmentSchema } from '@/modules/hrm/attendance/attendance.schema';
import {
  assignShiftToEmployees,
  listShiftAssignments,
} from '@/modules/hrm/attendance/shifts.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listShiftAssignments(auth, {
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      employeeId: sp.get('employeeId'),
      shiftId: sp.get('shiftId'),
      search: sp.get('search'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok({ items: result.items }, result.meta);
  },
  { permission: 'hrm.attendance.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createShiftAssignmentSchema.parse(rawBody);
    const result = await assignShiftToEmployees(input, auth, getRequestIp(request));
    return created(result);
  },
  { permission: 'hrm.attendance.manage' },
);
