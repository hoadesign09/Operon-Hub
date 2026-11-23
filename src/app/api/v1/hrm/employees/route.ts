import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createEmployeeSchema } from '@/modules/hrm/employees/employees.schema';
import { createEmployee, listEmployees } from '@/modules/hrm/employees/employees.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listEmployees(auth, {
      page: sp.get('page'),
      limit: sp.get('limit'),
      search: sp.get('search'),
      branchId: sp.get('branchId'),
      departmentId: sp.get('departmentId'),
      positionId: sp.get('positionId'),
      status: sp.get('status'),
      sortBy: sp.get('sortBy'),
      sortOrder: sp.get('sortOrder'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'hrm.employees.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const body: unknown = await request.json();
    const input = createEmployeeSchema.parse(body);
    const result = await createEmployee(auth, input, getRequestIp(request));
    return created(result);
  },
  { permission: 'hrm.employees.create' },
);
