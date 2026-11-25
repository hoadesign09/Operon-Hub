import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createProjectSchema } from '@/modules/projects/projects.schema';
import { createProject, listProjects } from '@/modules/projects/projects.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listProjects(auth, {
      page: sp.get('page'),
      limit: sp.get('limit'),
      search: sp.get('search'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      status: sp.get('status'),
      healthStatus: sp.get('healthStatus'),
      methodology: sp.get('methodology'),
      onlyMine: sp.get('onlyMine'),
      includeArchived: sp.get('includeArchived'),
    });
    return ok({ items: result.items, summary: result.summary }, result.meta);
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const body = await request.json();
    const input = createProjectSchema.parse(body);
    const project = await createProject(auth, input, getRequestIp(request));
    return created(project);
  },
  { permission: 'pm.projects.create' },
);
