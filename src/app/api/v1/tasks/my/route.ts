import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listMyTasks } from '@/modules/projects/tasks.service';
import { ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const includeDone = request.nextUrl.searchParams.get('includeDone') === 'true';
    const data = await listMyTasks(auth, { includeDone });
    return ok(data);
  },
  { permission: 'pm.tasks.read' },
);
