import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createTaskSchema } from '@/modules/projects/projects.schema';
import { createTask, listProjectTasks } from '@/modules/projects/tasks.service';
import { AppError, created, ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const projectId = sp.get('projectId') ?? sp.get('projectCode');
    if (!projectId) {
      throw new AppError('MISSING_PROJECT_ID', 'Vui lòng truyền tham số projectId hoặc projectCode.', 400);
    }

    const tasks = await listProjectTasks(auth, projectId, {
      search: sp.get('search'),
      columnId: sp.get('columnId'),
      priority: sp.get('priority'),
      taskType: sp.get('taskType'),
      assigneeEmployeeId: sp.get('assigneeEmployeeId'),
      labelId: sp.get('labelId'),
      dueFrom: sp.get('dueFrom'),
      dueTo: sp.get('dueTo'),
      rootOnly: sp.get('rootOnly'),
    });
    return ok(tasks);
  },
  { permission: 'pm.tasks.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const body = await request.json();
    const input = createTaskSchema.parse(body);
    const task = await createTask(auth, input, getRequestIp(request));
    return created(task);
  },
  { permission: 'pm.tasks.create' },
);
