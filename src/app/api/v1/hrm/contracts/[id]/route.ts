import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateContractSchema } from '@/modules/hrm/contracts/contracts.schema';
import {
  getContractById,
  softDeleteContract,
  updateContract,
} from '@/modules/hrm/contracts/contracts.service';
import { AppError, ok } from '@/shared/api-response';

function parsePositiveId(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('INVALID_ID', 'ID hợp đồng không hợp lệ.', 400);
  }
  return parsed;
}

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const contract = await getContractById(auth, parsePositiveId(id));
    return ok(contract);
  },
  { permission: 'hrm.contracts.read' },
);

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const input = updateContractSchema.parse(body);
    const updated = await updateContract(auth, parsePositiveId(id), input, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'hrm.contracts.manage' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    await softDeleteContract(auth, parsePositiveId(id), getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'hrm.contracts.manage' },
);
