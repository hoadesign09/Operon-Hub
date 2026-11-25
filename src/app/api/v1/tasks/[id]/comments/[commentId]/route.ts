import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { updateTaskComment } from '@/modules/projects/collaboration.service';
import { updateCommentSchema } from '@/modules/projects/projects.schema';
import { AppError, ok } from '@/shared/api-response';

function parsePositiveId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID không hợp lệ.', 400);
  }
  return num;
}

export const PATCH = withAuth<{ id: string; commentId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, commentId } = await context.params;
    const body = await request.json();
    const input = updateCommentSchema.parse(body);
    const comments = await updateTaskComment(
      auth,
      parsePositiveId(id),
      parsePositiveId(commentId),
      input,
    );
    return ok(comments);
  },
  { permission: 'pm.tasks.read' },
);
