import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportEmployeesToExcel } from '@/modules/hrm/employees/employees.service';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const { buffer, filename } = await exportEmployeesToExcel(auth, {
      search: sp.get('search'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      positionId: sp.get('positionId'),
      status: sp.get('status'),
      sortBy: sp.get('sortBy'),
      sortOrder: sp.get('sortOrder'),
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
  { permission: 'hrm.employees.export' },
);
