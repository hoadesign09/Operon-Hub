import { withAuth } from '@/middlewares/auth';
import { getProposalsSummary } from '@/modules/proposals/proposals.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_request, _context, auth) => {
    const summary = await getProposalsSummary(auth);
    return ok(summary);
  },
  { permission: 'proposals.read' },
);
