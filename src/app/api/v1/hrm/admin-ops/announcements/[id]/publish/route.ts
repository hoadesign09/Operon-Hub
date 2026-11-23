import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { publishAnnouncement } from '@/modules/hrm/office/announcements.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID thông báo không hợp lệ.', 400);
    }

    const announcement = await publishAnnouncement(id, auth, getRequestIp(request));
    return ok({ announcement });
  },
  { permission: 'hrm.announcements.manage' },
);
