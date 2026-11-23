import { withAuth } from '@/middlewares/auth';
import { getAuthorizedModules } from '@/modules/registry';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, _context, auth) => {
  const modules = getAuthorizedModules(auth.permissions, auth.isSuperAdmin);
  return ok({
    user: auth,
    modules,
  });
});
