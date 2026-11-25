import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { startTimerSchema } from '@/modules/projects/projects-advanced.schema';
import { startTaskTimer } from '@/modules/projects/timelogs.service';
import { created } from '@/shared/api-response';

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const input = startTimerSchema.parse(await request.json());
    return created(await startTaskTimer(auth, input));
  },
  { permission: 'pm.timelogs.log' },
);
