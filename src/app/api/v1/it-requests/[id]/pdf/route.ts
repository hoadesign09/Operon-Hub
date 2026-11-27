import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { exportItRequestPdfBuffer } from '@/modules/it-requests/it-requests-reports.service';
import { AppError } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const ticketId = Number(id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      throw new AppError('INVALID_ID', 'ID yêu cầu IT không hợp lệ.', 400);
    }
    const { buffer, fileName } = await exportItRequestPdfBuffer(auth, ticketId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  },
  { permission: IT_REQUEST_PERMISSIONS.EXPORT },
);
