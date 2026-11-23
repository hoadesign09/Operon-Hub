import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createContractSchema } from '@/modules/hrm/contracts/contracts.schema';
import { createContract, listEmployeeContracts } from '@/modules/hrm/contracts/contracts.service';
import { AppError, created, ok } from '@/shared/api-response';

function parsePositiveId(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('INVALID_ID', 'ID nhân viên không hợp lệ.', 400);
  }
  return parsed;
}

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const contracts = await listEmployeeContracts(auth, parsePositiveId(id));
    return ok(contracts);
  },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const input = createContractSchema.parse({
      ...body,
      employeeId: parsePositiveId(id),
    });
    const contract = await createContract(auth, input, getRequestIp(request));
    return created(contract);
  },
  { permission: 'hrm.contracts.manage' },
);
