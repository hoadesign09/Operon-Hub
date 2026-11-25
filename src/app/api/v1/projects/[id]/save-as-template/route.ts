import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { saveAsTemplateSchema } from '@/modules/projects/projects-advanced.schema';
import { saveProjectAsTemplate } from '@/modules/projects/templates-automation.service';
import { created } from '@/shared/api-response';

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const input = saveAsTemplateSchema.parse(await request.json());
    return created(await saveProjectAsTemplate(auth, id, input));
  },
  { permission: 'pm.templates.manage' },
);
