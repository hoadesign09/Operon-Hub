import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import {
  deletePaymentAttachment,
  getPaymentAttachmentDownload,
} from '@/modules/payments/payments-collab.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseId(raw: string, label: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', `ID ${label} không hợp lệ.`, 400);
  }
  return num;
}

export const GET = withAuth<{ id: string; attachmentId: string }>(
  async (_request, context, auth) => {
    const { id, attachmentId } = await context.params;
    const { fileName, mimeType, buffer } = await getPaymentAttachmentDownload(
      auth,
      parseId(id, 'đề nghị thanh toán'),
      parseId(attachmentId, 'tệp chứng từ'),
    );
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  },
  { permission: 'payments.read' },
);

export const DELETE = withAuth<{ id: string; attachmentId: string }>(
  async (_request, context, auth) => {
    const { id, attachmentId } = await context.params;
    const items = await deletePaymentAttachment(
      auth,
      parseId(id, 'đề nghị thanh toán'),
      parseId(attachmentId, 'tệp chứng từ'),
    );
    return ok(items);
  },
  { permission: 'payments.read' },
);
