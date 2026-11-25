import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { createProjectTemplateSchema } from '@/modules/projects/projects-advanced.schema';
import {
  createProjectTemplate,
  listProjectTemplates,
} from '@/modules/projects/templates-automation.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const onlyActive = request.nextUrl.searchParams.get('activeOnly') === 'true';
    return ok(await listProjectTemplates(auth, onlyActive));
  },
  { permission: 'pm.projects.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const input = createProjectTemplateSchema.parse(await request.json());
    return created(await createProjectTemplate(auth, input));
  },
  { permission: 'pm.templates.manage' },
);
