import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { importAttendanceExcel } from '@/modules/hrm/attendance/attendance-import.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new AppError(
        'INVALID_FORM_DATA',
        'Yêu cầu phải gửi dạng multipart/form-data chứa file Excel (.xlsx).',
        400,
      );
    }

    const fileEntry = formData.get('file');
    if (!fileEntry || typeof fileEntry === 'string') {
      throw new AppError('MISSING_FILE', 'Vui lòng chọn file Excel (.xlsx) cần import.', 400);
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const summary = await importAttendanceExcel(
      {
        name: fileEntry.name || 'upload.xlsx',
        type: fileEntry.type || '',
        size: fileEntry.size,
        buffer: Buffer.from(arrayBuffer),
      },
      auth,
      getRequestIp(request),
    );

    return ok(summary);
  },
  { permission: 'hrm.attendance.import' },
);
