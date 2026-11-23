import { withAuth } from '@/middlewares/auth';
import { getOrganizationTree } from '@/modules/hrm/organization/departments.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const tree = await getOrganizationTree(auth, {
      branchId: sp.get('branchId'),
      includeInactive: sp.get('includeInactive'),
    });
    return ok(tree);
  },
  { permission: 'hrm.org.read' },
);
