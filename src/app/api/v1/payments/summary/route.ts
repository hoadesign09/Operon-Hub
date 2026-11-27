import { withAuth } from '@/middlewares/auth';
import { getPaymentsSummary } from '@/modules/payments/payments.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request, _context, auth) => {
    const rawBranch = request.nextUrl.searchParams.get('branchId');
    const parsedBranch = rawBranch ? Number(rawBranch) : undefined;
    const branchId =
      parsedBranch && Number.isInteger(parsedBranch) && parsedBranch > 0
        ? parsedBranch
        : undefined;
    const summary = await getPaymentsSummary(auth, branchId);
    return ok(summary);
  },
  { permission: 'payments.read' },
);
