import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportLeaveRequestsToExcel } from '@/modules/hrm/requests/leave-requests.service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const { buffer, filename } = await exportLeaveRequestsToExcel(auth, {
      year: sp.get('year'),
      status: sp.get('status'),
      leaveTypeId: sp.get('leaveTypeId'),
      branchId: sp.get('branchId'),
      search: sp.get('search'),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    });
  },
  { permission: 'hrm.requests.export' },
);
