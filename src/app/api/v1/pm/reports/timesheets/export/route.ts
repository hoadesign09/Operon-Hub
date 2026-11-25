import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportTimesheetsToExcel } from '@/modules/projects/reports.service';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const projectId = sp.get('projectId') ? Number(sp.get('projectId')) : undefined;
    const startDate = sp.get('startDate') ?? undefined;
    const endDate = sp.get('endDate') ?? undefined;
    const { filename, buffer } = await exportTimesheetsToExcel(auth, {
      projectId,
      startDate,
      endDate,
    });
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
