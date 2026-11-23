import { getRequestIp, withAuth } from '@/middlewares/auth';
import {
  createDepartment,
  listDepartments,
} from '@/modules/hrm/organization/departments.service';
import { createDepartmentSchema } from '@/modules/hrm/organization/organization.schema';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listDepartments(auth, {
      page: sp.get('page'),
      limit: sp.get('limit'),
      search: sp.get('search'),
      branchId: sp.get('branchId'),
      isActive: sp.get('isActive'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'hrm.org.read' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = createDepartmentSchema.parse(rawBody);
    const dept = await createDepartment(auth, input, getRequestIp(request));
    return created(dept);
  },
  { permission: 'hrm.org.manage' },
);
