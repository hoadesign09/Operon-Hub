import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { getItRequestsSummary } from '@/modules/it-requests/it-requests.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_request, _context, auth) => {
    const summary = await getItRequestsSummary(auth);
    return ok(summary);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);
