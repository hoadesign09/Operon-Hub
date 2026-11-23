import { getRequestIp, withAuth } from '@/middlewares/auth';
import { approvalActionSchema } from '@/modules/approvals/approvals.schema';
import { actOnApprovalRequest } from '@/modules/approvals/approvals.service';
import '@/modules/approvals/register-module-hooks';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request, context, auth) => {
  const { id: rawId } = await context.params;
  const requestId = Number(rawId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID yêu cầu phê duyệt không hợp lệ.', 400);
  }

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
  }

  const input = approvalActionSchema.parse(rawBody);
  const updated = await actOnApprovalRequest(
    requestId,
    auth,
    input.action,
    input.comment,
    getRequestIp(request),
  );
  return ok({ request: updated });
});
