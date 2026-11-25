import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { getSprintBurndownAndVelocity } from '@/modules/projects/sprints.service';
import { AppError, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string; sprintId: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id, sprintId } = await context.params;
    const sid = Number(sprintId);
    if (!Number.isInteger(sid) || sid <= 0) {
      throw new AppError('INVALID_SPRINT_ID', 'ID Sprint không hợp lệ.', 400);
    }
    return ok(await getSprintBurndownAndVelocity(auth, id, sid));
  },
  { permission: 'pm.projects.read' },
);
