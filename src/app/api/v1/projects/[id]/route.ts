import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateProjectSchema } from '@/modules/projects/projects.schema';
import { getProjectDetail, updateProject } from '@/modules/projects/projects.service';
import { fail, ok } from '@/shared/api-response';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const project = await getProjectDetail(auth, id);
    return ok(project);
  },
  { permission: 'pm.projects.read' },
);

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = await request.json();
    const input = updateProjectSchema.parse(body);
    const updated = await updateProject(auth, id, input, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'pm.projects.read' },
);

export const DELETE = withAuth<{ id: string }>(
  async () => {
    return fail(
      'PROJECT_HARD_DELETE_FORBIDDEN',
      'Không được phép xóa cứng dự án khỏi cơ sở dữ liệu. Hãy chuyển sang trạng thái Hủy hoặc Lưu trữ.',
      405,
    );
  },
  { permission: 'pm.projects.read' },
);
