import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { upsertManualAttendanceSchema } from '@/modules/hrm/attendance/attendance.schema';
import {
  listAttendanceLogs,
  upsertManualAttendanceLog,
} from '@/modules/hrm/attendance/attendance-logs.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listAttendanceLogs(auth, {
      fromDate: sp.get('fromDate'),
      toDate: sp.get('toDate'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      employeeId: sp.get('employeeId'),
      status: sp.get('status'),
      source: sp.get('source'),
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

    const input = upsertManualAttendanceSchema.parse(rawBody);
    const result = await upsertManualAttendanceLog(input, auth, getRequestIp(request));
    if (result.created) {
      return created({ log: result.item });
    }
    return ok({ log: result.item });
  },
  { permission: 'hrm.attendance.manage' },
);
