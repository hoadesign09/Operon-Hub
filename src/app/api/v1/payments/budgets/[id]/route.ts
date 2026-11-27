import { withAuth } from '@/middlewares/auth';
import { updateBudgetSchema } from '@/modules/payments/budgets.schema';
import {
  canManageBudgets,
  canViewBudgets,
  deleteBudget,
  getBudgetDetail,
  updateBudget,
} from '@/modules/payments/budgets.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

async function parseId(context: { params: Promise<{ id: string }> }): Promise<number> {
  const { id } = await context.params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('INVALID_ID', 'ID quỹ ngân sách không hợp lệ.', 400);
  }
  return parsed;
}

export const GET = withAuth<{ id: string }>(async (_request, context, auth) => {
  if (!canViewBudgets(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xem chi tiết quỹ ngân sách.', 403);
  }
  const budgetId = await parseId(context);
  const detail = await getBudgetDetail(auth, budgetId);
  return ok(detail);
});

export const PATCH = withAuth<{ id: string }>(async (request, context, auth) => {
  if (!canManageBudgets(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền chỉnh sửa quỹ ngân sách.', 403);
  }
  const budgetId = await parseId(context);
  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
  }
  const input = updateBudgetSchema.parse(rawBody);
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  const detail = await updateBudget(auth, budgetId, input, ip);
  return ok(detail);
});

export const DELETE = withAuth<{ id: string }>(async (request, context, auth) => {
  if (!canManageBudgets(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xóa quỹ ngân sách.', 403);
  }
  const budgetId = await parseId(context);
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  await deleteBudget(auth, budgetId, ip);
  return ok({ deleted: true });
});
