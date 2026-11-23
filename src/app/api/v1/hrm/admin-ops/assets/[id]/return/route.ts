import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { returnAssetSchema } from '@/modules/hrm/office/assets.schema';
import { returnAsset } from '@/modules/hrm/office/assets.service';
import { AppError, ok } from '@/shared/api-response';

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

    const input = returnAssetSchema.parse(rawBody);
    const result = await returnAsset(id, input, auth, getRequestIp(request));
    return ok(result);
  },
  { permission: 'hrm.assets.manage' },
);
