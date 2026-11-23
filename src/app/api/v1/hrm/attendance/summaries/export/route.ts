import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportAttendanceSummariesExcel } from '@/modules/hrm/attendance/attendance-summaries.service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const { buffer, fileName } = await exportAttendanceSummariesExcel(auth, {
      year: sp.get('year'),
      month: sp.get('month'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      status: sp.get('status'),
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
