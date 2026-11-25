import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportPortfolioToExcel } from '@/modules/projects/reports.service';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const branchParam = request.nextUrl.searchParams.get('branchId');
    const branchId = branchParam && /^\d+$/.test(branchParam) ? Number(branchParam) : undefined;
    const { filename, buffer } = await exportPortfolioToExcel(auth, branchId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  },
  { permission: 'pm.reports.export' },
);
