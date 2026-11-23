import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateRolePermissionsSchema } from '@/modules/roles/roles.schema';
import { updateRolePermissions } from '@/modules/roles/roles.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const PUT = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const roleId = Number(rawId);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      throw new AppError('INVALID_ID', 'Mã ID vai trò không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = updateRolePermissionsSchema.parse(rawBody);
    const result = await updateRolePermissions(
      roleId,
      input.permissionIds,
      auth.userId,
      getRequestIp(request),
    );
    return ok(result);
  },
  { permission: 'core.roles.update' },
);
