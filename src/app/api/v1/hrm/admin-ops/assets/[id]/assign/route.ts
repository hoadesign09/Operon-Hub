import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { assignAssetSchema } from '@/modules/hrm/office/assets.schema';
import { assignAsset } from '@/modules/hrm/office/assets.service';
import { AppError, created } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID tài sản không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = assignAssetSchema.parse(rawBody);
    const result = await assignAsset(id, input, auth, getRequestIp(request));
    return created(result);
  },
  { permission: 'hrm.assets.manage' },
);
