import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { requestBudgetItemApproval } from '@/modules/projects/budget-risks.service';
import { AppError, ok } from '@/shared/api-response';

export const POST = withAuth<{ id: string; itemId: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id, itemId } = await context.params;
    const bid = Number(itemId);
    if (!Number.isInteger(bid) || bid <= 0) {
      throw new AppError('INVALID_BUDGET_ITEM_ID', 'ID hạng mục ngân sách không hợp lệ.', 400);
    }
    return ok(await requestBudgetItemApproval(auth, id, bid));
  },
  { permission: 'pm.projects.read' },
);
