import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateLeaveBalance } from '@/modules/hrm/requests/leave-balances.service';
import { updateLeaveBalanceSchema } from '@/modules/hrm/requests/leaves.schema';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('INVALID_ID', 'Mã ID quỹ phép năm không hợp lệ.', 400);
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
    }

    const input = updateLeaveBalanceSchema.parse(rawBody);
    const balance = await updateLeaveBalance(id, input, auth, getRequestIp(request));
    return ok({ balance });
  },
  { permission: 'hrm.requests.manage' },
);
