import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createUserSchema } from '@/modules/users/users.schema';
import { createUser, listUsers } from '@/modules/users/users.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request) => {
    const sp = request.nextUrl.searchParams;
    const result = await listUsers({
      page: sp.get('page'),
      limit: sp.get('limit'),
      search: sp.get('search'),
      status: sp.get('status'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'core.users.read' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = createUserSchema.parse(rawBody);
    const user = await createUser(input, auth.userId, getRequestIp(request));
    return created(user);
  },
  { permission: 'core.users.create' },
);
