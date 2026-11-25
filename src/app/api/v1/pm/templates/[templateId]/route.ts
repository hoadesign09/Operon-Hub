import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { updateProjectTemplateSchema } from '@/modules/projects/projects-advanced.schema';
import { updateProjectTemplate } from '@/modules/projects/templates-automation.service';
import { AppError, ok } from '@/shared/api-response';

export const PATCH = withAuth<{ templateId: string }>(
  async (request: NextRequest, context, auth) => {
    const { templateId } = await context.params;
    const id = Number(templateId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_TEMPLATE_ID', 'ID mẫu dự án không hợp lệ.', 400);
    }
    const input = updateProjectTemplateSchema.parse(await request.json());
    return ok(await updateProjectTemplate(auth, id, input));
  },
  { permission: 'pm.templates.manage' },
);
