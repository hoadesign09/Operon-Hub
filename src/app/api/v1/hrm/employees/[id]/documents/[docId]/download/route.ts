import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { getEmployeeDocumentForDownload } from '@/modules/hrm/employees/employee-documents.service';
import { AppError } from '@/shared/api-response';

function parsePositiveId(raw: string, label: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('INVALID_ID', `${label} không hợp lệ.`, 400);
  }
  return parsed;
}

export const GET = withAuth<{ id: string; docId: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id, docId } = await context.params;
    const { buffer, fileName, mimeType } = await getEmployeeDocumentForDownload(
      auth,
      parsePositiveId(id, 'ID nhân viên'),
      parsePositiveId(docId, 'ID tài liệu'),
    );

    const encodedFileName = encodeURIComponent(fileName);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    });
  },
);
