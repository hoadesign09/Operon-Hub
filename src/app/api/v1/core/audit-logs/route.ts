import { withAuth } from '@/middlewares/auth';
import { listAuditLogs } from '@/modules/audit/audit.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request) => {
    const sp = request.nextUrl.searchParams;
    const result = await listAuditLogs({
      page: sp.get('page'),
      limit: sp.get('limit'),
      moduleCode: sp.get('moduleCode'),
      action: sp.get('action'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'core.audit_logs.read' },
);
