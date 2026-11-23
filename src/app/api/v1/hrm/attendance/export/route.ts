import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportAttendanceLogsExcel } from '@/modules/hrm/attendance/attendance-logs.service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const { buffer, fileName } = await exportAttendanceLogsExcel(auth, {
      fromDate: sp.get('fromDate'),
      toDate: sp.get('toDate'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      employeeId: sp.get('employeeId'),
      status: sp.get('status'),
      source: sp.get('source'),
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
  { permission: 'hrm.attendance.export' },
);
