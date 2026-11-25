import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { completeSprintSchema } from '@/modules/projects/projects-advanced.schema';
import { completeProjectSprint } from '@/modules/projects/sprints.service';
import { AppError, ok } from '@/shared/api-response';

export const POST = withAuth<{ id: string; sprintId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, sprintId } = await context.params;
    const sid = Number(sprintId);
    if (!Number.isInteger(sid) || sid <= 0) {
      throw new AppError('INVALID_SPRINT_ID', 'ID Sprint không hợp lệ.', 400);
    }
    const raw = await request.json().catch(() => ({}));
    const input = completeSprintSchema.parse(raw);
    return ok(await completeProjectSprint(auth, id, sid, input));
  },
  { permission: 'pm.sprints.manage' },
);
