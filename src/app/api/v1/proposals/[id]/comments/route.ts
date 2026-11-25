import { withAuth } from '@/middlewares/auth';
import { createProposalCommentSchema } from '@/modules/proposals/proposals.schema';
import {
  createProposalComment,
  listProposalComments,
} from '@/modules/proposals/proposals-collab.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseProposalId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID đề xuất không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const comments = await listProposalComments(auth, parseProposalId(id));
    return ok(comments);
  },
  { permission: 'proposals.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu bình luận không đúng định dạng JSON.', 400);
    }
    const input = createProposalCommentSchema.parse(rawBody);
    const comments = await createProposalComment(auth, parseProposalId(id), input);
    return created(comments);
  },
  { permission: 'proposals.read' },
);
