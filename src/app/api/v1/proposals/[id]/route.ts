import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateProposalSchema } from '@/modules/proposals/proposals.schema';
import {
  getProposalDetail,
  softDeleteProposal,
  updateProposal,
} from '@/modules/proposals/proposals.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseProposalId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID đề xuất không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const detail = await getProposalDetail(auth, parseProposalId(id));
    return ok(detail);
  },
  { permission: 'proposals.read' },
);

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu cập nhật không đúng định dạng JSON.', 400);
    }
    const input = updateProposalSchema.parse(rawBody);
    const updated = await updateProposal(parseProposalId(id), input, auth, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'proposals.create' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    await softDeleteProposal(parseProposalId(id), auth, getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'proposals.create' },
);
