import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createProposalSchema } from '@/modules/proposals/proposals.schema';
import { createProposal, listProposals } from '@/modules/proposals/proposals.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listProposals(auth, {
      scope: sp.get('scope'),
      status: sp.get('status'),
      categoryId: sp.get('categoryId'),
      priority: sp.get('priority'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      budgetId: sp.get('budgetId'),
      search: sp.get('search'),
      fromDate: sp.get('fromDate'),
      toDate: sp.get('toDate'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'proposals.read' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = createProposalSchema.parse(rawBody);
    const detail = await createProposal(input, auth, getRequestIp(request));
    return created(detail);
  },
  { permission: 'proposals.create' },
);
