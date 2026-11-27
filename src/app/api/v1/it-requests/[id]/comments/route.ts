import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { createItCommentSchema } from '@/modules/it-requests/it-requests.schema';
import { createItComment, listItComments } from '@/modules/it-requests/it-requests-collab.service';
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
    const comments = await listItComments(auth, parseId(id));
    return ok(comments);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = createItCommentSchema.parse(rawBody);
    const comments = await createItComment(auth, parseId(id), input);
    return created(comments);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);
