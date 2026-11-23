import { withAuth } from '@/middlewares/auth';
import { getApprovalDetailWithHistory } from '@/modules/approvals/approvals.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id: rawId } = await context.params;
    const requestId = Number(rawId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      throw new AppError('INVALID_ID', 'Mã ID yêu cầu phê duyệt không hợp lệ.', 400);
    }

    const detail = await getApprovalDetailWithHistory(requestId, auth);
    return ok(detail);
  },
  { permission: 'core.approvals.read' },
);
