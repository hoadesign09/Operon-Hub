import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createSprintSchema } from '@/modules/projects/projects-advanced.schema';
import { createProjectSprint, listProjectSprints } from '@/modules/projects/sprints.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    return ok(await listProjectSprints(auth, id));
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const input = createSprintSchema.parse(await request.json());
    return created(await createProjectSprint(auth, id, input));
  },
  { permission: 'pm.sprints.manage' },
);
