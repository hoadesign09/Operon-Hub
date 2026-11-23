import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateAnnouncementSchema } from '@/modules/hrm/office/announcements.schema';
import {
  deleteAnnouncement,
  getAnnouncementDetail,
  updateAnnouncement,
} from '@/modules/hrm/office/announcements.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID thông báo không hợp lệ.', 400);
    }

    const announcement = await getAnnouncementDetail(id, auth);
    return ok({ announcement });
  },
  { permission: 'hrm.announcements.read' },
);

export const PATCH = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID thông báo không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = updateAnnouncementSchema.parse(rawBody);
    const announcement = await updateAnnouncement(id, input, auth, getRequestIp(request));
    return ok({ announcement });
  },
  { permission: 'hrm.announcements.manage' },
);

export const DELETE = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID thông báo không hợp lệ.', 400);
    }

    await deleteAnnouncement(id, auth, getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'hrm.announcements.manage' },
);
