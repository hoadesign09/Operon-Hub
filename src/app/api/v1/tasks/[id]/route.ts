import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateTaskSchema } from '@/modules/projects/projects.schema';
import { getTaskDetail, updateTask } from '@/modules/projects/tasks.service';
import { AppError, fail, ok } from '@/shared/api-response';

function parseTaskId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID công việc không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const task = await getTaskDetail(auth, parseTaskId(id));
    return ok(task);
  },
  { permission: 'pm.tasks.read' },
);

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = updateTaskSchema.parse(body);
    const updated = await updateTask(auth, parseTaskId(id), input, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'pm.tasks.update' },
);

export const DELETE = withAuth<{ id: string }>(
  async () => {
    return fail(
      'TASK_HARD_DELETE_FORBIDDEN',
      'Không được phép xóa cứng công việc khỏi cơ sở dữ liệu. Hãy dùng thao tác Lưu trữ (Archive).',
      405,
    );
  },
  { permission: 'pm.tasks.read' },
);
