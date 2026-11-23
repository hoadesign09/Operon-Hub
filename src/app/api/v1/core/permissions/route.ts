import { withAuth } from '@/middlewares/auth';
import { listPermissions } from '@/modules/roles/roles.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async () => {
    const result = await listPermissions();
    return ok(result);
  },
  { permission: 'core.roles.read' },
);
