import { withAuth } from '@/middlewares/auth';
import { listApprovalInbox } from '@/modules/approvals/approvals.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listApprovalInbox(auth, {
      scope: sp.get('scope'),
      moduleCode: sp.get('moduleCode'),
      status: sp.get('status'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'core.approvals.read' },
);
