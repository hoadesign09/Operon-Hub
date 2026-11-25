import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { addProjectMemberSchema } from '@/modules/projects/projects.schema';
import { addProjectMember, getProjectDetail } from '@/modules/projects/projects.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const project = await getProjectDetail(auth, id);
    return ok(project.members);
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = addProjectMemberSchema.parse(body);
    const members = await addProjectMember(auth, id, input, getRequestIp(request));
    return created(members);
  },
  { permission: 'pm.projects.read' },
);
