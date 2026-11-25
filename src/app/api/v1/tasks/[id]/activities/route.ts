import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listTaskActivities } from '@/modules/projects/collaboration.service';
import { AppError, ok } from '@/shared/api-response';

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
    const items = await listTaskActivities(auth, parseTaskId(id));
    return ok(items);
  },
  { permission: 'pm.tasks.read' },
);
