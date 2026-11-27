import { withAuth } from '@/middlewares/auth';
import { adjustBudgetSchema } from '@/modules/payments/budgets.schema';
import { adjustBudgetAllocation, canManageBudgets } from '@/modules/payments/budgets.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(async (request, context, auth) => {
  if (!canManageBudgets(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền điều chỉnh hạn mức quỹ ngân sách.', 403);
  }
  const { id } = await context.params;
  const budgetId = Number(id);
  if (!Number.isInteger(budgetId) || budgetId <= 0) {
    throw new AppError('INVALID_ID', 'ID quỹ ngân sách không hợp lệ.', 400);
  }
  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
  }
  const input = adjustBudgetSchema.parse(rawBody);
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  const detail = await adjustBudgetAllocation(auth, budgetId, input, ip);
  return ok(detail);
});
