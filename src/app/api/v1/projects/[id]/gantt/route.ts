import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { rescheduleGanttTaskSchema } from '@/modules/projects/projects-advanced.schema';
import { getProjectGanttData, rescheduleGanttTask } from '@/modules/projects/milestones.service';
import { ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    return ok(await getProjectGanttData(auth, id));
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const input = rescheduleGanttTaskSchema.parse(await request.json());
    return ok(await rescheduleGanttTask(auth, id, input));
  },
  { permission: 'pm.tasks.update' },
);
