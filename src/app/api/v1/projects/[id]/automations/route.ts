import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createAutomationRuleSchema } from '@/modules/projects/projects-advanced.schema';
import {
  createProjectAutomation,
  listProjectAutomations,
} from '@/modules/projects/templates-automation.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    return ok(await listProjectAutomations(auth, id));
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const input = createAutomationRuleSchema.parse(await request.json());
    return created(await createProjectAutomation(auth, id, input));
  },
  { permission: 'pm.templates.manage' },
);
