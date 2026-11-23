import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createPositionSchema } from '@/modules/hrm/organization/organization.schema';
import { createPosition, listPositions } from '@/modules/hrm/organization/positions.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request) => {
    const sp = request.nextUrl.searchParams;
    const result = await listPositions({
      page: sp.get('page'),
      limit: sp.get('limit'),
      search: sp.get('search'),
      isActive: sp.get('isActive'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'hrm.org.read' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = createPositionSchema.parse(rawBody);
    const position = await createPosition(input, auth.userId, getRequestIp(request));
    return created(position);
  },
  { permission: 'hrm.org.manage' },
);
