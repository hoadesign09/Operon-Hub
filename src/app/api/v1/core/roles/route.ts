import { withAuth } from '@/middlewares/auth';
import { listRoles } from '@/modules/roles/roles.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async () => {
    const roles = await listRoles();
    return ok(roles);
  },
  { permission: 'core.roles.read' },
);
