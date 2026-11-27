import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { listAssignableItStaff } from '@/modules/it-requests/it-requests.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async () => {
    const staff = await listAssignableItStaff();
    return ok(staff);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);
