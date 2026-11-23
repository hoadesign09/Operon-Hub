import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportContractsToExcel } from '@/modules/hrm/contracts/contracts.service';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const { buffer, filename } = await exportContractsToExcel(auth, {
      search: sp.get('search'),
      branchId: sp.get('branchId'),
      employeeId: sp.get('employeeId'),
      contractType: sp.get('contractType'),
      status: sp.get('status'),
      expiryAlert: sp.get('expiryAlert'),
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
  { permission: 'hrm.contracts.export' },
);
