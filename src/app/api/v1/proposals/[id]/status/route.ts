import { getRequestIp, withAuth } from '@/middlewares/auth';
import { proposalStatusActionSchema } from '@/modules/proposals/proposals.schema';
import { transitionProposalStatus } from '@/modules/proposals/proposals.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const proposalId = Number(id);
    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      throw new AppError('INVALID_ID', 'ID đề xuất không hợp lệ.', 400);
    }
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = proposalStatusActionSchema.parse(rawBody);
    const detail = await transitionProposalStatus(
      proposalId,
      input,
      auth,
      getRequestIp(request),
    );
    return ok(detail);
  },
  { permission: 'proposals.read' },
);
