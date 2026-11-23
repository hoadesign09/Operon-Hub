import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createBranchSchema } from '@/modules/branches/branches.schema';
import { createBranch, listBranches } from '@/modules/branches/branches.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request) => {
    const sp = request.nextUrl.searchParams;
    const result = await listBranches({
      page: sp.get('page'),
      limit: sp.get('limit'),
      search: sp.get('search'),
      isActive: sp.get('isActive'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'core.branches.read' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = createBranchSchema.parse(rawBody);
    const branch = await createBranch(input, auth.userId, getRequestIp(request));
    return created(branch);
  },
  { permission: 'core.branches.create' },
);
