import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { getActiveRunningTimer } from '@/modules/projects/timelogs.service';
import { ok } from '@/shared/api-response';

export const GET = withAuth(
  async (_request: NextRequest, _context, auth) => {
    return ok(await getActiveRunningTimer(auth));
  },
  { permission: 'pm.tasks.read' },
);
