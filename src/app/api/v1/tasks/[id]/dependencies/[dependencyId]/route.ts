import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { removeTaskDependency } from '@/modules/projects/tasks.service';
import { AppError, ok } from '@/shared/api-response';

function parsePositiveId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID không hợp lệ.', 400);
  }
  return num;
}

export const DELETE = withAuth<{ id: string; dependencyId: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id, dependencyId } = await context.params;
    const deps = await removeTaskDependency(
      auth,
      parsePositiveId(id),
      parsePositiveId(dependencyId),
    );
    return ok(deps);
  },
  { permission: 'pm.tasks.update' },
);
