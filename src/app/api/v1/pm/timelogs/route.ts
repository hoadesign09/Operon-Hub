import { NextRequest } from 'next/server';
import type { TimeLogApprovalStatus } from '@/config/database';
import { withAuth } from '@/middlewares/auth';
import { createManualTimeLogSchema } from '@/modules/projects/projects-advanced.schema';
import { createManualTimeLog, listTimeLogs } from '@/modules/projects/timelogs.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const projectId = sp.get('projectId') ? Number(sp.get('projectId')) : undefined;
    const taskId = sp.get('taskId') ? Number(sp.get('taskId')) : undefined;
    const employeeId = sp.get('employeeId') ? Number(sp.get('employeeId')) : undefined;
    const startDate = sp.get('startDate') ?? undefined;
    const endDate = sp.get('endDate') ?? undefined;
    const status = (sp.get('status') as TimeLogApprovalStatus | null) ?? undefined;
    const mineOnly = sp.get('mineOnly') === 'true';

    return ok(
      await listTimeLogs(auth, {
        projectId,
        taskId,
        employeeId,
        startDate,
        endDate,
        status,
        mineOnly,
      }),
    );
  },
  { permission: 'pm.tasks.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const input = createManualTimeLogSchema.parse(await request.json());
    return created(await createManualTimeLog(auth, input));
  },
  { permission: 'pm.timelogs.log' },
);
