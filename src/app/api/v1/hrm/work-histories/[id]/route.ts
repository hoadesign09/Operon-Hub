import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { softDeleteWorkHistory } from '@/modules/hrm/contracts/work-histories.service';
import { AppError, ok } from '@/shared/api-response';

function parsePositiveId(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('INVALID_ID', 'ID bản ghi công tác không hợp lệ.', 400);
  }
  return parsed;
}

export const DELETE = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    await softDeleteWorkHistory(auth, parsePositiveId(id), getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'hrm.contracts.manage' },
);
