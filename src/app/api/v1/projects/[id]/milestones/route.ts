import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createMilestoneSchema } from '@/modules/projects/projects-advanced.schema';
import { createProjectMilestone, listProjectMilestones } from '@/modules/projects/milestones.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    return ok(await listProjectMilestones(auth, id));
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const input = createMilestoneSchema.parse(await request.json());
    return created(await createProjectMilestone(auth, id, input));
  },
  { permission: 'pm.tasks.create' },
);
