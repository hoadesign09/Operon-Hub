import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createContractSchema } from '@/modules/hrm/contracts/contracts.schema';
import { createContract, listContracts } from '@/modules/hrm/contracts/contracts.service';
import { created, ok } from '@/shared/api-response';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listContracts(auth, {
      page: sp.get('page'),
      limit: sp.get('limit'),
      search: sp.get('search'),
      branchId: sp.get('branchId'),
      employeeId: sp.get('employeeId'),
      contractType: sp.get('contractType'),
      status: sp.get('status'),
      expiryAlert: sp.get('expiryAlert'),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'hrm.contracts.read' },
);

export const POST = withAuth(
  async (request: NextRequest, _context, auth) => {
    const body: unknown = await request.json();
    const input = createContractSchema.parse(body);
    const contract = await createContract(auth, input, getRequestIp(request));
    return created(contract);
  },
  { permission: 'hrm.contracts.manage' },
);
