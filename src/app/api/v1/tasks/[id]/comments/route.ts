import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createTaskComment, listTaskComments } from '@/modules/projects/collaboration.service';
import { createCommentSchema } from '@/modules/projects/projects.schema';
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
    const comments = await listTaskComments(auth, parseTaskId(id));
    return ok(comments);
  },
  { permission: 'pm.tasks.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = createCommentSchema.parse(body);
    const comments = await createTaskComment(auth, parseTaskId(id), input);
    return created(comments);
  },
  { permission: 'pm.tasks.read' },
);
