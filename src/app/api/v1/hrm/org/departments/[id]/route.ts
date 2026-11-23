import { getRequestIp, withAuth } from '@/middlewares/auth';
import {
  softDeleteDepartment,
  updateDepartment,
} from '@/modules/hrm/organization/departments.service';
import { updateDepartmentSchema } from '@/modules/hrm/organization/organization.schema';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseDepartmentId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID phòng ban không hợp lệ.', 400);
  }
  return id;
}

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const departmentId = parseDepartmentId(rawId);

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = updateDepartmentSchema.parse(rawBody);
    const updated = await updateDepartment(auth, departmentId, input, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'hrm.org.manage' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const departmentId = parseDepartmentId(rawId);

    await softDeleteDepartment(auth, departmentId, getRequestIp(request));
    return ok({ deleted: true, id: departmentId });
  },
  { permission: 'hrm.org.manage' },
);
