import { withAuth } from '@/middlewares/auth';
import { getPaymentFormOptions } from '@/modules/payments/payments.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_request, _context, auth) => {
    const options = await getPaymentFormOptions(auth);
    return ok(options);
  },
  { permission: 'payments.read' },
);
