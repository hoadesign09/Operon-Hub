import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createBoardColumnSchema, updateBoardColumnSchema } from '@/modules/projects/projects.schema';
import {
  createBoardColumn,
  getProjectDetail,
  updateBoardColumn,
} from '@/modules/projects/projects.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const project = await getProjectDetail(auth, id);
    return ok(project.columns);
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = createBoardColumnSchema.parse(body);
    const columns = await createBoardColumn(auth, id, input);
    return created(columns);
  },
  { permission: 'pm.projects.read' },
);

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = updateBoardColumnSchema.parse(body);
    const columns = await updateBoardColumn(auth, id, input);
    return ok(columns);
  },
  { permission: 'pm.projects.read' },
);
