import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import {
  listItAttachments,
  uploadItAttachment,
} from '@/modules/it-requests/it-requests-collab.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID yêu cầu IT không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const items = await listItAttachments(auth, parseId(id));
    return ok(items);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const formData = await request.formData();
    const rawFile = formData.get('file');
    if (!(rawFile instanceof File)) {
      throw new AppError('MISSING_FILE', 'Vui lòng chọn tệp đính kèm để tải lên.', 400);
    }
    const items = await uploadItAttachment(auth, parseId(id), rawFile);
    return created(items);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);
