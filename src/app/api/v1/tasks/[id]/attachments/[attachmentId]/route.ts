import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import {
  archiveTaskAttachment,
  downloadTaskAttachment,
} from '@/modules/projects/collaboration.service';
import { AppError, ok } from '@/shared/api-response';

function parsePositiveId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string; attachmentId: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id, attachmentId } = await context.params;
    const file = await downloadTaskAttachment(
      auth,
      parsePositiveId(id),
      parsePositiveId(attachmentId),
    );
    const encodedName = encodeURIComponent(file.fileName);
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
        'Content-Length': String(file.buffer.byteLength),
      },
    });
  },
  { permission: 'pm.tasks.read' },
);

export const DELETE = withAuth<{ id: string; attachmentId: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id, attachmentId } = await context.params;
    const items = await archiveTaskAttachment(
      auth,
      parsePositiveId(id),
      parsePositiveId(attachmentId),
    );
    return ok(items);
  },
  { permission: 'pm.tasks.update' },
);
