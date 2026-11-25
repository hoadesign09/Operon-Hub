import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { updateBudgetItem } from '@/modules/projects/budget-risks.service';
import { updateBudgetItemSchema } from '@/modules/projects/projects-advanced.schema';
import { AppError, ok } from '@/shared/api-response';

export const PATCH = withAuth<{ id: string; itemId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, itemId } = await context.params;
    const bid = Number(itemId);
    if (!Number.isInteger(bid) || bid <= 0) {
      throw new AppError('INVALID_BUDGET_ITEM_ID', 'ID hạng mục ngân sách không hợp lệ.', 400);
    }
    const input = updateBudgetItemSchema.parse(await request.json());
    return ok(await updateBudgetItem(auth, id, bid, input));
  },
  { permission: 'pm.projects.read' },
);
