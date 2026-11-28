import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createWorkflowSchema } from '@/modules/approvals/approvals.schema';
import { createWorkflow, listWorkflows } from '@/modules/approvals/workflows.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request) => {
    const sp = request.nextUrl.searchParams;
    const workflows = await listWorkflows({
      moduleCode: sp.get('moduleCode'),
      requestType: sp.get('requestType'),
    });
    return ok(workflows);
  },
  { permission: 'core.approvals.workflow_manage' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = createWorkflowSchema.parse(rawBody);
    const workflow = await createWorkflow(input, auth.userId, getRequestIp(request));
    return created(workflow);
  },
  { permission: 'core.approvals.workflow_manage' },
);
