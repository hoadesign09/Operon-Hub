import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import {
  downloadItAttachment,
  softDeleteItAttachment,
} from '@/modules/it-requests/it-requests-collab.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositiveId(raw: string, label: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', `${label} không hợp lệ.`, 400);
  }
  return num;
}

export const GET = withAuth<{ id: string; attachmentId: string }>(
  async (_request, context, auth) => {
    const { id, attachmentId } = await context.params;
    const { buffer, fileName, mimeType } = await downloadItAttachment(
      auth,
      parsePositiveId(id, 'ID yêu cầu IT'),
      parsePositiveId(attachmentId, 'ID tệp đính kèm'),
    );
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);

export const DELETE = withAuth<{ id: string; attachmentId: string }>(
  async (_request, context, auth) => {
    const { id, attachmentId } = await context.params;
    const items = await softDeleteItAttachment(
      auth,
      parsePositiveId(id, 'ID yêu cầu IT'),
      parsePositiveId(attachmentId, 'ID tệp đính kèm'),
    );
    return ok(items);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);
