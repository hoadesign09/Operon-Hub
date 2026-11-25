import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import {
  listTaskAttachments,
  uploadTaskAttachment,
} from '@/modules/projects/collaboration.service';
import { AppError, created, ok } from '@/shared/api-response';

function parseTaskId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID công việc không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const items = await listTaskAttachments(auth, parseTaskId(id));
    return ok(items);
  },
  { permission: 'pm.tasks.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const formData = await request.formData();
    const rawFile = formData.get('file');
    if (!(rawFile instanceof File)) {
      throw new AppError('MISSING_FILE', 'Vui lòng đính kèm tệp tài liệu.', 400);
    }
    const items = await uploadTaskAttachment(auth, parseTaskId(id), rawFile);
    return created(items);
  },
  { permission: 'pm.tasks.update' },
);
