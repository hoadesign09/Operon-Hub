import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { updateTimeLogSchema } from '@/modules/projects/projects-advanced.schema';
import { updateTimeLog } from '@/modules/projects/timelogs.service';
import { AppError, ok } from '@/shared/api-response';

export const PATCH = withAuth<{ logId: string }>(
  async (request: NextRequest, context, auth) => {
    const { logId } = await context.params;
    const id = Number(logId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_TIMELOG_ID', 'ID giờ công không hợp lệ.', 400);
    }
    const input = updateTimeLogSchema.parse(await request.json());
    return ok(await updateTimeLog(auth, id, input));
  },
  { permission: 'pm.timelogs.log' },
);
