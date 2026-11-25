import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { moveTaskSchema } from '@/modules/projects/projects.schema';
import { moveTask } from '@/modules/projects/tasks.service';
import { AppError, ok } from '@/shared/api-response';

function parseTaskId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID công việc không hợp lệ.', 400);
  }
  return num;
}

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = moveTaskSchema.parse(body);
    const result = await moveTask(auth, parseTaskId(id), input);
    return ok(result);
  },
  { permission: 'pm.tasks.update' },
);
