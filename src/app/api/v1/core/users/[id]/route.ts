import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateUserSchema } from '@/modules/users/users.schema';
import { updateUser } from '@/modules/users/users.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const userId = Number(rawId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError('INVALID_ID', 'Mã ID người dùng không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = updateUserSchema.parse(rawBody);
    const updated = await updateUser(userId, input, auth.userId, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'core.users.update' },
);
