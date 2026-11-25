import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { stopTimerSchema } from '@/modules/projects/projects-advanced.schema';
import { stopTaskTimer } from '@/modules/projects/timelogs.service';
import { ok } from '@/shared/api-response';

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const raw = await request.json().catch(() => ({}));
    const input = stopTimerSchema.parse(raw);
    return ok(await stopTaskTimer(auth, input));
  },
  { permission: 'pm.timelogs.log' },
);
