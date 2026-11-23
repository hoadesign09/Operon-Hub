import { getRequestIp, withAuth } from '@/middlewares/auth';
import { changePasswordSchema } from '@/modules/auth/auth.schema';
import { changeUserPassword } from '@/modules/auth/auth.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(async (request, _context, auth) => {
  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
  }

  const input = changePasswordSchema.parse(rawBody);
  await changeUserPassword(
    auth.userId,
    input.currentPassword,
    input.newPassword,
    getRequestIp(request),
  );

  return ok({ passwordChanged: true });
});
