import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateAssetSchema } from '@/modules/hrm/office/assets.schema';
import {
  deleteAsset,
  getAssetDetail,
  updateAsset,
} from '@/modules/hrm/office/assets.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID tài sản không hợp lệ.', 400);
    }

    const detail = await getAssetDetail(id, auth);
    return ok(detail);
  },
  { permission: 'hrm.assets.read' },
);

export const PATCH = withAuth(
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

    const input = updateAssetSchema.parse(rawBody);
    const asset = await updateAsset(id, input, auth, getRequestIp(request));
    return ok({ asset });
  },
  { permission: 'hrm.assets.manage' },
);

export const DELETE = withAuth(
  async (request: NextRequest, context, auth) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'ID tài sản không hợp lệ.', 400);
    }

    await deleteAsset(id, auth, getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'hrm.assets.manage' },
);
