import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createAssetSchema } from '@/modules/hrm/office/assets.schema';
import { createAsset, listAssets } from '@/modules/hrm/office/assets.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listAssets(auth, {
      branchId: sp.get('branchId'),
      category: sp.get('category'),
      status: sp.get('status'),
      search: sp.get('search'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok({ items: result.items, stats: result.stats }, result.meta);
  },
  { permission: 'hrm.assets.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = createAssetSchema.parse(rawBody);
    const asset = await createAsset(input, auth, getRequestIp(request));
    return created({ asset });
  },
  { permission: 'hrm.assets.manage' },
);
