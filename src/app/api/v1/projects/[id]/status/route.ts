import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { ensureApprovalHooksRegistered } from '@/modules/approvals/register-module-hooks';
import { transitionProjectStatusSchema } from '@/modules/projects/projects.schema';
import { transitionProjectStatus } from '@/modules/projects/projects.service';
import { ok } from '@/shared/api-response';

ensureApprovalHooksRegistered();

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = transitionProjectStatusSchema.parse(body);
    const project = await transitionProjectStatus(auth, id, input, getRequestIp(request));
    return ok(project);
  },
  { permission: 'pm.projects.read' },
);
