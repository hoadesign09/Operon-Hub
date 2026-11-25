import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportProposalsExcel } from '@/modules/proposals/proposals-reports.service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const { filename, buffer } = await exportProposalsExcel(auth, {
      scope: sp.get('scope'),
      status: sp.get('status'),
      categoryId: sp.get('categoryId'),
      priority: sp.get('priority'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      search: sp.get('search'),
      fromDate: sp.get('fromDate'),
      toDate: sp.get('toDate'),
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  },
  { permission: 'proposals.export' },
);
