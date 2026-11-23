import { withAuth } from '@/middlewares/auth';
import { markAllNotificationsRead } from '@/modules/notifications/notifications.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(async (_request, _context, auth) => {
  const updatedCount = await markAllNotificationsRead(auth.userId);
  return ok({ updatedCount });
});
