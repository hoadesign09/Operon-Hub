import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createWorkHistorySchema } from '@/modules/hrm/contracts/contracts.schema';
import {
  createEmployeeWorkHistory,
  listEmployeeWorkHistories,
} from '@/modules/hrm/contracts/work-histories.service';
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
    const histories = await listEmployeeWorkHistories(auth, parsePositiveId(id));
    return ok(histories);
  },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const input = createWorkHistorySchema.parse(body);
    const createdItem = await createEmployeeWorkHistory(
      auth,
      parsePositiveId(id),
      input,
      getRequestIp(request),
    );
    return created(createdItem);
  },
  { permission: 'hrm.contracts.manage' },
);
