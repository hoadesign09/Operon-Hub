import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { captureProjectBaseline } from '@/modules/projects/milestones.service';
import { ok } from '@/shared/api-response';

export const POST = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    return ok(await captureProjectBaseline(auth, id));
  },
  { permission: 'pm.projects.read' },
);
