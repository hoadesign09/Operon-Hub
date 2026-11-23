import { withAuth } from '@/middlewares/auth';
import { markNotificationRead } from '@/modules/notifications/notifications.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(async (_request, context, auth) => {
  const { id: rawId } = await context.params;
  const notificationId = Number(rawId);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID thông báo không hợp lệ.', 400);
  }

  await markNotificationRead(auth.userId, notificationId);
  return ok({ read: true, id: notificationId });
});
