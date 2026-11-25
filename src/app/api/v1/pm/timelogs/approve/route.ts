import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { reviewTimeLogsSchema } from '@/modules/projects/projects-advanced.schema';
import { reviewTimeLogs } from '@/modules/projects/timelogs.service';
import { ok } from '@/shared/api-response';

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const input = reviewTimeLogsSchema.parse(await request.json());
    return ok(await reviewTimeLogs(auth, input));
  },
  { permission: 'pm.timelogs.approve' },
);
