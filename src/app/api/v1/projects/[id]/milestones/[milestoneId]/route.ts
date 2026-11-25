import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { updateMilestoneSchema } from '@/modules/projects/projects-advanced.schema';
import { updateProjectMilestone } from '@/modules/projects/milestones.service';
import { AppError, ok } from '@/shared/api-response';

export const PATCH = withAuth<{ id: string; milestoneId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, milestoneId } = await context.params;
    const mid = Number(milestoneId);
    if (!Number.isInteger(mid) || mid <= 0) {
      throw new AppError('INVALID_MILESTONE_ID', 'ID Milestone không hợp lệ.', 400);
    }
    const input = updateMilestoneSchema.parse(await request.json());
    return ok(await updateProjectMilestone(auth, id, mid, input));
  },
  { permission: 'pm.tasks.update' },
);
