import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { requestMilestoneSignoff } from '@/modules/projects/milestones.service';
import { AppError, ok } from '@/shared/api-response';

export const POST = withAuth<{ id: string; milestoneId: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id, milestoneId } = await context.params;
    const mid = Number(milestoneId);
    if (!Number.isInteger(mid) || mid <= 0) {
      throw new AppError('INVALID_MILESTONE_ID', 'ID Milestone không hợp lệ.', 400);
    }
    return ok(await requestMilestoneSignoff(auth, id, mid));
  },
  { permission: 'pm.tasks.update' },
);
