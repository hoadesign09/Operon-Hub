import { withAuth } from '@/middlewares/auth';
import { listUserNotifications } from '@/modules/notifications/notifications.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, _context, auth) => {
  const sp = request.nextUrl.searchParams;
  const result = await listUserNotifications(auth.userId, {
    page: sp.get('page'),
    limit: sp.get('limit'),
    unreadOnly: sp.get('unreadOnly'),
  });
  return ok({ items: result.items, unreadCount: result.unreadCount }, result.meta);
});
