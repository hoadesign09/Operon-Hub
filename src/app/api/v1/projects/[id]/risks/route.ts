import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createProjectRisk, listProjectRisks } from '@/modules/projects/budget-risks.service';
import { createRiskSchema } from '@/modules/projects/projects-advanced.schema';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    return ok(await listProjectRisks(auth, id));
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const input = createRiskSchema.parse(await request.json());
    return created(await createProjectRisk(auth, id, input));
  },
  { permission: 'pm.projects.read' },
);
