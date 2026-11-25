import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportTasksToExcel } from '@/modules/projects/reports.service';
import { AppError } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const projectId = request.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      throw new AppError('PROJECT_ID_REQUIRED', 'Thiếu tham số projectId.', 400);
    }
    const { filename, buffer } = await exportTasksToExcel(auth, projectId);
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
