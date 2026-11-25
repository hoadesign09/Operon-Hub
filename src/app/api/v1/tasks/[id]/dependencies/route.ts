import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createDependencySchema } from '@/modules/projects/projects.schema';
import { addTaskDependency } from '@/modules/projects/tasks.service';
import { AppError, created } from '@/shared/api-response';

function parseTaskId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID công việc không hợp lệ.', 400);
  }
  return num;
}

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = createDependencySchema.parse(body);
    const deps = await addTaskDependency(auth, parseTaskId(id), input);
    return created(deps);
  },
  { permission: 'pm.tasks.update' },
);
