import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { archiveTask } from '@/modules/projects/tasks.service';
import { AppError, ok } from '@/shared/api-response';

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
    const result = await archiveTask(auth, parseTaskId(id), getRequestIp(request));
    return ok(result);
  },
  { permission: 'pm.tasks.update' },
);
