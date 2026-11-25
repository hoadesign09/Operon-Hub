import dayjs from 'dayjs';
import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { getWorkloadHeatmap } from '@/modules/projects/workload.service';
import { ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const startDate = sp.get('startDate') ?? dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD');
    const endDate = sp.get('endDate') ?? dayjs(startDate).add(13, 'day').format('YYYY-MM-DD');
    const projectId = sp.get('projectId') ? Number(sp.get('projectId')) : undefined;
    const departmentId = sp.get('departmentId') ? Number(sp.get('departmentId')) : undefined;
    const branchId = sp.get('branchId') ? Number(sp.get('branchId')) : undefined;

    return ok(
      await getWorkloadHeatmap(auth, {
        startDate,
        endDate,
        projectId,
        departmentId,
        branchId,
      }),
    );
  },
  { permission: 'pm.workload.read' },
);
