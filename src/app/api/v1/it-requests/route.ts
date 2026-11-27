import { withAuth } from '@/middlewares/auth';
import { ensureApprovalHooksRegistered } from '@/modules/approvals/register-module-hooks';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { createItRequestSchema } from '@/modules/it-requests/it-requests.schema';
import { createItRequest, listItRequests } from '@/modules/it-requests/it-requests.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function toPositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listItRequests(auth, {
      scope: sp.get('scope') ?? undefined,
      status: sp.get('status') ?? undefined,
      priority: sp.get('priority') ?? undefined,
      requestKind: sp.get('requestKind') ?? undefined,
      categoryId: toPositiveInt(sp.get('categoryId')),
      branchId: toPositiveInt(sp.get('branchId')),
      assignedToUserId: toPositiveInt(sp.get('assignedToUserId')),
      search: sp.get('search') ?? undefined,
      page: toPositiveInt(sp.get('page')),
      limit: toPositiveInt(sp.get('limit')),
    });
    return ok(result.items, result.meta);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    ensureApprovalHooksRegistered();
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = createItRequestSchema.parse(rawBody);
    const detail = await createItRequest(auth, input);
    return created(detail);
  },
  { permission: IT_REQUEST_PERMISSIONS.CREATE },
);
