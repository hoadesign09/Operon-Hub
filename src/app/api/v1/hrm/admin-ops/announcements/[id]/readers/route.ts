import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listAnnouncementReaders } from '@/modules/hrm/office/announcements.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID thông báo không hợp lệ.', 400);
    }

    const sp = request.nextUrl.searchParams;
    const result = await listAnnouncementReaders(id, auth, {
      filter: sp.get('filter'),
      search: sp.get('search'),
    });
    return ok(result);
  },
  { permission: 'hrm.announcements.manage' },
);
