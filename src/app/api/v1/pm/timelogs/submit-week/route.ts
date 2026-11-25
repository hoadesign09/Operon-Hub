import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { submitWeekTimesheetSchema } from '@/modules/projects/projects-advanced.schema';
import { submitWeeklyTimesheet } from '@/modules/projects/timelogs.service';
import { ok } from '@/shared/api-response';

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const input = submitWeekTimesheetSchema.parse(await request.json());
    return ok(await submitWeeklyTimesheet(auth, input));
  },
  { permission: 'pm.timelogs.log' },
);
