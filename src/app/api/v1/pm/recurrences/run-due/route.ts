import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { runDueRecurrenceRules } from '@/modules/projects/templates-automation.service';
import { ok } from '@/shared/api-response';

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const body = (await request.json().catch(() => ({}))) as { projectId?: number };
    return ok(await runDueRecurrenceRules(auth, body.projectId));
  },
  { permission: 'pm.templates.manage' },
);
