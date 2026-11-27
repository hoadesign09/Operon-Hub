import { withAuth } from '@/middlewares/auth';
import { paymentAttachmentKindSchema } from '@/modules/payments/payments.schema';
import {
  listPaymentAttachments,
  uploadPaymentAttachment,
} from '@/modules/payments/payments-collab.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID đề nghị thanh toán không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const items = await listPaymentAttachments(auth, parseId(id));
    return ok(items);
  },
  { permission: 'payments.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const formData = await request.formData();
    const rawFile = formData.get('file');
    if (!(rawFile instanceof File)) {
      throw new AppError('MISSING_FILE', 'Vui lòng chọn tệp chứng từ để tải lên.', 400);
    }
    const rawKind = formData.get('attachmentKind');
    const attachmentKind = paymentAttachmentKindSchema.parse(
      typeof rawKind === 'string' && rawKind.trim() ? rawKind.trim().toUpperCase() : undefined,
    );
    const items = await uploadPaymentAttachment(auth, parseId(id), rawFile, attachmentKind);
    return created(items);
  },
  { permission: 'payments.read' },
);
