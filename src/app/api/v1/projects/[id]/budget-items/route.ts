import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import {
  createBudgetItem,
  getProjectBudgetOverview,
} from '@/modules/projects/budget-risks.service';
import { createBudgetItemSchema } from '@/modules/projects/projects-advanced.schema';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    return ok(await getProjectBudgetOverview(auth, id));
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const input = createBudgetItemSchema.parse(await request.json());
    return created(await createBudgetItem(auth, id, input));
  },
  { permission: 'pm.projects.read' },
);
