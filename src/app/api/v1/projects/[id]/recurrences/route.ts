import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createRecurrenceRuleSchema } from '@/modules/projects/projects-advanced.schema';
import {
  createProjectRecurrence,
  listProjectRecurrences,
} from '@/modules/projects/templates-automation.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    return ok(await listProjectRecurrences(auth, id));
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const input = createRecurrenceRuleSchema.parse(await request.json());
    return created(await createProjectRecurrence(auth, id, input));
  },
  { permission: 'pm.templates.manage' },
);
