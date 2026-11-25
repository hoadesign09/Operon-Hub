import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createLabelSchema, updateLabelSchema } from '@/modules/projects/projects.schema';
import {
  createProjectLabel,
  getProjectDetail,
  updateProjectLabel,
} from '@/modules/projects/projects.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const project = await getProjectDetail(auth, id);
    return ok(project.labels);
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = createLabelSchema.parse(body);
    const labels = await createProjectLabel(auth, id, input);
    return created(labels);
  },
  { permission: 'pm.projects.read' },
);

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = updateLabelSchema.parse(body);
    const labels = await updateProjectLabel(auth, id, input);
    return ok(labels);
  },
  { permission: 'pm.projects.read' },
);
