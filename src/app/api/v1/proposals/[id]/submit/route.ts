import { getRequestIp, withAuth } from '@/middlewares/auth';
import { submitProposalForApproval } from '@/modules/proposals/proposals.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const proposalId = Number(id);
    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      throw new AppError('INVALID_ID', 'ID đề xuất không hợp lệ.', 400);
    }
    const detail = await submitProposalForApproval(proposalId, auth, getRequestIp(request));
    return ok(detail);
  },
  { permission: 'proposals.create' },
);
