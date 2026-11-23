import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { buildAttendanceImportTemplateExcel } from '@/modules/hrm/attendance/attendance-import.service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async () => {
    const { buffer, fileName } = await buildAttendanceImportTemplateExcel();
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
  { permission: 'hrm.attendance.import' },
);
