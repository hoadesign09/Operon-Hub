import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createAnnouncementSchema } from '@/modules/hrm/office/announcements.schema';
import { createAnnouncement, listAnnouncements } from '@/modules/hrm/office/announcements.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listAnnouncements(auth, {
      branchId: sp.get('branchId'),
      category: sp.get('category'),
      status: sp.get('status'),
      readFilter: sp.get('readFilter'),
      pinnedOnly: sp.get('pinnedOnly'),
      search: sp.get('search'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok({ items: result.items, stats: result.stats }, result.meta);
  },
  { permission: 'hrm.announcements.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createAnnouncementSchema.parse(rawBody);
    const announcement = await createAnnouncement(input, auth, getRequestIp(request));
    return created({ announcement });
  },
  { permission: 'hrm.announcements.manage' },
);
