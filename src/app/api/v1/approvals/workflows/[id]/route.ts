import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateWorkflowSchema } from '@/modules/approvals/approvals.schema';
import { softDeleteWorkflow, updateWorkflow } from '@/modules/approvals/workflows.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseWorkflowId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID quy trình không hợp lệ.', 400);
  }
  return id;
}

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const workflowId = parseWorkflowId(rawId);

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = updateWorkflowSchema.parse(rawBody);
    const updated = await updateWorkflow(workflowId, input, auth.userId, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'core.approvals.workflow_manage' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const workflowId = parseWorkflowId(rawId);

    await softDeleteWorkflow(workflowId, auth.userId, getRequestIp(request));
    return ok({ deleted: true, id: workflowId });
  },
  { permission: 'core.approvals.workflow_manage' },
);
