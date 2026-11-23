import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updatePositionSchema } from '@/modules/hrm/organization/organization.schema';
import { softDeletePosition, updatePosition } from '@/modules/hrm/organization/positions.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parsePositionId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID chức danh không hợp lệ.', 400);
  }
  return id;
}

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const positionId = parsePositionId(rawId);

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = updatePositionSchema.parse(rawBody);
    const updated = await updatePosition(positionId, input, auth.userId, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'hrm.org.manage' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const positionId = parsePositionId(rawId);

    await softDeletePosition(positionId, auth.userId, getRequestIp(request));
    return ok({ deleted: true, id: positionId });
  },
  { permission: 'hrm.org.manage' },
);
