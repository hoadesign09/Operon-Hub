import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import {
  downloadProposalAttachment,
  softDeleteProposalAttachment,
} from '@/modules/proposals/proposals-collab.service';
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
    const file = await downloadProposalAttachment(
      auth,
      parsePositiveId(id, 'ID đề xuất'),
      parsePositiveId(attachmentId, 'ID tệp đính kèm'),
    );
    const encodedName = encodeURIComponent(file.fileName);
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
      },
    });
  },
  { permission: 'proposals.read' },
);

export const DELETE = withAuth<{ id: string; attachmentId: string }>(
  async (_request, context, auth) => {
    const { id, attachmentId } = await context.params;
    const remaining = await softDeleteProposalAttachment(
      auth,
      parsePositiveId(id, 'ID đề xuất'),
      parsePositiveId(attachmentId, 'ID tệp đính kèm'),
    );
    return ok(remaining);
  },
  { permission: 'proposals.create' },
);
